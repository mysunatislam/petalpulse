# Petal & Pulse

**More than your cycle. All of you.**

Petal & Pulse is a menstrual, emotional and wellness companion. It is built Android-first with Expo, and the same code can later ship to iOS. It is local-first: everything a person logs stays encrypted on their phone unless they choose to share it.

This is the **Stage 1 MVP, Stage 2 (Advanced Intelligence) and Stage 3 (wearables, Prediction Lab, clinician-reviewed content, accessibility, opt-in research)**. See [docs/STATUS.md](docs/STATUS.md) for what is finished and what is not.

## Quick start

```bash
npm install
npx expo start          # press "a" for an Android device/emulator, "w" for the web preview
npm test                # 201 unit + accessibility tests
npm run typecheck
npx eslint .
```

The encrypted database (SQLCipher) and the other native modules need a **development build** on Android, not Expo Go. Details are in [docs/SETUP.md](docs/SETUP.md).

To look around without entering anything, tap **"Explore the demo"** on the welcome screen. It loads about six months of synthetic data for a fictional user, Mira, and shows a banner at the top of every screen.

## What's inside

| Area | Where |
| --- | --- |
| Screens (Expo Router) | `src/app/` |
| Engines (cycle, safety, insights, patterns, wearables, prediction, research, personalization, conversation, privacy, report) | `src/engines/` |
| Learn library and clinician sign-offs | `src/content/` |
| Storage, schema, demo data, meals | `src/data/` |
| State (zustand) | `src/store/` |
| UI kit, Petal Compass, charts, body map | `src/components/` |
| Theme tokens (light/dark/high contrast), i18n (English/Bangla) | `src/theme/`, `src/i18n/` |
| Petal AI backend (holds the Claude API key) and the opt-in research store | `server/` |
| Tests | `__tests__/` |

## Docs

- [docs/SETUP.md](docs/SETUP.md): setup, testing, Android builds, running the AI backend
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app is put together, engines, the AI flow
- [docs/DATABASE.md](docs/DATABASE.md): the on-device schema
- [docs/PRIVACY.md](docs/PRIVACY.md): what is stored, what is shared, encryption, deletion
- [docs/SAFETY.md](docs/SAFETY.md): red-flag rules, crisis handling, what needs clinician review
- [docs/DEMO.md](docs/DEMO.md): a script for the seven demo moments
- [docs/STATUS.md](docs/STATUS.md): finished, partly finished, and not started
- [docs/review/REVIEW_PACKET.md](docs/review/REVIEW_PACKET.md): the Learn guides and safety messages, ready for a clinician to sign off

## Important

Petal & Pulse is a wellness app. It does not diagnose, prescribe, or act as contraception. Cycle predictions are estimates with a confidence range. The safety rules and health copy **must be reviewed by a qualified clinician** before public release (see [docs/SAFETY.md](docs/SAFETY.md)). No Learn guide has been signed off yet, and the app says so on every guide.
