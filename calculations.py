"""
Core financial calculations for retirement planning
"""
from typing import Dict, List, Any

from models import RetirementInputs
from tax_calculator import (
    calculate_after_tax_income,
    calculate_pre_tax_income_needed,
    calculate_canadian_tax_rate,
)

PROJECTION_END_AGE = 100


def annual_rate_to_monthly(annual_rate: float) -> float:
    """Convert annual growth rate to monthly rate with a safe lower bound."""
    safe_annual_rate = max(annual_rate, -0.999999)
    return (1 + safe_annual_rate) ** (1 / 12) - 1


def calculate_required_retirement_balance(
    monthly_pre_tax_withdrawal: float,
    annual_post_retirement_return: float,
    months_in_retirement: int,
) -> float:
    """
    Required balance at retirement so constant monthly withdrawals can last to the horizon.

    Cash-flow convention matches the simulation:
    withdrawal first, then monthly growth.
    """
    if monthly_pre_tax_withdrawal <= 0 or months_in_retirement <= 0:
        return 0.0

    monthly_rate = annual_rate_to_monthly(annual_post_retirement_return)
    if abs(monthly_rate) < 1e-12:
        return monthly_pre_tax_withdrawal * months_in_retirement

    growth_factor = (1 + monthly_rate) ** months_in_retirement
    annuity_due_factor = ((growth_factor - 1) / monthly_rate) * (1 + monthly_rate)
    if abs(annuity_due_factor) < 1e-12 or abs(growth_factor) < 1e-12:
        return monthly_pre_tax_withdrawal * months_in_retirement

    return monthly_pre_tax_withdrawal * annuity_due_factor / growth_factor


def calculate_sustainable_monthly_withdrawal(
    starting_balance: float,
    annual_post_retirement_return: float,
    months_in_retirement: int,
) -> float:
    """Maximum constant pre-tax monthly withdrawal that depletes to zero at horizon."""
    if starting_balance <= 0 or months_in_retirement <= 0:
        return 0.0

    monthly_rate = annual_rate_to_monthly(annual_post_retirement_return)
    if abs(monthly_rate) < 1e-12:
        return starting_balance / months_in_retirement

    growth_factor = (1 + monthly_rate) ** months_in_retirement
    annuity_due_factor = ((growth_factor - 1) / monthly_rate) * (1 + monthly_rate)
    if abs(annuity_due_factor) < 1e-12:
        return 0.0

    return starting_balance * growth_factor / annuity_due_factor


def calculate_target_net_worth(
    monthly_pre_tax_withdrawal: float,
    annual_post_retirement_return: float,
    months_in_retirement: int,
) -> float:
    """
    Target balance needed at retirement to fund spending through age 100.
    """
    return calculate_required_retirement_balance(
        monthly_pre_tax_withdrawal,
        annual_post_retirement_return,
        months_in_retirement,
    )


def project_current_assets(
    current_assets: float,
    cagr: float,
    months_until_retirement: int
) -> float:
    """Project current assets forward with monthly compounding."""
    monthly_rate = annual_rate_to_monthly(cagr)
    return current_assets * (1 + monthly_rate) ** months_until_retirement


def project_monthly_savings(
    monthly_savings: float,
    cagr: float,
    months_until_retirement: int
) -> float:
    """Project future value of monthly savings contributions."""
    if monthly_savings <= 0 or months_until_retirement <= 0:
        return 0.0

    monthly_rate = annual_rate_to_monthly(cagr)

    # Future value of annuity due (contribution then growth in same month)
    if abs(monthly_rate) < 1e-12:
        return monthly_savings * months_until_retirement

    annuity_factor = ((1 + monthly_rate) ** months_until_retirement - 1) / monthly_rate
    return monthly_savings * annuity_factor * (1 + monthly_rate)


def project_payouts(
    payouts: List[Dict[str, Any]],
    cagr: float,
    current_age: int,
    retirement_age: int
) -> float:
    """Project one-time payouts forward to retirement age."""
    total = 0.0
    monthly_rate = annual_rate_to_monthly(cagr)

    for payout in payouts:
        amount = float(payout['amount'])
        payout_age = int(payout['year'])

        years_until_retirement = retirement_age - payout_age
        months_until_retirement = years_until_retirement * 12

        if months_until_retirement > 0:
            total += amount * (1 + monthly_rate) ** months_until_retirement
        elif months_until_retirement == 0:
            total += amount

    return total


