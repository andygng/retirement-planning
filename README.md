# Retirement Planning Tool

A comprehensive retirement planning web application that calculates your target net worth, tracks your progress, and provides personalized recommendations based on your financial situation.

## Features

- **Elegant Onboarding Flow**: Step-by-step question flow with beautiful animations
- **Comprehensive Calculations**: 
  - Target net worth calculation based on retirement income goals
  - Monthly savings compounding with immediate investment
  - One-time payout projections
  - Canadian tax calculations
- **Interactive Dashboard**: 
  - Visual charts showing net worth projections
  - Year-by-year projections table
  - Detailed analysis and recommendations
- **Edit & Recalculate**: Modify inputs and see updated results in real-time

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open your browser and navigate to:
```
http://localhost:5000
```

## Usage

1. **Onboarding**: Answer the questions one at a time:
   - Goals & Ambitions (retirement income, age, withdrawal rate)
   - Current Information (age, income, assets, savings, etc.)
   - One-time payouts (inheritances, equity payouts)

2. **Dashboard**: Review your retirement plan:
   - Summary cards with key metrics
   - Interactive charts showing projections
   - Detailed year-by-year breakdown
   - Actionable recommendations

3. **Edit Inputs**: Click "Edit Inputs" to modify any parameter and recalculate

## Technical Details

- **Backend**: Python Flask
- **Frontend**: HTML/CSS/JavaScript with Chart.js
- **Tax Calculator**: Canadian federal and provincial tax brackets (2024)
- **Calculations**: Monthly compounding for all investments and savings

## Notes

- All calculations assume monthly compounding
- Tax rates are based on 2024 Canadian tax brackets (Ontario provincial rates)
- The tool provides projections and should not be considered as financial advice

