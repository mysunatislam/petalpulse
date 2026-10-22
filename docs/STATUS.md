# Status: Stage 1 MVP and Stage 2

Last updated 22 October 2026.

## Finished and tested

- **Project**: Expo SDK 58, TypeScript, Expo Router, Reanimated, Android-first config (`com.petalpulse.app`, no cloud backup, blocked location/ad-ID permissions). Typecheck, lint and 162 tests pass.
- **Design**: spec palette, Fraunces + Inter (Noto Serif/Sans Bengali for Bangla), light and dark themes, the animated **Petal Compass** with phase colours, reduce-motion support.
- **App icon and splash**: drawn from the Petal Compass, with Android adaptive and monochrome (themed) layers. Sources in `assets/brand/`.
- **Bangla**: every screen, button, chip, placeholder, accessibility label, date and number, plus safety messages, phase copy and comfort ideas, through a phrasebook (`src/i18n/phrases.ts`) with the Noto Bengali fonts.
- **Voice input**: mic buttons in Petal AI and the Mood Mirror journal, in English or Bangla. On-device recognition by default; online recognition only after a separate opt-in. No audio is kept.
- **Parental consent**: under-18s can only turn on cloud AI after a parent or guardian step; the agreement can be withdrawn and is re-checked on every send.
- **Welcome and onboarding**: 8 short steps in about a minute, every question optional with "I'm not sure", English/Bangla choice, guest use (no account), demo mode.
- **Home (My Bloom)**: greeting, Petal Compass, cycle day and estimate with confidence, mood check-in, the My Body / My Comfort / My Nourishment cards, Ask Petal button, Care Mode aware.
- **My Cycle (Cycle Compass)**: month calendar with bleeding, possible period and estimated ovulatory window, day logging (flow, symptoms, energy, sleep, optional BBT/LH/mucus), prediction as a range, "How is this estimated?", never a contraceptive.
- **Pain Passport**: front/back body map with a list alternative, 0–10 scale with words, qualities, onset, impact, other symptoms, red-flag safety rules, Comfort Path, monthly / 3 / 6-month summary, PDF export and share.
- **Mood Mirror**: 8 moods, intensity, tags, journal, optional theme suggestions (consent-gated, person confirms), history.
- **Nourish Me**: 16 meals including Bangladeshi dishes, filtered by eating style and allergies, "why this may help" with source notes, saved favourites.
- **Pattern Garden (Insights)**: 5 detectors with minimum-data rules, correlation-not-causation wording, "How did we find this?", helpful/hide feedback, charts and an explorer.
- **One Minute for Me**: quick check-in and a gentle plan, no streaks. Plus a guided breathing minute.
- **My Care Mode**: Comfort, Quiet, Everyday and Reflection, all chosen by the person (the app may suggest, never switches).
- **Petal AI**: AI disclosure, consent-gated cloud replies, consent-filtered context, crisis and urgent handling before any AI, output guard, on-device fallback companion (with Bangla replies), suggestion chips, chat memory toggle.
- **AI backend** (`server/`): key held server-side, Claude with a cached system prompt, safety screen + output guard, per-install signed tokens with per-install rate limits and revocation, body-size cap, no logging of content, server-side fallback enabled.
- **Privacy**: SQLCipher-encrypted database, key in Android Keystore, PIN/biometric lock with re-lock, JSON export, delete everything, discreet notifications with quiet hours.
- **Support screen**: 999, Kaan Pete Roi, findahelpline.com.
- **Demo mode**: about six months of synthetic data for "Mira" that walks through all seven demo moments (see [DEMO.md](DEMO.md)). A banner shows on every screen and exported reports are watermarked.

## Stage 2: Advanced Intelligence (finished and tested)

- **Multi-cycle pattern detection** (`src/engines/patterns.ts`): cycle-length variation and gradual shifts, periods often longer than 7 days, symptoms that come back at the same point in the cycle, and a rising pain trend that is shown first with a suggestion to see a doctor. All need at least 3 cycles and explain how they were found.
- **Mood Mirror**: on the journal screen, how moods sit across four parts of the cycle (most common mood and share of hard days) with a gentle reflection. Needs 2 cycles and 12 check-ins.
- **Personalized Comfort Path**: learns from "I tried this" and "It helped", weighted toward pain in the same body area. What has helped rises with a note ("Helped you 3 of 4 times"), what keeps not helping sinks, and "What tends to help you" appears in My Care.
- **Enhanced nutrition**: picks follow the phase and today's symptoms (now including cravings and headache), a daily focus card plans ahead for symptoms that usually come before the period, iron-rich meals get a vitamin C pairing tip, and there are 5 new meals (21 in total). Still no restrictive advice.
- **Longitudinal reporting**: "The last six months" in Insights (cycle-length range, bleeding days, pain direction, days with pain by month, cycle by cycle), and a "Changes over time" section in the clinician PDF with tables and a printable chart. The export now offers 12 months too.
- **Bangla conversation**: the on-device companion understands every topic in Bangla script and Banglish and answers in Bangla, with Bangla numbers, dates and pattern mentions. Crisis and urgent screening also covers Bangla and Banglish phrases, and safety messages go back in Bangla.

## Partly finished

- **Bangla**: some text the output guard inserts into cloud replies is English only. All Bangla copy should be reviewed by a native speaker.
- **Notifications**: scheduling and wording are built; needs testing on real Android devices across manufacturers (battery optimisers often delay local notifications).
- **Accessibility**: labels, roles, contrast and reduce-motion are done; a full TalkBack pass on a device and large-font layout checks are still needed.

## Not started (Stage 2 and 3)

- Saved voice notes (audio) in Mood Mirror. Voice-to-text is built.
- Accounts, cloud sync and multi-device (would need end-to-end encryption to keep the privacy promise).
- Wearables and Health Connect (sleep, steps, heart rate).
- Partner/caregiver sharing, community, clinician portal.
- Store listing: screenshots, privacy policy, Data Safety form.
- Clinician-reviewed content (see [SAFETY.md](SAFETY.md)); verification of the Kaan Pete Roi number.
- Play Integrity checks at backend registration, and production hosting for `server/`.
- Database migrations beyond version 1.
- iOS build and testing.

## Known limitations

- The web preview stores data unencrypted and logs a harmless React warning about touch props on the SVG body map. It is for previewing only.
- Text safety screening is pattern-based and will miss some phrasings.
- Predictions use the calendar method only (median cycle length); BBT and mucus are recorded but not yet used in estimates. Only a positive LH test adjusts the ovulation estimate.
