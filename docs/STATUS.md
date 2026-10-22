# Status: Stage 1 MVP

Last updated 22 October 2026.

## Finished and tested

- **Project**: Expo SDK 58, TypeScript, Expo Router, Reanimated, Android-first config (`com.petalpulse.app`, no cloud backup, blocked location/ad-ID permissions). Typecheck, lint and 91 tests pass.
- **Design**: spec palette, Fraunces + Inter, light and dark themes, the animated **Petal Compass** with phase colours, reduce-motion support.
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
- **AI backend** (`server/`): key held server-side, Claude with a cached system prompt, safety screen + output guard, rate limit, body-size cap, optional token, no logging of content, server-side fallback enabled.
- **Privacy**: SQLCipher-encrypted database, key in Android Keystore, PIN/biometric lock with re-lock, JSON export, delete everything, discreet notifications with quiet hours.
- **Support screen**: 999, Kaan Pete Roi, findahelpline.com.
- **Demo mode**: three months of synthetic data for "Mira" that walks through all seven demo moments (see [DEMO.md](DEMO.md)). A banner shows on every screen and exported reports are watermarked.

## Partly finished

- **Bangla**: onboarding, navigation, key labels and the offline companion are translated; many detail screens are still English only. No Bangla font is bundled yet (Noto Sans Bengali recommended), so Bangla falls back to the system font.
- **Notifications**: scheduling and wording are built; needs testing on real Android devices across manufacturers (battery optimisers often delay local notifications).
- **Accessibility**: labels, roles, contrast and reduce-motion are done; a full TalkBack pass on a device and large-font layout checks are still needed.
- **App icon and splash**: still the Expo template images in `assets/`.

## Not started (Stage 2 and 3)

- Voice input and voice notes in Mood Mirror and Petal AI.
- Accounts, cloud sync and multi-device (would need end-to-end encryption to keep the privacy promise).
- Parental-consent flow for under-18s using cloud AI (until then, keep cloud AI off for minors).
- Wearables and Health Connect (sleep, steps, heart rate).
- Partner/caregiver sharing, community, clinician portal.
- Store listing: screenshots, privacy policy, Data Safety form.
- Clinician-reviewed content (see [SAFETY.md](SAFETY.md)); verification of the Kaan Pete Roi number.
- Real backend authentication (per-install tokens or Play Integrity) and production hosting for `server/`.
- Database migrations beyond version 1.
- iOS build and testing.

## Known limitations

- The web preview stores data unencrypted and logs a harmless React warning about touch props on the SVG body map. It is for previewing only.
- Text safety screening is pattern-based and will miss some phrasings.
- Predictions use the calendar method only (median cycle length); BBT and mucus are recorded but not yet used in estimates. Only a positive LH test adjusts the ovulation estimate.
