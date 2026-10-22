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

const PORT = Number(process.env.PORT ?? 8787);
const APP_TOKEN = process.env.PETAL_APP_TOKEN ?? ''; // optional shared token issued to app builds
const MODEL = process.env.PETAL_MODEL ?? 'claude-opus-5-5';
const MAX_BODY = 32 * 1024;
const RATE = { windowMs: 60_000, max: 20 };

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < RATE.windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > RATE.max;
}

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

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return send(res, 200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/v1/companion') return send(res, 404, { error: 'not_found' });
  if (APP_TOKEN && req.headers.authorization !== `Bearer ${APP_TOKEN}`) return send(res, 401, { error: 'unauthorized' });
  const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? req.socket.remoteAddress ?? 'unknown';
  if (limited(ip)) return send(res, 429, { error: 'slow_down' });

  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) return send(res, 413, { error: 'too_large' });
    chunks.push(chunk as Buffer);
  }
  let body: CompanionRequest | null = null;
  try {
    body = validate(JSON.parse(Buffer.concat(chunks).toString('utf8')));
  } catch {
    body = null;
  }
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
  console.log(`Petal AI backend listening on :${PORT} (model ${MODEL})`);
});
