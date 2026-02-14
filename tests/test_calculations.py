import unittest

from calculations import calculate_retirement_plan
from models import RetirementInputs, validate_inputs


class RetirementCalculationTests(unittest.TestCase):
    def make_inputs(self, **overrides):
        payload = {
            'ideal_retirement_income': 5000,
            'ideal_retirement_age': 65,
            'withdrawal_rate': 4,
            'current_age': 40,
            'current_asset_values': 200000,
            'cagr': 5,
            'monthly_savings': 1500,
            'payouts': []
        }
        payload.update(overrides)
        return RetirementInputs.from_dict(payload)

    @staticmethod
    def snapshot_for_age(result, age):
        return next(row for row in result['year_by_year'] if row['age'] == age)

    def test_projection_runs_to_age_100(self):
        result = calculate_retirement_plan(self.make_inputs())
        self.assertEqual(result['year_by_year'][0]['age'], 40)
        self.assertEqual(result['year_by_year'][-1]['age'], 100)
        self.assertEqual(result['projection_end_age'], 100)

    def test_savings_stop_after_retirement(self):
        result = calculate_retirement_plan(self.make_inputs(
            current_age=60,
            ideal_retirement_age=65,
            cagr=0,
            current_asset_values=0,
            monthly_savings=1000,
            ideal_retirement_income=500,
        ))
        at_retirement = self.snapshot_for_age(result, 65)
        one_year_after = self.snapshot_for_age(result, 66)

        self.assertEqual(at_retirement['savings_contributions'], 60000)
        self.assertLess(one_year_after['savings_contributions'], at_retirement['savings_contributions'])

    def test_post_retirement_withdrawals_reduce_balance(self):
        result = calculate_retirement_plan(self.make_inputs(
            current_age=64,
            ideal_retirement_age=65,
            cagr=0,
            current_asset_values=100000,
            monthly_savings=0,
            ideal_retirement_income=3000,
        ))
        at_retirement = self.snapshot_for_age(result, 65)
        one_year_after = self.snapshot_for_age(result, 66)

        self.assertLess(one_year_after['total_net_worth'], at_retirement['total_net_worth'])

    def test_negative_balances_and_depletion_age(self):
        result = calculate_retirement_plan(self.make_inputs(
            current_age=64,
            ideal_retirement_age=65,
            cagr=0,
            current_asset_values=10000,
            monthly_savings=0,
            ideal_retirement_income=10000,
        ))

        self.assertLess(result['net_worth_at_projection_end'], 0)
        self.assertIsNotNone(result['depletion_age'])
        self.assertGreaterEqual(result['depletion_age'], 65)

    def test_post_retirement_payout_is_included(self):
        payload = {
            'ideal_retirement_income': 1,
            'ideal_retirement_age': 65,
            'withdrawal_rate': 4,
            'current_age': 60,
            'current_asset_values': 0,
            'cagr': 0,
            'monthly_savings': 0,
            'payouts': [{'amount': 50000, 'year': 75}],
        }
        self.assertEqual(validate_inputs(payload), [])

        result = calculate_retirement_plan(RetirementInputs.from_dict(payload))
        age_74 = self.snapshot_for_age(result, 74)
        age_75 = self.snapshot_for_age(result, 75)
        self.assertGreater(age_75['total_net_worth'], age_74['total_net_worth'] + 40000)

    def test_retirement_snapshot_matches_top_level_totals(self):
        result = calculate_retirement_plan(self.make_inputs(
            current_age=60,
            ideal_retirement_age=65,
            cagr=6,
            current_asset_values=100000,
            monthly_savings=1000,
            payouts=[{'amount': 100000, 'year': 65}],
        ))
        retirement = self.snapshot_for_age(result, 65)

        self.assertAlmostEqual(retirement['current_assets'], result['projected_current_assets'])
        self.assertAlmostEqual(retirement['savings_contributions'], result['projected_savings'])
        self.assertAlmostEqual(retirement['payouts_value'], result['projected_payouts'])
        self.assertAlmostEqual(retirement['total_net_worth'], result['total_projected_net_worth'])

    def test_withdrawal_rate_changes_target_when_it_caps_post_retirement_return(self):
        low_withdrawal = calculate_retirement_plan(self.make_inputs(withdrawal_rate=2, cagr=12))
        high_withdrawal = calculate_retirement_plan(self.make_inputs(withdrawal_rate=8, cagr=12))

        self.assertGreater(low_withdrawal['target_net_worth'], high_withdrawal['target_net_worth'])
        self.assertLess(low_withdrawal['gap'], high_withdrawal['gap'])

        low_retirement = self.snapshot_for_age(low_withdrawal, 65)
        high_retirement = self.snapshot_for_age(high_withdrawal, 65)
        self.assertAlmostEqual(low_retirement['total_net_worth'], high_retirement['total_net_worth'])

    def test_withdrawal_rate_has_no_target_effect_when_cagr_is_lower(self):
        lower_rate = calculate_retirement_plan(self.make_inputs(withdrawal_rate=4, cagr=3))
        higher_rate = calculate_retirement_plan(self.make_inputs(withdrawal_rate=8, cagr=3))

        self.assertAlmostEqual(lower_rate['target_net_worth'], higher_rate['target_net_worth'], places=6)

    def test_max_sustainable_income_metric_is_returned(self):
        result = calculate_retirement_plan(self.make_inputs(
            current_age=45,
            ideal_retirement_age=50,
            current_asset_values=3000000,
            monthly_savings=0,
            cagr=7,
            withdrawal_rate=4,
            ideal_retirement_income=10000,
        ))

        self.assertIn('max_sustainable_monthly_income', result)
        self.assertIn('income_goal_coverage_ratio', result)
        self.assertGreater(result['max_sustainable_monthly_income'], 0)

    def test_payout_age_validation_bounds(self):
        base = {
            'ideal_retirement_income': 4000,
            'ideal_retirement_age': 65,
            'withdrawal_rate': 4,
            'current_age': 40,
            'current_asset_values': 100000,
            'cagr': 5,
            'monthly_savings': 1000,
            'payouts': [],
        }

        invalid_too_early = {**base, 'payouts': [{'amount': 1000, 'year': 40}]}
        invalid_too_late = {**base, 'payouts': [{'amount': 1000, 'year': 101}]}
        valid = {**base, 'payouts': [{'amount': 1000, 'year': 41}]}

        self.assertTrue(any('after current age' in err for err in validate_inputs(invalid_too_early)))
        self.assertTrue(any('100 or less' in err for err in validate_inputs(invalid_too_late)))
        self.assertEqual(validate_inputs(valid), [])


if __name__ == '__main__':
    unittest.main()
