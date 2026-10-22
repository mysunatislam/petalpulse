# Database schema

The schema is declared once in `src/data/schema.ts` (`TABLES`) and used both to create SQLite tables and to map rows to typed objects. `SCHEMA_VERSION = 1`.

On Android the database is an **SQLCipher-encrypted** SQLite file. Column type `json` is stored as TEXT and parsed on read; `bool` is stored as INTEGER 0/1. All dates are ISO `YYYY-MM-DD` strings in the user's local calendar, and timestamps are ISO 8601.

| Table | Key | Columns | Notes |
| --- | --- | --- | --- |
| `kv` | `key` | `value` (json) | Two rows: `profile` (name, age range, cycle answers, onboarding time, demo flag) and `settings` (consent toggles, Care Mode, notifications, lock, language). |
| `period_days` | `date` | `flow` (spotting, light, medium, heavy, very_heavy) | One row per day of bleeding or spotting. Periods and cycles are derived, not stored. |
| `day_logs` | `date` | `symptoms` (json), `energy`, `sleepHours`, `activity`, `need`, `bbt`, `lhTest`, `mucus`, `notes` | Optional daily details. Every field can be empty. |
| `mood_entries` | `id` | `date`, `createdAt`, `mood`, `intensity`, `tags` (json), `text`, `confirmedThemes` (json) | Mood Mirror check-ins and journal entries. Themes are saved only if the person confirms them. Indexed on `date`. |
| `pain_episodes` | `id` | `date`, `createdAt`, `regions` (json), `intensity` (0 to 10), `qualities` (json), `onset`, `pattern`, `impact`, `otherSymptoms` (json), `heavyBleeding` (bool), `tried` (json), `helped` (json), `notes` | Pain Passport entries. Indexed on `date`. |
| `chat_messages` | `id` | `createdAt`, `role`, `text`, `safety`, `suggestions` (json) | Stored only while "Petal remembers our chats" is on. Turning it off deletes them. |
| `insight_feedback` | `id` | `status` (helpful, dismissed), `updatedAt` | The person's response to each Pattern Garden insight. |
| `favorites` | `id` | `createdAt` | Saved meals and comfort ideas. |

## Derived data (not stored)

Periods, cycle lengths, predictions, phases, confidence, insights and the pain summary are computed from the tables above every time, by the engines. That keeps the stored data minimal and means a correction (e.g. removing a wrongly logged day) fixes every derived view at once.

## Migrations

There is one schema version so far. To add a column, add it to `TABLES`, bump `SCHEMA_VERSION`, and add an `ALTER TABLE` step keyed on the old version in `backend.native.ts` (not written yet, since nothing needs migrating).

## Export and deletion

- **Export** (Settings → Your data) writes every table and the profile/settings to a JSON file, without the AI endpoint address.
- **Delete everything** closes the database, deletes the file and its encryption key, clears secure storage (PIN), and returns to the welcome screen.