def calculate_year_by_year_projection(
    inputs: RetirementInputs,
    target_net_worth: float,
    monthly_retirement_withdrawal: float,
    post_retirement_cagr: float,
) -> Dict[str, Any]:
    """
    Run one monthly simulation from current age to PROJECTION_END_AGE.

    Pre-retirement growth uses input CAGR.
    Post-retirement growth uses post_retirement_cagr (conservative cap).
    """
    years_until_retirement = inputs.ideal_retirement_age - inputs.current_age
    months_until_retirement = years_until_retirement * 12
    months_until_projection_end = max(0, (PROJECTION_END_AGE - inputs.current_age) * 12)
    pre_retirement_monthly_rate = annual_rate_to_monthly(inputs.cagr)
    post_retirement_monthly_rate = annual_rate_to_monthly(post_retirement_cagr)

    projections: List[Dict[str, Any]] = []
    existing_assets_value = inputs.current_asset_values
    contribution_value = 0.0
    payout_value = 0.0
    depletion_age = None

    payout_schedule: Dict[int, float] = {}
    for payout in inputs.payouts:
        payout_age = int(payout['year'])
        if payout_age > PROJECTION_END_AGE:
            continue

        amount = float(payout['amount'])
        months_from_start = (payout_age - inputs.current_age) * 12
        if 0 <= months_from_start <= months_until_projection_end:
            payout_schedule[months_from_start] = payout_schedule.get(months_from_start, 0.0) + amount

    def append_projection(age: int) -> None:
        total_net_worth = existing_assets_value + contribution_value + payout_value
        projections.append({
            'year': age,
            'age': age,
            'current_assets': existing_assets_value,
            'savings_contributions': contribution_value,
            'payouts_value': payout_value,
            'total_net_worth': total_net_worth,
            'target_net_worth': target_net_worth,
            'gap': total_net_worth - target_net_worth,
        })

    append_projection(inputs.current_age)
    retirement_snapshot = projections[0] if inputs.current_age == inputs.ideal_retirement_age else None

    for month in range(1, months_until_projection_end + 1):
        if month in payout_schedule:
            payout_value += payout_schedule[month]

        if month <= months_until_retirement:
            if inputs.monthly_savings > 0:
                contribution_value += inputs.monthly_savings
            growth_multiplier = 1 + pre_retirement_monthly_rate
        else:
            withdrawal_remaining = monthly_retirement_withdrawal
            if withdrawal_remaining > 0:
                if payout_value >= withdrawal_remaining:
                    payout_value -= withdrawal_remaining
                    withdrawal_remaining = 0.0
                else:
                    withdrawal_remaining -= payout_value
                    payout_value = 0.0

                if contribution_value >= withdrawal_remaining:
                    contribution_value -= withdrawal_remaining
                    withdrawal_remaining = 0.0
                else:
                    withdrawal_remaining -= contribution_value
                    contribution_value = 0.0

                existing_assets_value -= withdrawal_remaining

            growth_multiplier = 1 + post_retirement_monthly_rate

        existing_assets_value *= growth_multiplier
        contribution_value *= growth_multiplier
        payout_value *= growth_multiplier

        if depletion_age is None:
            total_net_worth = existing_assets_value + contribution_value + payout_value
            if total_net_worth < 0:
                depletion_age = inputs.current_age + (month / 12)

        if month % 12 == 0:
            age = inputs.current_age + (month // 12)
            append_projection(age)
            if age == inputs.ideal_retirement_age:
                retirement_snapshot = projections[-1]

    return {
        'projections': projections,
        'retirement_snapshot': retirement_snapshot,
        'projection_end_snapshot': projections[-1] if projections else None,
        'depletion_age': depletion_age,
    }


def calculate_retirement_plan(inputs: RetirementInputs) -> Dict[str, Any]:
    """Main function to calculate complete retirement plan."""
    annual_after_tax_income = inputs.ideal_retirement_income * 12
    pre_tax_retirement_income = calculate_pre_tax_income_needed(annual_after_tax_income)

    years_until_retirement = inputs.ideal_retirement_age - inputs.current_age
    months_until_retirement = years_until_retirement * 12
    months_in_retirement = max(0, (PROJECTION_END_AGE - inputs.ideal_retirement_age) * 12)

    monthly_retirement_withdrawal = pre_tax_retirement_income / 12
    post_retirement_cagr = min(inputs.cagr, inputs.withdrawal_rate)

    # New target: balance required at retirement to fund spending through age 100.
    target_net_worth = calculate_target_net_worth(
        monthly_retirement_withdrawal,
        post_retirement_cagr,
        months_in_retirement,
    )

    projection_results = calculate_year_by_year_projection(
        inputs,
        target_net_worth,
        monthly_retirement_withdrawal,
        post_retirement_cagr,
    )

    year_by_year = projection_results['projections']
    retirement_snapshot = projection_results['retirement_snapshot'] or (year_by_year[-1] if year_by_year else None)
    projection_end_snapshot = projection_results['projection_end_snapshot']

    projected_current_assets = retirement_snapshot['current_assets'] if retirement_snapshot else 0.0
    projected_savings = retirement_snapshot['savings_contributions'] if retirement_snapshot else 0.0
    projected_payouts = retirement_snapshot['payouts_value'] if retirement_snapshot else 0.0
    total_projected_net_worth = retirement_snapshot['total_net_worth'] if retirement_snapshot else 0.0

    gap = total_projected_net_worth - target_net_worth
    gap_percentage = (gap / target_net_worth * 100) if target_net_worth > 0 else 0

    required_monthly_savings = inputs.monthly_savings
    if gap < 0:
        shortfall = abs(gap)
        monthly_rate = annual_rate_to_monthly(inputs.cagr)
        if monthly_rate > 0 and months_until_retirement > 0:
            denominator = (1 + monthly_rate) * ((1 + monthly_rate) ** months_until_retirement - 1)
            required_monthly_savings = shortfall * (monthly_rate / denominator)
        elif months_until_retirement > 0:
            required_monthly_savings = shortfall / months_until_retirement
        else:
            required_monthly_savings = shortfall
        required_monthly_savings += inputs.monthly_savings

    retirement_tax_rate = calculate_canadian_tax_rate(pre_tax_retirement_income)

    sustainable_pre_tax_monthly_income = calculate_sustainable_monthly_withdrawal(
        total_projected_net_worth,
        post_retirement_cagr,
        months_in_retirement,
    )
    sustainable_after_tax_annual_income = calculate_after_tax_income(
        sustainable_pre_tax_monthly_income * 12
    )
    max_sustainable_monthly_income = sustainable_after_tax_annual_income / 12
    income_goal_coverage_ratio = (
        max_sustainable_monthly_income / inputs.ideal_retirement_income
        if inputs.ideal_retirement_income > 0
        else 0.0
    )

    return {
        'target_net_worth': target_net_worth,
        'projected_current_assets': projected_current_assets,
        'projected_savings': projected_savings,
        'projected_payouts': projected_payouts,
        'total_projected_net_worth': total_projected_net_worth,
        'gap': gap,
        'gap_percentage': gap_percentage,
        'required_monthly_savings': required_monthly_savings,
        'current_monthly_savings': inputs.monthly_savings,
        'years_until_retirement': years_until_retirement,
        'months_until_retirement': months_until_retirement,
        'year_by_year': year_by_year,
        'projection_end_age': PROJECTION_END_AGE,
        'net_worth_at_projection_end': projection_end_snapshot['total_net_worth'] if projection_end_snapshot else 0.0,
        'depletion_age': projection_results['depletion_age'],
        'retirement_tax_rate': retirement_tax_rate * 100,
        'pre_tax_retirement_income': pre_tax_retirement_income,
        'post_retirement_growth_rate': post_retirement_cagr * 100,
        'max_sustainable_monthly_income': max_sustainable_monthly_income,
        'max_sustainable_pre_tax_monthly_income': sustainable_pre_tax_monthly_income,
        'income_goal_coverage_ratio': income_goal_coverage_ratio,
        'inputs': inputs.to_dict(),
    }
