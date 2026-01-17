"""
Core financial calculations for retirement planning
"""
from typing import Dict, List, Any
from models import RetirementInputs
from tax_calculator import calculate_pre_tax_income_needed, calculate_canadian_tax_rate

def calculate_target_net_worth(
    ideal_retirement_income: float,
    withdrawal_rate: float
) -> float:
    """
    Calculate target net worth needed for retirement
    
    Args:
        ideal_retirement_income: Desired monthly after-tax retirement income
        withdrawal_rate: Annual withdrawal rate as decimal (e.g., 0.04 for 4%)
    
    Returns:
        Target net worth required
    """
    # Convert monthly income to annual
    annual_after_tax_income = ideal_retirement_income * 12
    
    # Calculate pre-tax income needed (accounting for Canadian taxes)
    pre_tax_income = calculate_pre_tax_income_needed(annual_after_tax_income)
    
    # Target net worth = pre-tax income / withdrawal rate
    target_net_worth = pre_tax_income / withdrawal_rate
    
    return target_net_worth

def project_current_assets(
    current_assets: float,
    cagr: float,
    months_until_retirement: int
) -> float:
    """
    Project current assets forward with monthly compounding
    
    Args:
        current_assets: Current asset value
        cagr: Annual growth rate as decimal
        months_until_retirement: Number of months until retirement
    
    Returns:
        Projected asset value at retirement
    """
    monthly_rate = (1 + cagr) ** (1/12) - 1
    return current_assets * (1 + monthly_rate) ** months_until_retirement

def project_monthly_savings(
    monthly_savings: float,
    cagr: float,
    months_until_retirement: int
) -> float:
    """
    Project future value of monthly savings contributions
    Each month's contribution compounds from the month it's saved
    
    Args:
        monthly_savings: Monthly savings amount
        cagr: Annual growth rate as decimal
        months_until_retirement: Number of months until retirement
    
    Returns:
        Total future value of all monthly savings contributions
    """
    if monthly_savings <= 0 or months_until_retirement <= 0:
        return 0.0
    
    monthly_rate = (1 + cagr) ** (1/12) - 1
    
    # Future value of annuity formula
    # FV = PMT * (((1 + r)^n - 1) / r)
    if monthly_rate == 0:
        return monthly_savings * months_until_retirement
    else:
        return monthly_savings * (((1 + monthly_rate) ** months_until_retirement - 1) / monthly_rate)

def project_payouts(
    payouts: List[Dict[str, Any]],
    cagr: float,
    current_age: int,
    retirement_age: int
) -> float:
    """
    Project one-time payouts forward to retirement age
    
    Args:
        payouts: List of {'amount': float, 'year': int} where year is the age at which payout is received
        cagr: Annual growth rate as decimal
        current_age: Current age
        retirement_age: Retirement age
    
    Returns:
        Total value of all payouts at retirement age
    """
    total = 0.0
    monthly_rate = (1 + cagr) ** (1/12) - 1
    
    for payout in payouts:
        amount = float(payout['amount'])
        payout_age = int(payout['year'])  # 'year' field actually stores the age
        
        # Calculate months from payout age to retirement
        years_until_retirement = retirement_age - payout_age
        months_until_retirement = years_until_retirement * 12
        
        if months_until_retirement > 0:
            total += amount * (1 + monthly_rate) ** months_until_retirement
        elif months_until_retirement == 0:
            total += amount
    
    return total

