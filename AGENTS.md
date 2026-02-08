# AGENTS.md

## Purpose
This is a simple retirement planning web app. It guides a user through a short onboarding questionnaire, calculates a target retirement net worth and projections (using Canadian tax assumptions), then shows a dashboard with charts, recommendations, and an optional AI chat assistant.

## How it works (high level)
- Backend: Flask app in `app.py` with two APIs:
  - `/api/calculate` validates inputs and returns projections.
  - `/api/chat` uses OpenAI to answer questions about the plan.
- Calculations: `calculations.py`, `models.py`, `tax_calculator.py`.
- Frontend: Jinja templates in `templates/` and vanilla JS/CSS in `static/`.
- Data flow: onboarding JS posts inputs -> API -> result stored in `sessionStorage` -> dashboard reads it.

## UX priorities (non-technical user)
- Keep the experience simple, calm, and fast.
- Favor clear language, big readable type, and friendly microcopy.
- Avoid complex features or extra steps.
- Maintain the existing visual direction (soft gradients, glass cards, motion).
- In AI chat, keep user vs assistant messages visually distinct and easy to scan.
- AI responses should be short, plain-language, and avoid noisy markdown headings.

## Technical constraints
- Keep dependencies minimal. Do not add build tools or frameworks.
- Preserve data shape returned by `/api/calculate` (dashboard depends on it).
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
- If changing calculations, explain assumptions in code comments.
