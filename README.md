# Retirement Planning Tool

A retirement planning web app that calculates the retirement balance you need, projects your path to retirement, and shows how your balance behaves through age 100.

## Features

- **Guided onboarding flow** with simple, one-question-at-a-time inputs.
- **Core planning calculations**:
  - Retirement target based on sustaining your spending from retirement to age 100
  - Target-income withdrawals in retirement (after-tax goal converted to required pre-tax cash flow)
  - Post-retirement growth assumption uses `min(CAGR, withdrawal_rate)` for a conservative cap
  - Monthly compounding for existing assets, savings, and one-time payouts
  - Canadian tax calculations (federal + Ontario)
- **Interactive dashboard**:
  - Net worth chart through age 100 with retirement marker
  - Gap at retirement against the age-100 sustainability target
  - Sustainable spending insight (max monthly after-tax income at retirement)
- **AI Plan Copilot**:
  - Distinct user and assistant chat bubbles for easier scanning
  - Short, plain-language responses with a brief takeaway, simple bullets, and bold key figures for readability
- **Edit and recalculate** without restarting onboarding.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open your browser:
```text
http://localhost:5001
```

## Usage

1. **Onboarding**: Enter your retirement income goal, retirement age, withdrawal-rate assumption, current assets, growth assumption, monthly savings, and optional one-time payouts.
2. **Dashboard**: Review retirement readiness at retirement age, projected balance through age 100, and sustainable spending.
3. **Edit Inputs**: Use **Edit Inputs** to change assumptions and instantly recalculate.

## Technical Details

- **Backend**: Python + Flask
- **Frontend**: HTML/CSS/JavaScript + Chart.js
- **Tax model**: Canadian 2024 federal + Ontario brackets
- **Projection horizon**: fixed at age 100
- **`/api/calculate` fields include**:
  - `projection_end_age`
  - `net_worth_at_projection_end`
  - `depletion_age` (first age where balance drops below 0, or `null`)
  - `post_retirement_growth_rate`
  - `max_sustainable_monthly_income`

## Mobile Support Policy

- Mobile enhancements are phone-only (`max-width: 640px`) with a narrow-phone fallback (`max-width: 390px`).
- iPhone Safari is the primary mobile target, with Android Chrome as secondary validation.
- Mobile implementation is CSS-first; JS viewport branching should stay minimal.
- Desktop and tablet behavior should remain unchanged unless explicitly requested.

## Notes

- Values are nominal (no inflation adjustment).
- Pre-retirement growth uses the input CAGR.
- Post-retirement growth uses `min(CAGR, withdrawal_rate)`.
- Payouts are allowed after retirement, up to age 100.
- The tool provides projections and is not financial advice.
