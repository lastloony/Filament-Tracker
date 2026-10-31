import io
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.desktop_updates import check_for_updates, UpdateCheckError


class UpdatesTest(unittest.TestCase):
    def release(self, tag, current="0.3.8"):
        with patch("app.desktop_updates.urlopen", return_value=io.BytesIO(json.dumps({"tag_name": tag}).encode())):
            return check_for_updates(current)

    def test_numeric_version_ordering(self):
        self.assertTrue(self.release("v0.3.10")["update_available"])
        self.assertFalse(self.release("v0.3.8")["update_available"])
        self.assertFalse(self.release("v0.3.7")["update_available"])

    def test_no_published_release(self):
        with patch("app.desktop_updates.urlopen", side_effect=HTTPError("url", 404, "Missing", {}, None)):
            result = check_for_updates("0.3.8")
        self.assertFalse(result["has_release"])
        self.assertFalse(result["update_available"])

    def test_network_and_rate_limit_errors(self):
        for error in (URLError("offline"), TimeoutError(), HTTPError("url", 403, "Limited", {}, None)):
            with self.subTest(error=type(error).__name__), patch("app.desktop_updates.urlopen", side_effect=error):
                with self.assertRaises(UpdateCheckError):
                    check_for_updates("0.3.8")

    def test_invalid_release(self):
        for data in (b"not json", b"[]", b'{}', b'{"tag_name":"v0.4.0-beta"}',
                     b'{"tag_name":"v0.4.0","prerelease":true}'):
            with self.subTest(data=data), patch("app.desktop_updates.urlopen", return_value=io.BytesIO(data)):
                with self.assertRaises(UpdateCheckError):
                    check_for_updates("0.3.8")


if __name__ == "__main__":
    unittest.main()
