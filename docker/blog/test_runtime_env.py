"""주소 변경 중 자격증명·DB·인증 옵션 보존을 확인함."""
import unittest
from runtime_env import local_mongodb_uri


class RuntimeEnvironmentTest(unittest.TestCase):
    def test_preserves_encoded_credentials_database_and_options(self):
        uri = "mongodb://reader:p%40ss%3Aword@old-container:27017/blog?authSource=admin&retryWrites=false"
        self.assertEqual(local_mongodb_uri(uri, "127.0.0.1:27017"),
                         "mongodb://reader:p%40ss%3Aword@127.0.0.1:27017/blog?authSource=admin&retryWrites=false")

    def test_handles_uri_without_credentials(self):
        self.assertEqual(local_mongodb_uri("mongodb://old-host/blog", "127.0.0.1:27017"),
                         "mongodb://127.0.0.1:27017/blog")

    def test_refuses_srv_and_does_not_expose_secret(self):
        with self.assertRaisesRegex(ValueError, "표준 MongoDB URI") as caught:
            local_mongodb_uri("mongodb+srv://reader:private-password@host/blog", "127.0.0.1:27017")
        self.assertNotIn("private-password", str(caught.exception))

    def test_refuses_external_override(self):
        with self.assertRaises(ValueError):
            local_mongodb_uri("mongodb://old/blog", "outside:27017")


if __name__ == "__main__":
    unittest.main()
