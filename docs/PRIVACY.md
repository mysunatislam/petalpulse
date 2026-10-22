# Privacy

Petal & Pulse is **local-first**. There is no account, no analytics, no ads SDK and no cloud sync.

## What stays on the phone

Everything the person logs: periods, symptoms, moods, journal text, pain, chats (only if memory is on), preferences, and daily wearable summaries (only if they connect Health Connect). It lives in an SQLCipher-encrypted SQLite database. The 256-bit key is random per install and kept in the Android Keystore through `expo-secure-store`.

`android.allowBackup` is `false`, so the data is not copied into Google cloud backups. Location and advertising-ID permissions are explicitly blocked in `app.json`.

## What can leave the phone, and only by choice

| What | When | Where it goes |
| --- | --- | --- |
| A chat message plus a minimal context | Only if the person turns on cloud replies in Settings, accepts the consent screen, and an AI server address is set | The project's own Petal AI backend, which forwards it to Claude and keeps nothing |
| Cycle day and phase estimate | Only if "Use my cycle context" is on | Same |
| Recent moods and pain logs | Only if "Use my mood and pain context" is on | Same |
| Earlier messages | Only if "Petal remembers our chats" is on | Same |
| Speech, while the mic button is on | Only if the phone can't recognise the language offline **and** the person turned on "Allow online speech recognition" | The phone's own speech service (usually Google). Never to the Petal backend. The app records and keeps no audio |
| A random install token | When cloud AI is first used with a server address | The Petal backend, to rate-limit and revoke one install. It contains no name, email, device id or health data |
| A PDF health summary or JSON export | Only when the person taps Share or Export | Wherever they choose to send it |
| A de-identified research summary | Only for adults who opted in, after they see the exact summary and press Send, and only when a study address was built into the app | The study's research server. See "Opt-in research" below |

Cloud AI is **off by default**. Turning off Petal AI also revokes cloud consent. Voice input is on-device by default: Android's offline recognition is used whenever the language pack is installed. Without any cloud consent, Petal answers with an on-device companion and nothing is sent.

## Wearables (Health Connect)

Off by default. In **Settings → More tools → Wearables** the person chooses each kind of data (sleep, steps, resting heart rate, temperature) and Android's own Health Connect screen asks for permission.

- **Read only.** The app asks for read permissions only and never writes to Health Connect. The manifest declares only `READ_SLEEP`, `READ_STEPS`, `READ_RESTING_HEART_RATE`, `READ_SKIN_TEMPERATURE` and `READ_BASAL_BODY_TEMPERATURE`.
- **Summarised on the phone.** Readings become one row per day (minutes of sleep, step count, average resting heart rate, night temperature change). Raw readings are not stored. Implausible values (for example a resting heart rate of 250) are dropped.
- **Never leaves the phone.** Wearable data is not part of the Petal AI context and not part of research contributions.
- **Stopping.** Turning a kind of data off clears it from the summaries; "Stop reading" stops syncing; "Delete wearable summaries" removes them all. Revoking access completely is done in Health Connect, which the screen links to.

## Opt-in research

Off by default, adults (18+) only, never with demo data, and only once a study address is built into the app (`EXPO_PUBLIC_RESEARCH_URL`). The person can't type an address in, so a look-alike site can't collect data.

1. The person reads exactly what is and isn't shared and agrees to consent version 1. Consent is tied to that version, so changing what is collected needs new consent.
2. Each time, they tap **Prepare a summary to review**, see it in plain words (and the raw JSON if they like), and press **Send** or **Don't send**.
3. A contribution holds only: age band, up to six cycle and period lengths **without dates**, average pain and pain days per cycle (rounded), share of hard check-ins in quarters, yes/no flags for ten common symptoms, and whether a wearable is used. No name, dates, journal, chats, notes, wearable data or ids. The server (`server/src/research.ts`) rejects anything with extra or out-of-range fields.
4. **Randomised response.** Before sending, each symptom flag has a 1 in 4 chance of being replaced by a coin flip (local differential privacy, ε = ln 7 ≈ 1.95 per flag).
5. **Unlinkable.** Contributions carry no install id or token, and the server keeps only the day it arrived, not the time or IP.
6. **Deletable.** Each contribution gets a random delete key that stays on the phone (only its SHA-256 is sent). "Delete everything I sent", or the app's "Delete everything", asks the server to delete each one. Withdrawing consent stops future sharing but keeps the keys so deletion still works. Delete keys are left out of the JSON export.

## Lock

Optional PIN and/or biometric lock. The PIN is never stored; only an iterated SHA-256 hash with a per-device salt is kept in secure storage. The app re-locks after 60 seconds in the background.

## Notifications

Off until the person turns them on. Three wording styles: gentle, discreet (never mentions periods, pain or mood, tested) and minimal. Quiet hours are respected, and Quiet Mode skips check-in reminders.

## Export and deletion

- **Export**: a JSON file of everything (including wearable summaries), excluding the AI server address and research delete keys.
- **Delete everything**: first asks any research server to delete what was sent, then deletes the database file, destroys its key, clears the PIN, and returns to the welcome screen. It cannot be undone.
- Turning off chat memory deletes saved chats immediately.

## Young users

Onboarding asks for an age range. If someone says they are under 18, cloud AI cannot be switched on from Settings. Instead, the switch opens a **parent or guardian step** (`src/app/guardian.tsx`) that explains in plain words what cloud AI shares, and asks for the guardian's name, their relation and a confirmation. The agreement (name, relation, date) is stored only on the phone, shown in Settings, and can be withdrawn at any time, which turns cloud AI off straight away.

The check runs again every time a message is sent (`cloudAllowed`), so changing the age range later also pauses cloud AI until a guardian agrees. This is an in-app agreement, not verified identity. If the app is offered to under-13s anywhere, check local law (for example COPPA in the US) before launch.

## Before release

- Write a privacy policy that matches this document and complete Google Play's Data Safety form.
- Decide where the AI backend is hosted and under which jurisdiction, and say so in the policy.
- Have the AI provider's data-retention terms reviewed (zero-retention options may be available on your plan).
- Health Connect: Google Play requires a health apps declaration and a privacy policy that covers Health Connect data before release.
- Research: a study needs ethics approval (an IRB or equivalent) and its own participant information before a study address is built into the app.
