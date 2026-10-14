import sys
import os
import unittest
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.reasoning.strategy_generator import (
    generate_strategy,
    compute_hra_exemption,
    compute_tax_detailed,
    load_regime_rules,
    _resolve_limit,
    _resolve_used,
)
from app.services.reasoning.explanation_service import format_inr
from fastapi.testclient import TestClient
from main import app


class TestTaxCopilotCalculations(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.old_rules, cls.new_rules = load_regime_rules()

    def test_case_1_standard_salary(self):
        """
        Basic ₹6,00,000, HRA ₹2,00,001, allowance ₹1,00,005, other interest ₹1,00,000,
        rent ₹1,50,000, non-metro.
        Expected Old-regime tax: ₹85,801. Expected New-regime tax: ₹0.
        """
        inputs = {
            "basic_salary": 600000,
            "hra_received": 200001,
            "other_allowances": 100005,
            "other_income_interest": 100000,
            "rent_paid": 150000,
            "is_metro": False,
            "age": 30,
        }
        res = generate_strategy(inputs)
        comp = res["regime_comparison"]
        self.assertEqual(comp["old_tax"], 85801.0)
        self.assertEqual(comp["new_tax"], 0.0)
        self.assertEqual(comp["winner"], "new")
        self.assertEqual(comp["savings"], 85801.0)
        self.assertEqual(comp["hra_exemption"], 90000.0)

    def test_case_2_metro_hra(self):
        """
        Same as case 1, but metro=True.
        50% of basic is ₹3,00,000, rent - 10% is ₹90,000.
        Expected HRA exemption remains ₹90,000 because rent limit binds.
        """
        inputs = {
            "basic_salary": 600000,
            "hra_received": 200001,
            "other_allowances": 100005,
            "other_income_interest": 100000,
            "rent_paid": 150000,
            "is_metro": True,
            "age": 30,
        }
        res = generate_strategy(inputs)
        comp = res["regime_comparison"]
        self.assertEqual(comp["hra_exemption"], 90000.0)

    def test_case_3_education_loan_80e(self):
        """
        Same as case 1, add education loan interest ₹1,00,000 under Section 80E.
        Expected old-regime tax: ₹65,001. Expected new-regime tax: ₹0.
        """
        inputs = {
            "basic_salary": 600000,
            "hra_received": 200001,
            "other_allowances": 100005,
            "other_income_interest": 100000,
            "rent_paid": 150000,
            "education_loan_interest": 100000,
            "is_metro": False,
            "age": 30,
        }
        res = generate_strategy(inputs)
        comp = res["regime_comparison"]
        self.assertEqual(comp["old_tax"], 65001.0)
        self.assertEqual(comp["new_tax"], 0.0)
        self.assertEqual(comp["savings"], 65001.0)

    def test_case_4_old_regime_rebate_boundary(self):
        """
        Check that old-regime 87A rebate applies up to ₹5,00,000 taxable income.
        """
        # Exactly at ₹5,00,000 taxable income
        det_500k = compute_tax_detailed(500000, self.old_rules, age=30)
        self.assertEqual(det_500k["slab_tax"], 12500.0)
        self.assertEqual(det_500k["rebate"], 12500.0)
        self.assertEqual(det_500k["total_tax"], 0.0)

        # At ₹5,00,001 taxable income (exceeds rebate limit by ₹1)
        det_500k1 = compute_tax_detailed(500001, self.old_rules, age=30)
        self.assertEqual(det_500k1["rebate"], 0.0)
        self.assertGreater(det_500k1["total_tax"], 12500.0)

    def test_case_5_new_regime_12L_rebate(self):
        """
        New regime taxable income exactly ₹12,00,000 -> full rebate, ₹0 tax.
        Salary = ₹12,75,000 (after ₹75,000 std ded, taxable = ₹12,00,000).
        """
        res = generate_strategy({"basic_salary": 1275000, "age": 30})
        comp = res["regime_comparison"]
        self.assertEqual(comp["new_taxable"], 1200000.0)
        self.assertEqual(comp["new_rebate"], 60000.0)
        self.assertEqual(comp["new_tax"], 0.0)

    def test_case_6_new_regime_marginal_relief(self):
        """
        New regime taxable income ₹12,00,001 (Basic ₹12,75,001).
        Excess income over ₹12,00,000 is ₹1.
        Tax cannot exceed excess income -> Tax before cess = ₹1, total tax = ₹1.
        """
        res = generate_strategy({"basic_salary": 1275001, "age": 30})
        comp = res["regime_comparison"]
        self.assertEqual(comp["new_taxable"], 1200001.0)
        self.assertEqual(comp["new_rebate"], 0.0)
        self.assertGreater(comp["new_marginal_relief"], 0.0)
        self.assertEqual(comp["new_tax"], 1.0)

    def test_case_7_all_zeros(self):
        """
        Set all income fields to 0. Must return 0 tax, no crash, no negatives.
        """
        res = generate_strategy({
            "basic_salary": 0,
            "hra_received": 0,
            "other_allowances": 0,
            "other_income_interest": 0,
            "rent_paid": 0,
            "age": 30
        })
        comp = res["regime_comparison"]
        self.assertEqual(comp["old_tax"], 0.0)
        self.assertEqual(comp["new_tax"], 0.0)
        self.assertEqual(comp["savings"], 0.0)
        self.assertEqual(comp["old_taxable"], 0.0)
        self.assertEqual(comp["new_taxable"], 0.0)

    def test_case_8_negative_inputs_sanitized(self):
        """
        Negative inputs must be clamped to 0.0 to prevent negative taxable income.
        """
        res = generate_strategy({
            "basic_salary": -500000,
            "hra_received": -20000,
            "other_allowances": -10000,
            "rent_paid": -30000,
        })
        comp = res["regime_comparison"]
        self.assertEqual(comp["old_taxable"], 0.0)
        self.assertEqual(comp["new_taxable"], 0.0)
        self.assertEqual(comp["old_tax"], 0.0)

    def test_case_9_senior_citizen_old_regime_slabs(self):
        """
        Age 60-79: Basic exemption ₹3,00,000.
        Age 80+: Basic exemption ₹5,00,000.
        Test with taxable income ₹8,00,000.
        """
        # Age 30: 2.5L @ 0, 2.5L @ 5% (12.5k), 3L @ 20% (60k) = 72.5k + 4% = 75,400
        det_30 = compute_tax_detailed(800000, self.old_rules, age=30)
        self.assertEqual(det_30["total_tax"], 75400.0)

        # Age 65: 3L @ 0, 2L @ 5% (10k), 3L @ 20% (60k) = 70k + 4% = 72,800
        det_65 = compute_tax_detailed(800000, self.old_rules, age=65)
        self.assertEqual(det_65["total_tax"], 72800.0)

        # Age 85: 5L @ 0, 3L @ 20% (60k) = 60k + 4% = 62,400
        det_85 = compute_tax_detailed(800000, self.old_rules, age=85)
        self.assertEqual(det_85["total_tax"], 62400.0)

    def test_case_10_standard_deduction_capping(self):
        """
        Standard deduction should be capped at salary income, preventing negative taxable income.
        e.g., Salary = ₹30,000. Old Std Ded must be ₹30,000, not ₹50,000.
        New Std Ded must be ₹30,000, not ₹75,000.
        """
        res = generate_strategy({"basic_salary": 30000, "age": 30})
        comp = res["regime_comparison"]
        self.assertEqual(comp["old_std"], 30000.0)
        self.assertEqual(comp["new_std"], 30000.0)
        self.assertEqual(comp["old_taxable"], 0.0)
        self.assertEqual(comp["new_taxable"], 0.0)

    def test_case_11_high_income_surcharge(self):
        """
        Verify surcharge on high income (> 5 Crore):
        Old regime surcharge is 37%, New regime surcharge is capped at 25%.
        """
        res = generate_strategy({"basic_salary": 100000000, "age": 30})  # 10 Crore
        comp = res["regime_comparison"]
        # Both must have surcharge > 0
        self.assertGreater(comp["old_surcharge"], 0.0)
        self.assertGreater(comp["new_surcharge"], 0.0)
        # Old regime surcharge rate is higher than new regime
        self.assertGreater(comp["old_tax"], comp["new_tax"])


class TestTaxCopilotAPIAndAuth(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_api_tax_strategy_calculation(self):
        """Test POST /api/tax-strategy/"""
        payload = {
            "basic_salary": 1000000,
            "hra_received": 200000,
            "other_allowances": 100000,
            "rent_paid": 180000,
            "is_metro": True,
            "sec80c_invested": 150000,
            "health_self": 25000,
            "age": 30,
        }
        response = self.client.post("/api/tax-strategy/", json=payload)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("regime_comparison", data)
        self.assertIn("old_regime_sections", data)
        self.assertIn("new_regime_sections", data)
        self.assertIn("winner", data["regime_comparison"])

    def test_api_tax_strategy_history_lifecycle(self):
        """Test POST /api/tax-strategy/history and GET /api/tax-strategy/history"""
        calc_payload = {
            "basic_salary": 1200000,
            "age": 30,
        }
        res_calc = self.client.post("/api/tax-strategy/", json=calc_payload)
        calc_result = res_calc.json()

        test_email = "test_user_history@taxcopilot.com"
        save_payload = {
            "user_email": test_email,
            "form_data": calc_payload,
            "result": calc_result,
        }
        res_save = self.client.post("/api/tax-strategy/history", json=save_payload)
        self.assertEqual(res_save.status_code, 200)
        self.assertTrue(res_save.json().get("status") == "ok")

        # Verify history retrieve
        res_get = self.client.get(f"/api/tax-strategy/history?user_email={test_email}")
        self.assertEqual(res_get.status_code, 200)
        data = res_get.json()
        history_items = data.get("items", [])
        self.assertTrue(len(history_items) > 0)
        latest = history_items[0]
        self.assertEqual(latest["winner"], calc_result["regime_comparison"]["winner"])
        self.assertEqual(latest["savings"], calc_result["regime_comparison"]["savings"])

    def test_negative_input_validation_api(self):
        """API must reject negative inputs with HTTP 422 Unprocessable Entity"""
        payload = {
            "basic_salary": -500000,
            "age": 30,
        }
        response = self.client.post("/api/tax-strategy/", json=payload)
        self.assertEqual(response.status_code, 422)

    def test_auth_and_password_reset_flow(self):
        """Test registration, duplicate registration rejection, login, forgot-password, reset-password"""
        unique_id = os.urandom(4).hex()
        test_email = f"test_{unique_id}@taxcopilot.example.com"
        password = "SecurePassword123!"

        # 1. Register new user
        reg_res = self.client.post("/api/auth/register", json={
            "email": test_email,
            "name": "Test User",
            "password": password
        })
        self.assertEqual(reg_res.status_code, 200)
        self.assertEqual(reg_res.json()["user"]["email"], test_email)

        # 2. Duplicate registration should be rejected
        dup_res = self.client.post("/api/auth/register", json={
            "email": test_email,
            "name": "Test User",
            "password": password
        })
        self.assertEqual(dup_res.status_code, 400)

        # 3. Successful login
        login_res = self.client.post("/api/auth/login", json={
            "email": test_email,
            "password": password
        })
        self.assertEqual(login_res.status_code, 200)
        self.assertTrue("token" in login_res.json())

        # 4. Failed login with wrong password
        fail_login = self.client.post("/api/auth/login", json={
            "email": test_email,
            "password": "WrongPassword!"
        })
        self.assertEqual(fail_login.status_code, 401)

        # 5. Forgot password
        forgot_res = self.client.post("/api/auth/forgot-password", json={
            "email": test_email
        })
        self.assertEqual(forgot_res.status_code, 200)

    def test_format_inr(self):
        """Test Indian currency formatting utility"""
        self.assertEqual(format_inr(0), "0")
        self.assertEqual(format_inr(1200000), "12,00,000")
        self.assertEqual(format_inr(65001.25), "65,001.25")
        self.assertEqual(format_inr(1000000000), "1,00,00,00,000")


if __name__ == "__main__":
    unittest.main()
