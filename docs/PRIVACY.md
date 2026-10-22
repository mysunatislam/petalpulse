# Privacy

Petal & Pulse is **local-first**. There is no account, no analytics, no ads SDK and no cloud sync in Stage 1.

## What stays on the phone

Everything the person logs: periods, symptoms, moods, journal text, pain, chats (only if memory is on), preferences. It lives in an SQLCipher-encrypted SQLite database. The 256-bit key is random per install and kept in the Android Keystore through `expo-secure-store`.

`android.allowBackup` is `false`, so the data is not copied into Google cloud backups. Location and advertising-ID permissions are explicitly blocked in `app.json`.

## What can leave the phone, and only by choice

| What | When | Where it goes |
| --- | --- | --- |
| A chat message plus a minimal context | Only if the person turns on cloud replies in Settings, accepts the consent screen, and an AI server address is set | The project's own Petal AI backend, which forwards it to Claude and keeps nothing |
| Cycle day and phase estimate | Only if "Use my cycle context" is on | Same |
| Recent moods and pain logs | Only if "Use my mood and pain context" is on | Same |
| Earlier messages | Only if "Petal remembers our chats" is on | Same |
| A PDF health summary or JSON export | Only when the person taps Share or Export | Wherever they choose to send it |

Cloud AI is **off by default**. Turning off Petal AI also revokes cloud consent. Without any cloud consent, Petal answers with an on-device companion and nothing is sent.

## Lock

Optional PIN and/or biometric lock. The PIN is never stored; only an iterated SHA-256 hash with a per-device salt is kept in secure storage. The app re-locks after 60 seconds in the background.

## Notifications

Off until the person turns them on. Three wording styles: gentle, discreet (never mentions periods, pain or mood, tested) and minimal. Quiet hours are respected, and Quiet Mode skips check-in reminders.

## Export and deletion

- **Export**: a JSON file of everything, excluding the AI server address.
- **Delete everything**: deletes the database file, destroys its key, clears the PIN, and returns to the welcome screen. It cannot be undone.
- Turning off chat memory deletes saved chats immediately.

## Young users

Onboarding asks for an age range. Under-18s are identified (`isMinor`) so extra protections can be applied. See [STATUS.md](STATUS.md): parental-consent flows for cloud AI are not built yet, and cloud AI should stay unavailable to minors until they are.

## Before release

- Write a privacy policy that matches this document and complete Google Play's Data Safety form.
- Decide where the AI backend is hosted and under which jurisdiction, and say so in the policy.
- Have the AI provider's data-retention terms reviewed (zero-retention options may be available on your plan).
