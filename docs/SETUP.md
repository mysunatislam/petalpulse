# Setup, testing and Android builds

## Requirements

- Node.js 22 or newer
- For Android: Android Studio with an emulator, or a physical device with USB debugging
- Optional: an [EAS](https://expo.dev/eas) account for cloud builds

The project uses Expo SDK 58 (React Native 0.88, React 19, TypeScript 6). Install new Expo packages with `npx expo install <pkg>` so versions stay compatible with the SDK.

## Install

```bash
npm install
```

## Run

```bash
npx expo start            # dev server
npx expo start --web      # quick browser preview
```

**The web preview is for looking at screens only.** It stores data in the browser's localStorage *without encryption*, and native-only features (biometrics, notifications, haptics, PDF sharing) are skipped or stubbed.

### Android development build (recommended)

Petal & Pulse uses native modules that Expo Go does not include, most importantly **SQLCipher** (encrypted SQLite, enabled by `useSQLCipher: true` in `app.json`). You need a development build:

```bash
# Local build (needs Android Studio / SDK)
npx expo run:android

# or in the cloud with EAS
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
```

Then install the build on the device and run `npx expo start --dev-client`.

### Release build

```bash
eas build --profile production --platform android   # produces an .aab for Google Play
```

Before release, replace the template icons in `assets/` (they are Expo defaults), set a real `android.package` if `com.petalpulse.app` is not yours, and complete the store's Data Safety form using [PRIVACY.md](PRIVACY.md).

## Tests

```bash
npm test             # Jest (jest-expo preset)
npm run typecheck    # tsc --noEmit
npx eslint .         # lint
```

What the 91 tests cover:

| File | Covers |
| --- | --- |
| `__tests__/cycle.test.ts` | Cycle maths, period detection, spotting, unusual dates (invalid dates, month/year/DST boundaries, future and duplicate records), missing data, irregular cycles, implausible lengths, confidence, late periods, LH anchoring |
| `__tests__/safety.test.ts` | Pain red flags (emergency, urgent, appointment), worsening trends, crisis and urgent text in English and Bangla, the output guard (no diagnosis, dosing, contraception or human claims), and that `respond()` answers crises without calling the cloud |
| `__tests__/insights.test.ts` | Demo data shape, each pattern detector, minimum-data rules, correlation maths, meal filtering, the offline companion's replies |
| `__tests__/privacy.test.ts` | Consent defaults, consent-filtered AI context, revoking consent, memory off clears chat, export excludes the AI endpoint, delete-everything, schema mapping, PIN rules, quiet hours, discreet notification wording |
| `__tests__/a11y.test.tsx` | WCAG AA colour contrast, labelled pain scale, mood radios, the body map's non-visual alternative, toggle and button states |

## Petal AI backend

The app never contains an API key. Cloud replies go through the small Node server in `server/`, which holds the key and calls Claude.

```bash
cd server
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start      # listens on :8787
```

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | (required) | Claude API key. Keep it in your host's secret store. |
| `PORT` | `8787` | Port to listen on |
| `PETAL_MODEL` | `claude-opus-5-5` | Model id |
| `PETAL_APP_TOKEN` | (empty) | Optional shared bearer token. It only deters casual misuse, since anything shipped in an app can be extracted. Use real auth (e.g. per-install tokens or Play Integrity) before launch. |

The server uses **server-side fallback** (`fallbacks: 'default'`), which means that if the primary model is overloaded the API can answer with a fallback model instead of failing. Remove those two lines in `server/src/index.ts` if you always want the primary model.

Endpoints: `GET /health` and `POST /v1/companion`. Deploy behind HTTPS (Fly.io, Render, Cloud Run or similar). Then, in the app, go to **Settings → Petal AI**, turn on cloud replies (which asks for consent) and enter the server address.

Quick check:

```bash
curl -s localhost:8787/health
curl -s localhost:8787/v1/companion -H 'content-type: application/json' \
  -d '{"message":"I feel so tired today","history":[],"context":{"language":"en"},"length":"short"}'
```
