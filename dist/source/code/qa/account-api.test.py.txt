#!/usr/bin/env python3
"""Real HTTP integration tests; isolated temporary SQLite databases, no dependencies."""

import concurrent.futures
import contextlib
import hashlib
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("mosslight_account_api", ROOT / "backend" / "account_api.py")
api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(api)


def packed(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


class AccountHttpTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="mosslight-account-test-")
        self.data = Path(self.temp.name)
        self.logs = io.StringIO()
        self.log_redirect = contextlib.redirect_stderr(self.logs)
        self.log_redirect.__enter__()
        self.start_server()

    def start_server(self):
        self.db = api.Database(self.data)
        self.server = api.ApiServer(("127.0.0.1", 0), self.db)
        self.url = "http://127.0.0.1:" + str(self.server.server_port)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop_server(self):
        self.server.shutdown()
        self.thread.join(timeout=5)
        self.server.server_close()

    def tearDown(self):
        self.stop_server()
        self.log_redirect.__exit__(None, None, None)
        self.temp.cleanup()

    def request(self, method, path, body=None, token=None, headers=None, raw=None):
        request_headers = {"Content-Type": "application/json"}
        if token:
            request_headers["Authorization"] = "Bearer " + token
        request_headers.update(headers or {})
        data = packed(body).encode("utf-8") if body is not None else raw
        request = urllib.request.Request(self.url + path, data=data, method=method, headers=request_headers)
        try:
            response = urllib.request.urlopen(request, timeout=15)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            result = json.loads(response.read())
            self.assertEqual(response.headers["Cache-Control"], "no-store")
            self.assertTrue(response.headers["Content-Type"].startswith("application/json"))
            return response.status, result, response.headers

    def auth(self, username="测试旅人", password="123456"):
        status, result, _ = self.request("POST", "/api/auth", {"username": username, "password": password})
        self.assertEqual(status, 200, result)
        return result

    def save(self, token, changes, revision=None):
        body = {"changes": changes}
        if revision is not None:
            body["baseRevision"] = revision
        return self.request("PUT", "/api/save", body, token)

    def test_health_and_api_only(self):
        self.assertEqual(self.request("GET", "/api/health")[:2], (200, {"ok": True, "version": "2.5.0"}))
        for path in ("/", "/index.html", "/backend/account_api.py", "/api/health?token=secret"):
            self.assertEqual(self.request("GET", path)[0], 404)
        self.assertEqual(self.request("POST", "/api/health", {})[0], 405)

    def test_registration_simple_password_and_generated_credentials(self):
        first = self.auth(password="1234")
        self.assertTrue(first["created"])
        self.assertNotIn("generatedPassword", first)
        self.assertEqual(first["document"], {"storage": {}})
        self.assertEqual(first["revision"], 0)
        self.assertTrue(first["updatedAt"].endswith("Z"))
        self.assertEqual(len(first["token"]), 43)
        automatic = self.auth("", "")
        self.assertRegex(automatic["user"]["username"], r"^player-[a-f0-9]{10}$")
        self.assertRegex(automatic["generatedPassword"], r"^[0-9]{6}$")
        again = self.auth(automatic["user"]["username"], automatic["generatedPassword"])
        self.assertFalse(again["created"])
        self.assertNotIn("generatedPassword", again)
        self.assertEqual(again["user"], automatic["user"])

    def test_existing_account_requires_password(self):
        original = self.auth()
        for password in ("", "654321"):
            status, body, _ = self.request("POST", "/api/auth", {"username": "测试旅人", "password": password})
            self.assertEqual(status, 401, body)
            self.assertNotIn("token", body)
        again = self.auth()
        self.assertEqual(again["user"], original["user"])
        self.assertNotEqual(again["token"], original["token"])

    def test_simultaneous_registration_cannot_replace_account(self):
        barrier = threading.Barrier(2)

        def register(_index):
            barrier.wait(timeout=5)
            return self.request("POST", "/api/auth", {"username": "race", "password": "1234"})

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(register, range(2)))
        self.assertEqual([item[0] for item in results], [200, 200])
        self.assertEqual(sorted(item[1]["created"] for item in results), [False, True])
        self.assertEqual(results[0][1]["user"], results[1][1]["user"])
        self.assertEqual(self.auth("race", "1234")["user"], results[0][1]["user"])

    def test_unicode_and_validation(self):
        first = self.auth("旅行者✨")
        self.assertEqual(first["user"]["username"], "旅行者✨")
        normalized = self.auth("Ａlpha")
        self.assertEqual(self.auth("alpha")["user"], normalized["user"])
        for username in ("a b", "a\nb", "a\u200bb", "旅" * 25, 123):
            self.assertEqual(self.request("POST", "/api/auth", {"username": username, "password": "1234"})[0], 400)
        for password in ("123", 1234, "x" * 257):
            self.assertEqual(self.request("POST", "/api/auth", {"username": "new", "password": password})[0], 400)

    def test_account_isolation_and_restart_recovery(self):
        first, second = self.auth("one"), self.auth("two")
        self.assertEqual(self.save(first["token"], {"mosslight-run-2d": '{"chapter":2}'})[0], 200)
        self.assertEqual(self.request("GET", "/api/me", token=second["token"])[1]["document"]["storage"], {})
        self.stop_server()
        self.start_server()
        restored = self.request("GET", "/api/me", token=first["token"])
        self.assertEqual(restored[0], 200)
        self.assertEqual(restored[1]["document"]["storage"], {"mosslight-run-2d": '{"chapter":2}'})
        self.assertEqual(self.auth("one")["user"], first["user"])

    def test_concurrent_modes_patch_without_overwriting(self):
        account = self.auth()
        barrier = threading.Barrier(2)

        def write(mode):
            barrier.wait(timeout=5)
            return self.save(account["token"], {"mosslight-run-" + mode: mode}, 0)

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            results = list(executor.map(write, ("2d", "3d")))
        self.assertEqual([item[0] for item in results], [200, 200])
        current = self.request("GET", "/api/me", token=account["token"])[1]
        self.assertEqual(current["document"]["storage"], {"mosslight-run-2d": "2d", "mosslight-run-3d": "3d"})
        self.assertEqual(current["revision"], 2)
        self.assertEqual(self.save(account["token"], {"mosslight-run-2d": "2d"}, 2)[1]["revision"], 2)
        self.assertEqual(self.save(account["token"], {}, 500)[0], 409)

    def test_progress_union_with_stale_character_and_legacy_saves(self):
        account = self.auth()
        for key in api.PROGRESS_KEYS:
            legacy = {"version": 1, "completed": [True, False, False]}
            dragon = {"version": 2, "completed": [False] * 4,
                      "byCharacter": {"dragon": [False, True, False, False]},
                      "legacyCompleted": [False, False, True, False]}
            claude = {"version": 2, "byCharacter": {"claude": [True, False, False, False]},
                      "legacyCompleted": [False] * 4}
            for progress in (legacy, dragon, claude):
                status, result, _ = self.save(account["token"], {key: packed(progress)}, 0)
                self.assertEqual(status, 200, result)
            actual = json.loads(result["document"]["storage"][key])
            self.assertEqual(actual["byCharacter"]["dragon"], [False, True, False, False])
            self.assertEqual(actual["byCharacter"]["claude"], [True, False, False, False])
            self.assertEqual(actual["legacyCompleted"], [True, False, True, False])
            self.assertEqual(actual["completed"], [True, True, True, False])

    def test_legacy_progress_union(self):
        token = self.auth()["token"]
        key = "mosslight-3d-progress"
        self.save(token, {key: packed({"version": 1, "completed": [True, False, False]})})
        status, result, _ = self.save(token, {key: packed({"version": 1, "completed": [False, True, False]})}, 0)
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(result["document"]["storage"][key]), {"version": 1, "completed": [True, True, False, False]})

    def test_score_max_time_min_last_write_and_null(self):
        token = self.auth()["token"]
        self.save(token, {"mosslight-pixel-best": '{"0":800,"1":900}', "mosslight-best-normal-dragon-3": "30.5",
                          "mosslight-best-0": "70", "mosslight-run-2d": "old"})
        status, result, _ = self.save(token, {"mosslight-pixel-best": '{"0":200,"2":1000}',
                                             "mosslight-best-normal-dragon-3": "44", "mosslight-best-0": "60",
                                             "mosslight-run-2d": "new"}, 0)
        self.assertEqual(status, 200)
        storage = result["document"]["storage"]
        self.assertEqual(json.loads(storage["mosslight-pixel-best"]), {"0": 800, "1": 900, "2": 1000})
        self.assertEqual(storage["mosslight-best-normal-dragon-3"], "30.5")
        self.assertEqual(storage["mosslight-best-0"], "60")
        self.assertEqual(storage["mosslight-run-2d"], "new")
        self.assertNotIn("mosslight-run-2d", self.save(token, {"mosslight-run-2d": None})[1]["document"]["storage"])

    def test_logout_revocation_and_expired_session(self):
        account = self.auth()
        token = account["token"]
        self.assertEqual(self.request("POST", "/api/logout", {}, token)[0], 200)
        self.assertEqual(self.request("GET", "/api/me", token=token)[0], 401)
        self.assertEqual(self.save(token, {})[0], 401)
        token = self.auth()["token"]
        with self.db.connection() as conn:
            conn.execute("UPDATE sessions SET expires_at=0")
        self.assertEqual(self.request("GET", "/api/me", token=token)[0], 401)

    def test_rejected_payloads_and_atomic_failure(self):
        token = self.auth()["token"]
        self.save(token, {"mosslight-run-2d": "keep"})
        for key in ("token", "session", "mosslight-token", "__proto__", "arbitrary"):
            self.assertEqual(self.save(token, {key: "secret"})[0], 400)
        for body in ({}, {"changes": []}, {"changes": {}, "baseRevision": True},
                     {"changes": {}, "baseRevision": -1}, {"changes": {}, "extra": 1},
                     {"changes": {"mosslight-run-2d": {"value": "object"}}}):
            self.assertEqual(self.request("PUT", "/api/save", body, token)[0], 400)
        for value in ('{"version":3}', '{"version":2,"byCharacter":{"other":[]}}',
                      '{"version":2,"byCharacter":{"dragon":[1]}}'):
            self.assertEqual(self.save(token, {"mosslight-run-2d": "replace", "mosslight-3d-progress": value})[0], 400)
        self.assertEqual(self.request("GET", "/api/me", token=token)[1]["document"]["storage"], {"mosslight-run-2d": "keep"})
        for raw in (b"[]", b"{bad}", b'{"username":"a","username":"b"}', br'{"password":"\ud800"}'):
            self.assertEqual(self.request("POST", "/api/auth", raw=raw)[0], 400)
        self.assertEqual(self.request("POST", "/api/auth", raw=b"{}", headers={"Content-Type": "text/plain"})[0], 415)

    def test_invalid_score_and_time_values_are_rejected(self):
        token = self.auth()["token"]
        for value in ('{"0":true}', '{"0":-1}', '{"4":1}', '{"0":1e999}', '{"0":' + '9' * 400 + '}'):
            self.assertEqual(self.save(token, {"mosslight-pixel-best": value})[0], 400)
        for value in ("0", "-1", "nan", "inf", "not-a-time", "1e999"):
            self.assertEqual(self.save(token, {"mosslight-best-normal-claude-0": value})[0], 400)

    def test_value_document_and_request_size_limits(self):
        token = self.auth()["token"]
        self.assertEqual(self.save(token, {"mosslight-run-2d": "x" * (api.MAX_VALUE_BYTES + 1)})[0], 413)
        self.assertEqual(self.save(token, {"mosslight-run-2d": "旅" * (api.MAX_VALUE_BYTES // 3 + 1)})[0], 413)
        changes = {key: "x" * (290 * 1024) for key in ("mosslight-run-2d", "mosslight-run-3d", "mosslight-collection-v2")}
        self.assertEqual(self.save(token, changes)[0], 413)
        self.assertEqual(self.request("GET", "/api/me", token=token)[1]["document"]["storage"], {})
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        try:
            conn.request("POST", "/api/auth", body=b"", headers={"Content-Type": "application/json", "Content-Length": str(api.MAX_BODY_BYTES + 1)})
            response = conn.getresponse()
            self.assertEqual(response.status, 413)
            self.assertEqual(json.loads(response.read())["code"], "request_too_large")
        finally:
            conn.close()

    def test_same_origin_and_proxy_headers(self):
        host = self.url.removeprefix("http://")
        self.assertEqual(self.request("POST", "/api/auth", {}, headers={"Origin": self.url})[0], 200)
        self.assertEqual(self.request("POST", "/api/auth", {}, headers={"Origin": "https://evil.example"})[0], 403)
        self.assertEqual(self.request("POST", "/api/auth", {}, headers={"Origin": self.url, "Sec-Fetch-Site": "cross-site"})[0], 403)
        self.assertEqual(self.request("GET", "/api/health", headers={"Origin": "https://" + host, "X-Forwarded-Proto": "https"})[0], 200)
        self.assertEqual(self.request("GET", "/api/health", headers={"X-Real-IP": "not-an-ip"})[0], 400)
        self.server.allowed_hosts = {"game.example"}
        self.assertEqual(self.request("GET", "/api/health")[0], 403)
        self.assertEqual(self.request("GET", "/api/health", headers={"Host": "game.example"})[0], 200)

    def test_account_bruteforce_rate_limit_cannot_use_x_forwarded_for(self):
        self.auth("limited")
        for index in range(10):
            status, _, _ = self.request("POST", "/api/auth", {"username": "limited", "password": "wrong"},
                                        headers={"X-Forwarded-For": f"192.0.2.{index}"})
            self.assertEqual(status, 401)
        status, result, headers = self.request("POST", "/api/auth", {"username": "limited", "password": "123456"})
        self.assertEqual(status, 429, result)
        self.assertGreater(int(headers["Retry-After"]), 0)

    def test_registration_rate_limit(self):
        for index in range(10):
            self.auth("limited-create-" + str(index))
        self.assertEqual(self.request("POST", "/api/auth", {"username": "eleventh", "password": "1234"})[0], 429)

    def test_hashed_secrets_backup_and_private_logs(self):
        password = "246813579-test-secret"
        account = self.auth("backup-user", password)
        self.save(account["token"], {"mosslight-run-3d": "checkpoint"})
        with self.db.connection() as conn:
            user = conn.execute("SELECT * FROM users").fetchone()
            session = conn.execute("SELECT * FROM sessions").fetchone()
            self.assertEqual(user["password_iterations"], 600_000)
            expected = hashlib.pbkdf2_hmac("sha256", password.encode(), user["password_salt"], 600_000)
            self.assertEqual(user["password_hash"], expected)
            self.assertEqual(session["token_hash"], hashlib.sha256(account["token"].encode()).hexdigest())
        backup = self.data / "backups" / "snapshot.sqlite3"
        env = dict(os.environ, MOSSLIGHT_DATA_DIR=str(self.data))
        result = subprocess.run([sys.executable, str(ROOT / "backend" / "account_api.py"), "--backup", str(backup)],
                                env=env, capture_output=True, text=True, timeout=15)
        self.assertEqual(result.returncode, 0, result.stderr)
        with contextlib.closing(sqlite3.connect(backup)) as restored:
            storage = json.loads(restored.execute("SELECT storage_json FROM users").fetchone()[0])
            self.assertEqual(storage, {"mosslight-run-3d": "checkpoint"})
            self.assertEqual(restored.execute("PRAGMA integrity_check").fetchone()[0], "ok")
            self.assertEqual(restored.execute("SELECT count(*) FROM sessions").fetchone()[0], 1)
        before_hash = hashlib.sha256(backup.read_bytes()).hexdigest()
        duplicate = subprocess.run([sys.executable, str(ROOT / "backend" / "account_api.py"), "--backup", str(backup)],
                                   env=env, capture_output=True, text=True, timeout=15)
        self.assertNotEqual(duplicate.returncode, 0)
        self.assertEqual(hashlib.sha256(backup.read_bytes()).hexdigest(), before_hash)
        for _ in range(2):
            daily = subprocess.run([sys.executable, str(ROOT / "backend" / "account_api.py"), "--backup-daily"],
                                   env=env, capture_output=True, text=True, timeout=15)
            self.assertEqual(daily.returncode, 0, daily.stderr)
        self.assertEqual(len(list((self.data / "backups").glob("daily-*.sqlite3"))), 2)
        self.assertFalse(list((self.data / "backups").glob("*.partial-*")))
        for path in self.data.glob("account.sqlite3*"):
            content = path.read_bytes()
            self.assertNotIn(password.encode(), content)
            self.assertNotIn(account["token"].encode(), content)
        self.assertNotIn(password, self.logs.getvalue())
        self.assertNotIn(account["token"], self.logs.getvalue())
        self.assertNotIn("checkpoint", self.logs.getvalue())


if __name__ == "__main__":
    unittest.main(verbosity=2)
