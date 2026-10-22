# Architecture

## Layers

```
src/app/          Screens (Expo Router). Thin: read from the store, call engines, render.
src/components/   UI kit and signature pieces (Petal Compass, body map, pain scale, charts, calendar).
src/store/        zustand store (app.ts) and derived hooks (derived.ts: useCycle, useInsights, ...).
src/engines/      Pure TypeScript logic with no React or native imports. Fully unit-tested.
src/data/         Types, schema, storage backends, demo data generator, meal library.
src/theme/, src/i18n/, src/lib/   Tokens, translations, dates, secure PIN, sharing, notifications.
src/content/      Learn library (English and Bangla) and clinician sign-offs tied to a text hash.
server/           Petal AI backend and opt-in research store (Node 22). Reuses src/engines/safety.ts and researchSchema.ts.
scripts/          Icon generation and the clinician review packet (npm run review:packet).
```

The engines are plain functions so they can be reused on iOS, on the server, or in a future web app without changes.

## Engines

| Engine | Responsibility |
| --- | --- |
| `cycle.ts` | Turns logged bleeding days into periods and cycles. Predicts the next period as a **range** using the median of up to six recent cycles, with a width that grows with variability. Reports confidence (low/medium/high), "still learning", late periods, and when phase estimates should be limited (irregular cycles, hormonal contraception, postpartum, breastfeeding, PCOS, perimenopause). Never labels any day as safe or unsafe for pregnancy. |
| `safety.ts` | Deterministic rules that run **before** any AI: pain red flags (`assessPain`), worsening trends, crisis and urgent-medical text detection in English and Bangla (`screenText`), crisis resources, and `guardOutput`, which strips diagnosis, dosing, contraception and "I'm human" statements from AI text. |
| `insights.ts` | Pattern Garden. Detectors for pain around bleeding, mood and energy before a period, sleep and energy, stress and sleep. Each insight needs a minimum amount of data, says how it was found, and is phrased as a correlation, never a cause. |
| `patterns.ts` | Stage 2 multi-cycle intelligence. Cycle-by-cycle and month-by-month timelines, cycle-length variation and shifts, long periods, symptoms that keep coming back at the same point in the cycle, a rising pain trend (shown first, with a gentle suggestion to see a doctor), the **Mood Mirror** (moods across four parts of the cycle) and `buildLongitudinal` for the six-month view and the PDF. Same rules as `insights.ts`: minimum data, a "how we found this", never a cause. |
| `wearables.ts` | Stage 3. Summarises Health Connect readings into one row per day on the phone (sleep toward the morning you woke, plausibility checks, only the metrics chosen), merges and prunes them, and finds wearable patterns: sleep before a period, resting heart rate across the cycle, short nights and pain, steps and mood. Same rules as `insights.ts`. The Health Connect calls live in `src/lib/healthConnect.native.ts` (read only); the web and test version reports "unavailable". |
| `prediction.ts` | Stage 3 Prediction Lab. Detects the post-ovulation temperature rise (three over six) in basal body temperature or a wearable's skin temperature, measures the person's luteal length, and compares three methods (standard median, recent-weighted, temperature-anchored) by back-testing on the person's own completed cycles, using only the cycles before each one. Never changes the standard estimate and never gives fertility guidance. |
| `research.ts`, `researchSchema.ts` | Stage 3 opt-in research. Eligibility (adults, not demo), versioned consent, building a de-identified contribution with randomised response for symptom flags, and a plain-language preview. `researchSchema.ts` has no runtime imports so the server uses the exact same strict validator. |
| `voice.ts` | Decides how dictation may run: on-device when the language pack is installed, online only with the person's separate permission. |
| `personalization.ts` | Comfort Path suggestions that **learn** from "I tried this" / "It helped" (weighted toward pain in the same body area; ideas that keep not helping sink but stay available; asking about pain relief is never dropped for strong pain), what tends to help, meal recommendations that follow phase, symptoms and symptoms that usually come before the period (with a vitamin C pairing tip for iron-rich meals and a daily focus), the gentle plan for One Minute for Me, Care Mode suggestions, comfort of the day, and journal theme suggestions (only with consent). |
| `conversation.ts` | Petal AI. `respond()` runs the safety screen first. If cloud AI is consented and an endpoint is set, it sends a minimal, consent-filtered context to the backend and passes the reply through `guardOutput`. Otherwise (or on any network error) the on-device companion answers from templates, in English or Bangla. Bangla script and Banglish (Bangla in English letters) are recognised, and safety messages go back in Bangla to someone writing Bangla. |
| `privacy.ts` | Consent copy, what is shared, consent changes (turning Petal off also revokes cloud consent), minor detection and the guardian step (`cloudAllowed` is checked on every send), PIN rules. |
| `report.ts` | Builds the Pain Passport / health summary from structured data only and renders escaped HTML for PDF export, including an optional "Changes over time" section (cycle-by-cycle and month-by-month tables, a printable SVG chart, patterns across cycles). Demo reports are watermarked. |

## Petal AI flow

```
user message
   │
   ▼
screenText()  ── crisis / urgent ──►  fixed safety message + support options (no network)
   │ none
   ▼
cloud consent + endpoint?  ── no ──►  on-device companion (templates, patterns, Bangla)
   │ yes
   ▼
buildContext()  (only what each consent toggle allows; no history unless memory is on)
   │
   ▼
POST {endpoint}/v1/companion  ──►  server: screenText() again → Claude → guardOutput()
   │
   ▼
guardOutput() on the device too  ──►  reply shown with "AI companion" disclosure
```

The server sends Claude a cached system prompt (`server/src/prompt.ts`) that sets Petal's voice and hard limits, plus a context block marked as data, not instructions. It stores and logs nothing about the conversation.

## Storage

`StorageBackend` (in `src/data/storage.ts`) has three implementations:

- `backend.native.ts`: expo-sqlite with **SQLCipher**. A 256-bit key is generated with `expo-crypto`, kept in `expo-secure-store` (Android Keystore), and applied with `PRAGMA key`. "Delete everything" deletes the database file and the key.
- `backend.ts`: the web preview, using localStorage (not encrypted, preview only).
- `MemoryBackend`: used by tests.

See [DATABASE.md](DATABASE.md) for the tables.

## Theming and accessibility

- Spec palette in `src/theme/tokens.ts`, with light and dark themes and per-phase petal colours. Text colours are checked against WCAG AA in tests.
- **High contrast** themes (`hcLight`, `hcDark`) give all text at least 7:1 (AAA), solid surfaces and visible borders; switches show On/Off in words and selected chips get a tick, so nothing relies on colour alone.
- **Text size** (Aa to Aa+++) scales every `T` on top of the phone's font size; **Larger touch areas** raises buttons, chips, segments and icon buttons to 56 px (`useTarget`).
- `announce()` tells TalkBack what just happened (for example after a sync or a delete), in the app's language, and status messages use `accessibilityLiveRegion`.
- Fraunces (editorial serif) for headings, Inter for body text.
- Reduce-motion respects both the OS setting and an in-app toggle.
- Every interactive element has a role and label. The body map has a list alternative, and the pain scale announces words as well as numbers.

## iOS later

Nothing in the engines, store or screens is Android-specific. For iOS you would add an `ios.bundleIdentifier`, a Face ID usage string (already set through the local-authentication plugin), icons, and run `eas build --platform ios`.
