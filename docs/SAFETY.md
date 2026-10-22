# Safety

> **These rules were written by a software engineer from public health guidance. They are not clinically validated. A qualified clinician (gynaecology and mental health) must review every rule and every line of health copy before public release.**

The rules live in `src/engines/safety.ts`. They are deterministic, run before any AI, and are covered by `__tests__/safety.test.ts`. The AI backend runs the same text screen again on the server.

## Pain red flags (`assessPain`)

The highest matching level wins.

| Level | Triggers | What the app says |
| --- | --- | --- |
| **Emergency** | Fainting; sudden (just started) pelvic pain 8+/10; one-sided pelvic pain 7+/10 when pregnancy is possible; very heavy bleeding with dizziness or pain 8+/10 | Call 999 or go to the nearest emergency department; ask someone to stay with you |
| **Urgent** (today) | Very heavy bleeding (soaking a pad or tampon hourly); pelvic pain with fever; pain 9 or 10; dizziness with pain 7+ | Contact a doctor, clinic or urgent care today; seek emergency care if worse |
| **Appointment** | Pain that stops daily life; pain 7+; pain that is getting worse across cycles | Pain like this is not something to simply endure; consider an appointment; the Pain Passport can help explain it |

Safety messages are shown above the Comfort Path, and comfort ideas are never offered *instead of* care.

## Text screening (`screenText`)

English and Bangla patterns for:

- **Crisis**: suicide, self-harm, wanting to die, abuse or being unsafe. Petal answers with a fixed, human-written message, a "Get support now" button and the support screen. Nothing is sent to the cloud.
- **Urgent medical**: the pain red flags above described in words. Petal answers with a fixed urgent-care message.

Pattern matching will miss some phrasings and over-match others. A clinician and native Bangla speakers should review and extend the lists, and the team should plan regular reviews of real (consented, anonymised) misses.

## AI output guard (`guardOutput`)

Applied to every cloud reply, on the server and again on the device. It removes or replaces:

- diagnoses ("you have PCOS / endometriosis / depression")
- medicine names with doses, or dosing instructions
- statements that a day is safe or unsafe for pregnancy, or that the app is contraception
- claims to be human, a doctor or a therapist

The server's system prompt (`server/src/prompt.ts`) sets the same limits for the model itself.

## Crisis resources

| Resource | Number | Status |
| --- | --- | --- |
| Emergency services, Bangladesh | 999 | National emergency number |
| Kaan Pete Roi (emotional support, Bangladesh) | 09612119911 | **Verify before release.** Numbers and hours change; confirm with the organisation directly. |
| Outside Bangladesh | findahelpline.com | International directory |

## Cycle predictions

- Always shown as a date range with a confidence level, never a single "due date".
- Phase estimates are limited or hidden for irregular cycles, hormonal contraception, postpartum, breastfeeding, PCOS and perimenopause.
- The app never says a day is safe or unsafe for sex or pregnancy, and the onboarding and Cycle screens say it is not contraception.

## Pattern Garden

Insights need a minimum amount of data (two cycles, or ten paired days for correlations), are worded as "you logged X more often when Y", show "How did we find this?", and can be marked unhelpful or hidden. Mood is never attributed to hormones.

## Clinician review checklist

1. Every threshold in `assessPain` and the wording of each level.
2. The crisis and urgent text patterns, in both languages.
3. `CRISIS_MESSAGE`, `URGENT_MEDICAL_MESSAGE` and the support screen.
4. Comfort Path items (`COMFORT_ITEMS`) and their "see a doctor if" notes.
5. Meal "why" text and sources (`src/data/meals.ts`).
6. Phase descriptions (`PHASE_COPY` in `cycle.ts`).
7. The AI system prompt.
