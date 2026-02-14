# AGENTS.md

## Purpose
This is a retirement planning web app for non-technical users. It collects a short onboarding questionnaire, calculates retirement readiness, and shows projections and recommendations on a dashboard with an optional AI chat assistant.

## How it works (high level)
- Backend: Flask app in `app.py` with two APIs:
  - `/api/calculate` validates inputs and returns projections.
  - `/api/chat` uses OpenAI to answer questions about the plan.
- Calculations: `calculations.py`, `models.py`, `tax_calculator.py`.
- Frontend: Jinja templates in `templates/` and vanilla JS/CSS in `static/`.
- Data flow: onboarding JS posts inputs -> API -> result stored in `sessionStorage` -> dashboard reads it.

## Current calculation model
- Projection horizon is fixed from `current_age` through age `100`.
- Pre-retirement phase:
  - Monthly savings contributions are added and compounded.
  - Existing assets and payouts compound monthly using input CAGR.
- Post-retirement phase:
  - Monthly savings contributions stop.
  - Monthly withdrawals are applied to fund the target retirement income (after-tax goal converted to pre-tax monthly withdrawal).
  - Post-retirement growth uses `min(CAGR, withdrawal_rate)`.
- Target net worth is defined as the retirement balance required to fund withdrawals through age 100 under the same post-retirement assumptions.
- Payout ages are valid after current age up to age `100`.
- Response includes:
  - `projection_end_age`
  - `net_worth_at_projection_end`
  - `depletion_age` (nullable)
  - `post_retirement_growth_rate`
  - `max_sustainable_monthly_income`

## UX priorities (non-technical user)
- Keep the experience simple, calm, and fast.
- Favor clear language, big readable type, and friendly microcopy.
- Avoid complex features or extra steps.
- Maintain the existing visual direction (soft gradients, glass cards, motion).
- In AI chat, keep user vs assistant messages visually distinct and easy to scan.
- AI responses should be short, plain-language, and easy to scan with a short takeaway + simple bullets when helpful.
- Use light emphasis (`**bold**`) for key figures, avoid noisy markdown headings/tables/code blocks, and avoid wall-of-text replies.

## Technical constraints
- Keep dependencies minimal. Do not add build tools or frameworks.
- Preserve existing `/api/calculate` fields; additive changes are preferred.
- Currency conversion is display-only; base calculations are CAD.
- Tax logic assumes Canada (Ontario, 2024 brackets).

## Mobile support policy
- Mobile work is phone-only (target `max-width: 640px`, with a narrow-phone fallback at `max-width: 390px`).
- Prioritize iPhone Safari behavior first, then smoke-check Android Chrome.
- Prefer CSS-first solutions; keep JS viewport logic minimal and reusable.
- Preserve desktop and tablet layout/behavior unless a change is explicitly requested.

## Run locally
- Install: `pip install -r requirements.txt`
- Start: `python app.py`
- App runs on `http://localhost:5001`
- `/api/chat` requires `OPENAI_API_KEY`.

## When changing things
- Small, focused changes only; no large refactors.
- Keep JS in `static/js` and CSS in `static/css`.
- Ensure layouts stay mobile-friendly.
- If changing calculations, explain assumptions in concise code comments where needed.
