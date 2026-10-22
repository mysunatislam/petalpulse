/**
 * Petal AI backend.
 *
 * - Holds the Claude API key server-side; the mobile app never sees it.
 * - Accepts only the minimal, consented context the app chose to send.
 * - Runs the same deterministic Safety Engine before and after the model.
 * - Stores nothing: no request bodies or replies are logged or persisted.
 */
import http from 'node:http';
import Anthropic from '@anthropic-ai/sdk';
import { screenText, guardOutput, CRISIS_MESSAGE, URGENT_MEDICAL_MESSAGE } from '../../src/engines/safety.ts';
import { SYSTEM_PROMPT, renderContext, type CompanionRequest } from './prompt.ts';
import { bearer, createLimiter, issueToken, verifyToken } from './auth.ts';
import { createResearchStore, parseSubmission } from './research.ts';

const PORT = Number(process.env.PORT ?? 8787);
const TOKEN_SECRET = process.env.PETAL_TOKEN_SECRET ?? ''; // signs per-install tokens; without it the server runs open (local dev only)
const REVOKED = new Set((process.env.PETAL_REVOKED_INSTALLS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const MODEL = process.env.PETAL_MODEL ?? 'claude-opus-5-5';
const MAX_BODY = 32 * 1024;
const RESEARCH_DIR = process.env.PETAL_RESEARCH_DIR ?? ''; // opt-in research is off unless a study sets this
const research = RESEARCH_DIR ? createResearchStore(RESEARCH_DIR) : null;

if (!TOKEN_SECRET && process.env.NODE_ENV === 'production') {
  console.error('PETAL_TOKEN_SECRET is required in production.');
  process.exit(1);
}
if (TOKEN_SECRET && TOKEN_SECRET.length < 32) {
  console.error('PETAL_TOKEN_SECRET must be at least 32 characters.');
  process.exit(1);
}

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const perMinute = createLimiter(60_000, 20);
const perDay = createLimiter(24 * 60 * 60_000, 400);
const registrations = createLimiter(60 * 60_000, 10); // per IP per hour
const contributions = createLimiter(24 * 60 * 60_000, 5); // per IP per day, held in memory only

function send(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(JSON.stringify(body));
}

function validate(b: unknown): CompanionRequest | null {
  if (!b || typeof b !== 'object') return null;
  const r = b as Record<string, unknown>;
  if (typeof r.message !== 'string' || !r.message.trim() || r.message.length > 2000) return null;
  const history = Array.isArray(r.history) ? r.history : [];
  const cleanHistory = history
    .filter((m): m is { role: 'user' | 'assistant'; text: string } => !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.text === 'string')
    .slice(-12)
    .map((m) => ({ role: m.role, text: m.text.slice(0, 2000) }));
  const length = r.length === 'short' || r.length === 'long' ? r.length : 'medium';
  return { message: r.message.trim(), history: cleanHistory, context: (r.context as CompanionRequest['context']) ?? { language: 'en' }, length };
}

async function companion(req: CompanionRequest): Promise<{ text: string; safety: 'crisis' | 'urgent' | null }> {
  const risk = screenText(req.message);
  if (risk === 'crisis') return { text: CRISIS_MESSAGE, safety: 'crisis' };
  if (risk === 'urgent_medical') return { text: URGENT_MEDICAL_MESSAGE, safety: 'urgent' };

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of req.history) messages.push({ role: m.role, content: m.text });
  // History must start with a user turn.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  messages.push({ role: 'user', content: req.message });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: req.length === 'long' ? 1200 : 700,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: renderContext(req) },
    ],
    messages,
  });

  if (response.stop_reason === 'refusal') {
    return { text: 'I’m not able to help with that one, but I’m here if you want to talk about how you’re feeling.', safety: null };
  }
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
  return { text: guardOutput(text || 'I’m here. Could you tell me a little more?').text, safety: null };
}

/** Reads a JSON body up to MAX_BODY. undefined = too large, null = not JSON. */
async function readJson(req: http.IncomingMessage): Promise<unknown | null | undefined> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) return undefined;
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? 'unknown';

  if (req.method === 'POST' && req.url === '/v1/register') {
    if (!TOKEN_SECRET) return send(res, 200, { token: null }); // open dev server: no token needed
    if (registrations(ip)) return send(res, 429, { error: 'slow_down' });
    const { token, expiresAt } = issueToken(TOKEN_SECRET);
    return send(res, 200, { token, expiresAt });
  }

  // Opt-in research: no token on purpose, so a contribution can't be linked to an install.
  if (req.url === '/v1/research' || req.url?.startsWith('/v1/research/')) {
    if (!research) return send(res, 404, { error: 'not_found' });
    if (req.method === 'POST' && req.url === '/v1/research') {
      if (contributions(ip)) return send(res, 429, { error: 'slow_down' });
      const body = await readJson(req);
      if (body === undefined) return send(res, 413, { error: 'too_large' });
      const sub = parseSubmission(body);
      if (!sub) return send(res, 400, { error: 'bad_request' });
      return send(res, 200, { id: await research.save(sub.contribution, sub.deleteKeyHash) });
    }
    if (req.method === 'DELETE') {
      const r = await research.remove(req.url.slice('/v1/research/'.length), req.headers['x-delete-key'] as string | undefined);
      return r === 'forbidden' ? send(res, 403, { error: 'forbidden' }) : send(res, r === 'deleted' ? 200 : 404, { deleted: r === 'deleted' });
    }
    return send(res, 404, { error: 'not_found' });
  }

  if (req.method !== 'POST' || req.url !== '/v1/companion') return send(res, 404, { error: 'not_found' });
  let caller = `ip:${ip}`;
  if (TOKEN_SECRET) {
    const installId = verifyToken(TOKEN_SECRET, bearer(req.headers.authorization), Date.now(), REVOKED);
    if (!installId) return send(res, 401, { error: 'unauthorized' });
    caller = installId;
  }
  if (perMinute(caller) || perDay(caller)) return send(res, 429, { error: 'slow_down' });

  const raw = await readJson(req);
  if (raw === undefined) return send(res, 413, { error: 'too_large' });
  const body = validate(raw);
  if (!body) return send(res, 400, { error: 'bad_request' });

  try {
    send(res, 200, await companion(body));
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return send(res, 503, { error: 'busy' });
    if (err instanceof Anthropic.APIError) return send(res, 502, { error: 'upstream', status: err.status });
    return send(res, 500, { error: 'internal' });
  }
});

server.listen(PORT, () => {
  console.log(`Petal AI backend listening on :${PORT} (model ${MODEL}${TOKEN_SECRET ? '' : ', OPEN: no PETAL_TOKEN_SECRET, local dev only'}${research ? ', research on' : ''})`);
});
