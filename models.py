from typing import List, Optional, Dict, Any

class RetirementInputs:
    """Data model for retirement planning inputs"""
    
    def __init__(
        self,
        ideal_retirement_income: float,
        ideal_retirement_age: int,
        withdrawal_rate: float,
        current_age: int,
        current_monthly_income: float,
        current_asset_values: float,
        cagr: float,
        monthly_savings: float,
        working_tax_rate: float,
        payouts: List[Dict[str, Any]]
    ):
        self.ideal_retirement_income = ideal_retirement_income
        self.ideal_retirement_age = ideal_retirement_age
        self.withdrawal_rate = withdrawal_rate
        self.current_age = current_age
        self.current_monthly_income = current_monthly_income
        self.current_asset_values = current_asset_values
        self.cagr = cagr
        self.monthly_savings = monthly_savings
        self.working_tax_rate = working_tax_rate
        self.payouts = payouts  # List of {'amount': float, 'year': int}
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RetirementInputs':
        """Create RetirementInputs from dictionary"""
        return cls(
            ideal_retirement_income=float(data['ideal_retirement_income']),
            ideal_retirement_age=int(data['ideal_retirement_age']),
            withdrawal_rate=float(data['withdrawal_rate']) / 100,  # Convert percentage to decimal
            current_age=int(data['current_age']),
            current_monthly_income=float(data['current_monthly_income']),
            current_asset_values=float(data['current_asset_values']),
            cagr=float(data['cagr']) / 100,  # Convert percentage to decimal
            monthly_savings=float(data['monthly_savings']),
            working_tax_rate=float(data['working_tax_rate']) / 100,  # Convert percentage to decimal
            payouts=data.get('payouts', [])
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            'ideal_retirement_income': self.ideal_retirement_income,
            'ideal_retirement_age': self.ideal_retirement_age,
            'withdrawal_rate': self.withdrawal_rate * 100,
            'current_age': self.current_age,
            'current_monthly_income': self.current_monthly_income,
            'current_asset_values': self.current_asset_values,
            'cagr': self.cagr * 100,
            'monthly_savings': self.monthly_savings,
            'working_tax_rate': self.working_tax_rate * 100,
            'payouts': self.payouts
        }

def validate_inputs(data: Dict[str, Any]) -> List[str]:
    """Validate input data and return list of errors"""
    errors = []
    
    required_fields = [
        'ideal_retirement_income',
        'ideal_retirement_age',
        'withdrawal_rate',
        'current_age',
        'current_monthly_income',
        'current_asset_values',
        'cagr',
        'monthly_savings',
        'working_tax_rate'
    ]
    
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required field: {field}")
    
    if errors:
        return errors
    
    # Validate numeric values
    try:
        ideal_retirement_income = float(data['ideal_retirement_income'])
        ideal_retirement_age = int(data['ideal_retirement_age'])
        withdrawal_rate = float(data['withdrawal_rate'])
        current_age = int(data['current_age'])
        current_monthly_income = float(data['current_monthly_income'])
        current_asset_values = float(data['current_asset_values'])
        cagr = float(data['cagr'])
        monthly_savings = float(data['monthly_savings'])
        working_tax_rate = float(data['working_tax_rate'])
        
        if ideal_retirement_income <= 0:
            errors.append("Ideal retirement income must be positive")
        if ideal_retirement_age <= current_age:
            errors.append("Ideal retirement age must be greater than current age")
        if withdrawal_rate <= 0 or withdrawal_rate > 100:
            errors.append("Withdrawal rate must be between 0 and 100")
        if current_age < 0:
            errors.append("Current age must be non-negative")
        if current_monthly_income < 0:
            errors.append("Current monthly income must be non-negative")
        if current_asset_values < 0:
            errors.append("Current asset values must be non-negative")
        if cagr < -100 or cagr > 100:
            errors.append("CAGR must be between -100 and 100")
        if monthly_savings < 0:
            errors.append("Monthly savings must be non-negative")
        if working_tax_rate < 0 or working_tax_rate > 100:
            errors.append("Working tax rate must be between 0 and 100")
        
        # Validate payouts if provided
        if 'payouts' in data:
            payouts = data['payouts']
            if not isinstance(payouts, list):
                errors.append("Payouts must be a list")
            else:
                for i, payout in enumerate(payouts):
                    if not isinstance(payout, dict):
                        errors.append(f"Payout {i+1} must be a dictionary")
                    elif 'amount' not in payout or 'year' not in payout:
                        errors.append(f"Payout {i+1} must have 'amount' and 'year' fields")
                    else:
                        if float(payout['amount']) < 0:
                            errors.append(f"Payout {i+1} amount must be non-negative")
                        payout_age = int(payout['year'])  # 'year' field stores the age
                        if payout_age <= current_age:
                            errors.append(f"Payout {i+1} age must be after current age")
    
    except (ValueError, TypeError) as e:
        errors.append(f"Invalid numeric value: {str(e)}")
    
    return errors