def calculate_year_by_year_projection(
    inputs: RetirementInputs
) -> List[Dict[str, Any]]:
    """
    Generate year-by-year projection from current age to retirement age
    
    Args:
        inputs: RetirementInputs object
    
    Returns:
        List of year projections with net worth, savings, etc.
    """
    years_until_retirement = inputs.ideal_retirement_age - inputs.current_age
    months_until_retirement = years_until_retirement * 12
    monthly_rate = (1 + inputs.cagr) ** (1 / 12) - 1
    target_net_worth = calculate_target_net_worth(
        inputs.ideal_retirement_income,
        inputs.withdrawal_rate
    )
    
    projections: List[Dict[str, Any]] = []
    existing_assets_value = inputs.current_asset_values
    contribution_value = 0.0
    payout_value = 0.0
    
    # Map each month offset to the payout amount received at that point
    payout_schedule: Dict[int, float] = {}
    for payout in inputs.payouts:
        payout_age = int(payout['year'])
        if payout_age > inputs.ideal_retirement_age:
            continue
        amount = float(payout['amount'])
        months_from_start = (payout_age - inputs.current_age) * 12
        if 0 <= months_from_start <= months_until_retirement:
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
            'gap': total_net_worth - target_net_worth
        })
    
    # Initial state before any new contributions
    append_projection(inputs.current_age)
    
    for month in range(1, months_until_retirement + 1):
        if month in payout_schedule:
            payout_value += payout_schedule[month]
        
        if inputs.monthly_savings > 0:
            contribution_value += inputs.monthly_savings
        
        growth_multiplier = 1 + monthly_rate
        existing_assets_value *= growth_multiplier
        contribution_value *= growth_multiplier
        payout_value *= growth_multiplier
        
        if month % 12 == 0:
            age = inputs.current_age + (month // 12)
            append_projection(age)
    
    return projections

def calculate_retirement_plan(inputs: RetirementInputs) -> Dict[str, Any]:
    """
    Main function to calculate complete retirement plan
    
    Args:
        inputs: RetirementInputs object
    
    Returns:
        Dictionary with all calculation results
    """
    # Calculate target net worth
    target_net_worth = calculate_target_net_worth(
        inputs.ideal_retirement_income,
        inputs.withdrawal_rate
    )
    
    # Calculate months until retirement
    years_until_retirement = inputs.ideal_retirement_age - inputs.current_age
    months_until_retirement = years_until_retirement * 12
    
    # Project current assets
    projected_current_assets = project_current_assets(
        inputs.current_asset_values,
        inputs.cagr,
        months_until_retirement
    )
    
    # Project monthly savings
    projected_savings = project_monthly_savings(
        inputs.monthly_savings,
        inputs.cagr,
        months_until_retirement
    )
    
    # Project payouts
    projected_payouts = project_payouts(
        inputs.payouts,
        inputs.cagr,
        inputs.current_age,
        inputs.ideal_retirement_age
    )
    
    # Total projected net worth
    total_projected_net_worth = projected_current_assets + projected_savings + projected_payouts
    
    # Gap analysis
    gap = total_projected_net_worth - target_net_worth
    gap_percentage = (gap / target_net_worth * 100) if target_net_worth > 0 else 0
    
    # Calculate required monthly savings if there's a shortfall
    required_monthly_savings = inputs.monthly_savings
    if gap < 0:
        # Need to calculate what monthly savings would be needed
        shortfall = abs(gap)
        # Reverse the savings projection to find required monthly amount
        monthly_rate = (1 + inputs.cagr) ** (1/12) - 1
        if monthly_rate > 0:
            # PMT = FV * (r / ((1 + r)^n - 1))
            required_monthly_savings = shortfall * (monthly_rate / ((1 + monthly_rate) ** months_until_retirement - 1))
        else:
            required_monthly_savings = shortfall / months_until_retirement
        required_monthly_savings += inputs.monthly_savings
    
    # Year-by-year projection
    year_by_year = calculate_year_by_year_projection(inputs)
    
    # Calculate retirement tax rate
    # Convert monthly income to annual for tax calculation
    annual_after_tax_income = inputs.ideal_retirement_income * 12
    pre_tax_retirement_income = calculate_pre_tax_income_needed(annual_after_tax_income)
    retirement_tax_rate = calculate_canadian_tax_rate(pre_tax_retirement_income)
    
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
        'retirement_tax_rate': retirement_tax_rate * 100,
        'pre_tax_retirement_income': pre_tax_retirement_income,
        'inputs': inputs.to_dict()
    }
