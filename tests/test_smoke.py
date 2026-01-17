import unittest

from app import app


class AppSmokeTest(unittest.TestCase):
    def test_app_responds(self):
        client = app.test_client()
        response = client.get("/")
        self.assertEqual(response.status_code, 200)


if __name__ == "__main__":
    unittest.main()
