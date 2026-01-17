"""
Canadian Tax Calculator for Retirement Income
Uses 2024 federal and provincial tax brackets (Ontario as default)
"""

# 2024 Federal Tax Brackets (Canada)
FEDERAL_BRACKETS = [
    (0, 55867, 0.15),
    (55867, 111733, 0.205),
    (111733, 173205, 0.26),
    (173205, 246752, 0.29),
    (246752, float('inf'), 0.33)
]

# 2024 Ontario Provincial Tax Brackets
ONTARIO_BRACKETS = [
    (0, 51446, 0.0505),
    (51446, 102894, 0.0915),
    (102894, 150000, 0.1116),
    (150000, 220000, 0.1216),
    (220000, float('inf'), 0.1316)
]

# Basic Personal Amount (2024)
FEDERAL_BASIC_PERSONAL_AMOUNT = 15705
ONTARIO_BASIC_PERSONAL_AMOUNT = 11865

def calculate_tax(income: float, brackets: list, basic_personal_amount: float) -> float:
    """
    Calculate tax based on income and tax brackets
    
    Args:
        income: Annual taxable income
        brackets: List of (min, max, rate) tuples
        basic_personal_amount: Basic personal exemption amount
    
    Returns:
        Total tax payable
    """
    if income <= 0:
        return 0
    
    tax = 0
    for min_income, max_income, rate in brackets:
        if income <= min_income:
            break
        bracket_income = min(income, max_income) - min_income
        tax += bracket_income * rate
    
    lowest_rate = brackets[0][2]
    basic_personal_credit = basic_personal_amount * lowest_rate
    return max(0, tax - basic_personal_credit)

def calculate_canadian_tax_rate(annual_income: float) -> float:
    """
    Calculate effective tax rate for retirement income in Canada
    
    Args:
        annual_income: Annual retirement income
    
    Returns:
        Effective tax rate as a decimal (0.0 to 1.0)
    """
    if annual_income <= 0:
        return 0.0
    
    # Calculate federal tax
    federal_tax = calculate_tax(annual_income, FEDERAL_BRACKETS, FEDERAL_BASIC_PERSONAL_AMOUNT)
    
    # Calculate provincial tax (Ontario)
    ontario_tax = calculate_tax(annual_income, ONTARIO_BRACKETS, ONTARIO_BASIC_PERSONAL_AMOUNT)
    
    # Total tax
    total_tax = federal_tax + ontario_tax
    
    # Effective tax rate
    effective_rate = total_tax / annual_income
    
    return min(effective_rate, 1.0)  # Cap at 100%

def calculate_after_tax_income(annual_income: float) -> float:
    """
    Calculate after-tax income from pre-tax income
    
    Args:
        annual_income: Pre-tax annual income
    
    Returns:
        After-tax annual income
    """
    if annual_income <= 0:
        return 0.0
    
    tax_rate = calculate_canadian_tax_rate(annual_income)
    return annual_income * (1 - tax_rate)

def calculate_pre_tax_income_needed(after_tax_income: float) -> float:
    """
    Calculate pre-tax income needed to achieve desired after-tax income
    Uses iterative approach since tax rate depends on income level
    
    Args:
        after_tax_income: Desired after-tax annual income
    
    Returns:
        Required pre-tax annual income
    """
    if after_tax_income <= 0:
        return 0.0
    
    # Start with a guess (assuming ~25% tax rate)
    guess = after_tax_income / 0.75
    
    # Iterate to find the correct pre-tax income
    for _ in range(10):  # Max 10 iterations
        calculated_after_tax = calculate_after_tax_income(guess)
        if abs(calculated_after_tax - after_tax_income) < 1.0:  # Within $1
            return guess
        # Adjust guess
        difference = after_tax_income - calculated_after_tax
        guess += difference / (1 - calculate_canadian_tax_rate(guess))
    
    return guess
