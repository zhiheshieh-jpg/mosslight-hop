#!/usr/bin/env python3
"""Mosslight account API. Python standard library only; no static-file serving."""

from __future__ import annotations

import argparse
import collections
import contextlib
import datetime as dt
import hashlib
import hmac
import ipaddress
import json
import math
import os
from pathlib import Path
import re
import secrets
import socket
import sqlite3
import sys
import threading
import time
import unicodedata
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

VERSION = "2.5.1"
SESSION_SECONDS = 90 * 24 * 60 * 60
PASSWORD_ITERATIONS = 600_000
MAX_BODY_BYTES = 900 * 1024
MAX_VALUE_BYTES = 300 * 1024
MAX_DOCUMENT_BYTES = 800 * 1024
CHARACTERS = ("dragon", "claude")
PROGRESS_KEYS = frozenset(("mosslight-pixel-progress", "mosslight-3d-progress"))
TIME_KEYS = frozenset(
    [f"mosslight-best-{i}" for i in range(3)]
    + [f"mosslight-best-normal-{character}-{i}" for character in CHARACTERS for i in range(4)]
)
ALLOWED_KEYS = frozenset(
    (
        "mosslight-pixel-progress", "mosslight-pixel-best", "mosslight-pixel-god",
        "mosslight-pixel-character", "mosslight-3d-progress", "mosslight-3d-god",
        "mosslight-3d-character", "mosslight-collection-v2", "mosslight-run-2d",
        "mosslight-run-3d", "mosslight-secret-god-unlocked",
    )
) | TIME_KEYS


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message
        self.retry_after = retry_after


def invalid(message: str = "请求内容格式不正确。") -> ApiError:
    return ApiError(400, "invalid_request", message)


def encode_json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":"))


def parse_json(text: str) -> object:
    def reject_constant(_value):
        raise ValueError("Non-finite JSON number")

    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError("Duplicate JSON key")
            result[key] = value
        return result

    try:
        return json.loads(text, parse_constant=reject_constant, object_pairs_hook=unique_object)
    except (ValueError, RecursionError) as exc:
        raise invalid("请求包含无效的 JSON。") from exc


def utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def username_parts(value: object) -> tuple[str | None, str | None]:
    if value is None or value == "":
        return None, None
    if not isinstance(value, str):
        raise invalid("账号名称必须是文字。")
    name = unicodedata.normalize("NFKC", value)
    if len(name) > 24 or any(char.isspace() or unicodedata.category(char).startswith("C") for char in name):
        raise invalid("账号名称最多 24 个字符，不能包含空白或控制字符。")
    return name, name.casefold()


def validate_password(value: object) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str) or not 4 <= len(value) <= 256:
        raise invalid("密码长度应为 4 至 256 个字符。")
    try:
        value.encode("utf-8")
    except UnicodeError as exc:
        raise invalid("密码包含无效字符。") from exc
    return value


def hash_password(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("ascii")).hexdigest()


def flags(value: object) -> list[bool]:
    if value is None:
        return [False] * 4
    if not isinstance(value, list) or len(value) > 4 or any(type(item) is not bool for item in value):
        raise invalid("通关记录格式不正确。")
    return value + [False] * (4 - len(value))


def normalize_progress(value: str) -> dict:
    data = parse_json(value)
    if not isinstance(data, dict) or type(data.get("version")) is not int or data["version"] not in (1, 2):
        raise invalid("通关记录版本不正确。")
    legacy = flags(data.get("completed") if data["version"] == 1 else data.get("legacyCompleted"))
    # Legacy saves predate chapter four and have no character-specific credit.
    legacy[3] = False
    characters = data.get("byCharacter", {}) if data["version"] == 2 else {}
    if not isinstance(characters, dict) or set(characters) - set(CHARACTERS):
        raise invalid("角色通关记录格式不正确。")
    return {"version": data["version"], "legacyCompleted": legacy,
            "byCharacter": {name: flags(characters.get(name)) for name in CHARACTERS}}


def merge_progress(old: str | None, incoming: str) -> str:
    right = normalize_progress(incoming)
    left = normalize_progress(old) if old is not None else normalize_progress('{"version":1}')
    legacy = [a or b for a, b in zip(left["legacyCompleted"], right["legacyCompleted"])]
    by_character = {name: [a or b for a, b in zip(left["byCharacter"][name], right["byCharacter"][name])]
                    for name in CHARACTERS}
    completed = [legacy[i] or any(by_character[name][i] for name in CHARACTERS) for i in range(4)]
    if left["version"] == right["version"] == 1:
        return encode_json({"version": 1, "completed": completed})
    return encode_json({"version": 2, "completed": completed, "byCharacter": by_character,
                        "legacyCompleted": legacy})


def best_scores(value: str) -> dict:
    data = parse_json(value)
    if not isinstance(data, dict) or set(data) - {"0", "1", "2", "3"}:
        raise invalid("最高分记录格式不正确。")
    for score in data.values():
        if type(score) not in (int, float) or score < 0 or score > 1e12 or not math.isfinite(score):
            raise invalid("最高分记录格式不正确。")
    return data


def best_time(value: str) -> float:
    try:
        result = float(value)
    except (ValueError, OverflowError) as exc:
        raise invalid("最佳时间记录格式不正确。") from exc
    if not math.isfinite(result) or result <= 0 or result > 1e12:
        raise invalid("最佳时间记录格式不正确。")
    return result


def merge_value(key: str, old: str | None, incoming: str) -> str:
    if key == "mosslight-secret-god-unlocked":
        if parse_json(incoming) is not True:
            raise invalid("存档值格式不正确。")
        return "true"
    if key in PROGRESS_KEYS:
        return merge_progress(old, incoming)
    if key == "mosslight-pixel-best":
        left, right = best_scores(old) if old is not None else {}, best_scores(incoming)
        return encode_json({chapter: max(left.get(chapter, 0), right.get(chapter, 0))
                            for chapter in sorted(left.keys() | right.keys())})
    if key in TIME_KEYS:
        number = best_time(incoming)
        return old if old is not None and best_time(old) <= number else incoming
    return incoming


class RateLimiter:
    """Bounded process-local windows. All remote identity comes from the loopback proxy."""

    def __init__(self):
        self.lock = threading.Lock()
        self.buckets: dict[tuple[str, str], collections.deque] = {}

    def check(self, kind: str, identity: str, limit: int, window: int, *, record: bool = True):
        now = time.monotonic()
        with self.lock:
            if len(self.buckets) >= 10_000:
                self.buckets = {key: values for key, values in self.buckets.items()
                                if values and values[-1] > now - 3600}
                if len(self.buckets) >= 10_000 and (kind, identity) not in self.buckets:
                    raise ApiError(429, "rate_limited", "请求过于频繁，请稍后再试。", 60)
            queue = self.buckets.setdefault((kind, identity), collections.deque())
            while queue and queue[0] <= now - window:
                queue.popleft()
            if len(queue) >= limit:
                wait = max(1, math.ceil(queue[0] + window - now))
                raise ApiError(429, "rate_limited", "尝试次数过多，请稍后再试。", wait)
            if record:
                queue.append(now)

    def failed_login(self, account: str):
        self.check("failed-account", account, 10, 900)


class Database:
    def __init__(self, data_dir: Path):
        data_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        self.path = data_dir / "account.sqlite3"
        with self.connection() as conn:
            if conn.execute("PRAGMA user_version").fetchone()[0] not in (0, 1):
                raise RuntimeError("Unsupported database schema version; data was not changed")
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
                    password_salt BLOB NOT NULL, password_hash BLOB NOT NULL,
                    password_iterations INTEGER NOT NULL,
                    storage_json TEXT NOT NULL DEFAULT '{}', revision INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS sessions (
                    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
                PRAGMA user_version=1;
            """)
        if os.name == "posix":
            self.path.chmod(0o600)

    @contextlib.contextmanager
    def connection(self):
        conn = sqlite3.connect(self.path, timeout=15, isolation_level=None)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=15000")
        conn.execute("PRAGMA synchronous=FULL")
        try:
            yield conn
        finally:
            conn.close()

    @staticmethod
    def document(row) -> dict:
        return {"user": {"id": row["id"], "username": row["username"]},
                "document": {"storage": json.loads(row["storage_json"])},
                "revision": row["revision"], "updatedAt": row["updated_at"]}

    def authenticate(self, body: dict, ip: str, limits: RateLimiter) -> dict:
        if set(body) - {"username", "password"}:
            raise invalid("账号请求包含未知字段。")
        name, account = username_parts(body.get("username"))
        supplied_password = validate_password(body.get("password"))
        limits.check("auth-ip", ip, 60, 900)
        if account:
            limits.check("failed-account", account, 10, 900, record=False)
        with self.connection() as conn:
            row = conn.execute("SELECT * FROM users WHERE username_key=?", (account,)).fetchone() if account else None
        if row is None:
            limits.check("create-ip", ip, 10, 3600)
            name = name or "player-" + secrets.token_hex(5)
            account = name.casefold()
            generated = supplied_password is None
            password = supplied_password or f"{secrets.randbelow(1_000_000):06d}"
            salt = secrets.token_bytes(24)
            password_digest = hash_password(password, salt)
        else:
            generated = False
            password = supplied_password
        created = False
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                # Recheck inside the write transaction: simultaneous registration cannot replace an account.
                row = conn.execute("SELECT * FROM users WHERE username_key=?", (account,)).fetchone()
                if row is None:
                    now = utc_now()
                    user_id = secrets.token_hex(16)
                    conn.execute("""INSERT INTO users
                        (id,username,username_key,password_salt,password_hash,password_iterations,created_at,updated_at)
                        VALUES (?,?,?,?,?,?,?,?)""",
                        (user_id, name, account, salt, password_digest, PASSWORD_ITERATIONS, now, now))
                    row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
                    created = True
                else:
                    # An omitted password must never authenticate an existing user, including a registration race.
                    candidate = hashlib.pbkdf2_hmac("sha256", (supplied_password or "").encode("utf-8"),
                                                   row["password_salt"], row["password_iterations"])
                    if supplied_password is None or not hmac.compare_digest(candidate, row["password_hash"]):
                        limits.failed_login(account)
                        raise ApiError(401, "invalid_credentials", "账号已存在，密码不正确。")
                token = secrets.token_urlsafe(32)
                now_seconds = int(time.time())
                conn.execute("DELETE FROM sessions WHERE expires_at<=?", (now_seconds,))
                conn.execute("INSERT INTO sessions VALUES (?,?,?,?)",
                             (token_hash(token), row["id"], now_seconds, now_seconds + SESSION_SECONDS))
                result = self.document(row)
                result.update(token=token, created=created, message="账号已创建并登录。" if created else "登录成功。")
                if created and generated:
                    result["generatedPassword"] = password
                conn.execute("COMMIT")
                return result
            except BaseException:
                conn.execute("ROLLBACK")
                raise

    @staticmethod
    def session_user(conn, digest: str):
        row = conn.execute("""SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id
            WHERE token_hash=? AND expires_at>?""", (digest, int(time.time()))).fetchone()
        if row is None:
            raise ApiError(401, "unauthorized", "登录已失效，请重新登录。")
        return row

    def me(self, digest: str) -> dict:
        with self.connection() as conn:
            return self.document(self.session_user(conn, digest))

    def save(self, digest: str, body: dict) -> dict:
        if set(body) - {"changes", "baseRevision"} or not isinstance(body.get("changes"), dict):
            raise invalid("存档请求必须包含 changes 对象。")
        base = body.get("baseRevision")
        if "baseRevision" in body and (type(base) is not int or base < 0):
            raise invalid("存档版本号不正确。")
        changes = body["changes"]
        if set(changes) - ALLOWED_KEYS:
            raise invalid("存档包含不允许的键。")
        if changes.get("mosslight-secret-god-unlocked", "true") is None:
            raise invalid("存档值格式不正确。")
        for value in changes.values():
            if value is not None and not isinstance(value, str):
                raise invalid("存档值必须是文字或 null。")
            if value is not None and len(value.encode("utf-8")) > MAX_VALUE_BYTES:
                raise ApiError(413, "value_too_large", "单项存档过大，最多 300 KB。")
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            try:
                row = self.session_user(conn, digest)
                if base is not None and base > row["revision"]:
                    raise ApiError(409, "future_revision", "存档版本不一致，请先重新读取云端存档。")
                was_stale = base is not None and base < row["revision"]
                storage = json.loads(row["storage_json"])
                for key, value in changes.items():
                    if value is None:
                        storage.pop(key, None)
                    else:
                        storage[key] = merge_value(key, storage.get(key), value)
                encoded = encode_json(storage)
                if len(encode_json({"storage": storage}).encode("utf-8")) > MAX_DOCUMENT_BYTES:
                    raise ApiError(413, "document_too_large", "云端存档总大小最多 800 KB。")
                if encoded != row["storage_json"]:
                    conn.execute("UPDATE users SET storage_json=?,revision=revision+1,updated_at=? WHERE id=?",
                                 (encoded, utc_now(), row["id"]))
                    row = conn.execute("SELECT * FROM users WHERE id=?", (row["id"],)).fetchone()
                result = self.document(row)
                result.pop("user")
                result.update(message="云端存档已同步。", merged=was_stale)
                conn.execute("COMMIT")
                return result
            except BaseException:
                conn.execute("ROLLBACK")
                raise

    def logout(self, digest: str) -> dict:
        with self.connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token_hash=?", (digest,))
        return {"ok": True, "message": "已退出登录。"}

    def backup(self, destination: Path):
        destination = destination.resolve()
        if destination == self.path.resolve() or destination.exists():
            raise ValueError("Backup destination must be a new file")
        destination.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = destination.with_name(destination.name + ".partial-" + secrets.token_hex(6))
        try:
            # SQLite's online backup includes committed WAL data while the API remains running.
            with self.connection() as source:
                target = sqlite3.connect(temporary)
                try:
                    source.backup(target)
                    if target.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
                        raise RuntimeError("Backup integrity check failed")
                finally:
                    target.close()
            if os.name == "posix":
                temporary.chmod(0o600)
            # A hard link publishes only the verified complete file and never replaces an old backup.
            os.link(temporary, destination)
        finally:
            temporary.unlink(missing_ok=True)


class ApiServer(ThreadingHTTPServer):
    daemon_threads = True
    request_queue_size = 64
    allow_reuse_address = True

    def __init__(self, address, database: Database, allowed_hosts: set[str] | None = None):
        if not ipaddress.ip_address(address[0]).is_loopback:
            raise ValueError("The API must bind to a loopback address")
        self.database, self.limits = database, RateLimiter()
        self.allowed_hosts = allowed_hosts or set()
        self.capacity = threading.BoundedSemaphore(32)
        super().__init__(address, ApiHandler)

    def process_request(self, request, client_address):
        if not self.capacity.acquire(blocking=False):
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self.capacity.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.capacity.release()


class ApiHandler(BaseHTTPRequestHandler):
    server_version = "MosslightAPI/" + VERSION
    sys_version = ""
    protocol_version = "HTTP/1.0"

    def setup(self):
        super().setup()
        self.connection.settimeout(10)

    def log_message(self, _format, *_args):
        # The default HTTP log can contain a token in the URL. Never log request text or body.
        pass

    def log_request(self, code="-", size="-"):
        method = self.command if self.command in ("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD") else "OTHER"
        sys.stderr.write(f"api {method} {code}\n")

    def send_error(self, code, message=None, explain=None):
        self.respond(code, {"ok": False, "code": "http_error", "message": "HTTP 请求格式不正确。"})

    def respond(self, status: int, body: dict, retry_after: int | None = None):
        payload = encode_json(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Connection", "close")
        if retry_after is not None:
            self.send_header("Retry-After", str(retry_after))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(payload)

    def client_ip(self) -> str:
        peer = ipaddress.ip_address(self.client_address[0])
        # Nginx connects over loopback and overwrites X-Real-IP. X-Forwarded-For is never trusted.
        forwarded = self.headers.get("X-Real-IP") if peer.is_loopback else None
        if forwarded:
            try:
                return str(ipaddress.ip_address(forwarded))
            except ValueError:
                raise invalid("代理客户端地址格式不正确。")
        return str(peer)

    def check_origin(self):
        hosts = self.headers.get_all("Host", [])
        if len(hosts) != 1 or not hosts[0] or any(char.isspace() for char in hosts[0]):
            raise invalid("请求主机格式不正确。")
        host = hosts[0].lower()
        if self.server.allowed_hosts and host not in self.server.allowed_hosts:
            raise ApiError(403, "origin_rejected", "请求来源不受信任。")
        if self.headers.get("Sec-Fetch-Site", "").lower() == "cross-site":
            raise ApiError(403, "origin_rejected", "请从游戏页面访问账号服务。")
        origins = self.headers.get_all("Origin", [])
        if not origins:
            return  # CLI and same-origin GET requests may omit Origin.
        if len(origins) != 1:
            raise ApiError(403, "origin_rejected", "请求来源不受信任。")
        origin = urlsplit(origins[0])
        forwarded_proto = self.headers.get("X-Forwarded-Proto")
        proto = forwarded_proto if ipaddress.ip_address(self.client_address[0]).is_loopback and forwarded_proto in ("http", "https") else "http"
        if origin.scheme != proto or origin.netloc.lower() != host or origin.path or origin.query or origin.fragment or origin.username:
            raise ApiError(403, "origin_rejected", "请从游戏页面访问账号服务。")

    def read_json(self, optional: bool = False) -> dict:
        if self.headers.get("Transfer-Encoding"):
            raise invalid("不支持此请求传输方式。")
        lengths = self.headers.get_all("Content-Length", [])
        if not lengths and optional:
            return {}
        if len(lengths) != 1 or not re.fullmatch(r"[0-9]{1,9}", lengths[0]):
            raise invalid("请求需要有效的内容长度。")
        length = int(lengths[0])
        if length > MAX_BODY_BYTES:
            raise ApiError(413, "request_too_large", "请求内容过大，最多 900 KB。")
        if length == 0 and optional:
            return {}
        if self.headers.get_content_type() != "application/json":
            raise ApiError(415, "json_required", "请求内容必须使用 JSON。")
        raw = self.rfile.read(length)
        if len(raw) != length:
            raise invalid("请求内容不完整。")
        try:
            body = parse_json(raw.decode("utf-8"))
            if not isinstance(body, dict):
                raise invalid("请求内容必须是 JSON 对象。")
            # Ensure escaped lone surrogates cannot reach the DB or response encoder.
            encode_json(body).encode("utf-8")
            return body
        except UnicodeError as exc:
            raise invalid("请求内容必须使用有效的 UTF-8。") from exc

    def bearer(self) -> str:
        headers = self.headers.get_all("Authorization", [])
        if len(headers) != 1 or not re.fullmatch(r"Bearer [A-Za-z0-9_-]{43}", headers[0]):
            raise ApiError(401, "unauthorized", "请先登录账号。")
        return token_hash(headers[0][7:])

    def dispatch(self):
        try:
            self.check_origin()
            path = urlsplit(self.path).path
            routes = {"/api/health": "GET", "/api/auth": "POST", "/api/me": "GET",
                      "/api/save": "PUT", "/api/logout": "POST"}
            if path not in routes or "?" in self.path or "#" in self.path:
                raise ApiError(404, "not_found", "账号接口不存在。")
            if self.command != routes[path]:
                raise ApiError(405, "method_not_allowed", "此接口不支持该请求方式。")
            ip = self.client_ip()
            self.server.limits.check("request-ip", ip, 300, 60)
            if path == "/api/health":
                result = {"ok": True, "version": VERSION}
            elif path == "/api/auth":
                result = self.server.database.authenticate(self.read_json(), ip, self.server.limits)
            elif path == "/api/me":
                result = self.server.database.me(self.bearer())
            elif path == "/api/save":
                digest = self.bearer()
                result = self.server.database.save(digest, self.read_json())
            else:
                digest = self.bearer()
                if self.read_json(optional=True):
                    raise invalid("退出登录不需要额外内容。")
                result = self.server.database.logout(digest)
            self.respond(200, result)
        except ApiError as exc:
            self.respond(exc.status, {"ok": False, "code": exc.code, "message": exc.message}, exc.retry_after)
        except (socket.timeout, TimeoutError):
            self.respond(408, {"ok": False, "code": "timeout", "message": "请求超时，请重试。"})
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (ValueError, RecursionError):
            self.respond(400, {"ok": False, "code": "invalid_request", "message": "请求内容格式不正确。"})
        except Exception as exc:
            sys.stderr.write(f"api internal error: {type(exc).__name__}\n")
            self.respond(500, {"ok": False, "code": "internal_error", "message": "账号服务暂时不可用，请稍后重试。"})

    do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = do_HEAD = dispatch


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=int(os.environ.get("MOSSLIGHT_API_PORT", "3197")))
    backups = parser.add_mutually_exclusive_group()
    backups.add_argument("--backup", type=Path, help="Create a consistent new SQLite backup, then exit")
    backups.add_argument("--backup-daily", action="store_true", help="Create a unique timestamped backup in the data directory")
    args = parser.parse_args()
    if os.name == "posix":
        os.umask(0o077)
    data_dir = Path(os.environ.get("MOSSLIGHT_DATA_DIR", "/var/lib/mosslight"))
    if (args.backup or args.backup_daily) and not (data_dir / "account.sqlite3").is_file():
        parser.error("Cannot back up a missing database")
    database = Database(data_dir)
    if args.backup_daily:
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
        args.backup = data_dir / "backups" / ("daily-" + stamp + "-" + secrets.token_hex(3) + ".sqlite3")
    if args.backup:
        database.backup(args.backup)
        print(f"Backup verified: {args.backup}")
        return
    allowed_hosts = {host.strip().lower() for host in os.environ.get("MOSSLIGHT_ALLOWED_HOSTS", "").split(",") if host.strip()}
    server = ApiServer(("127.0.0.1", args.port), database, allowed_hosts)
    sys.stderr.write(f"Mosslight API {VERSION} on 127.0.0.1:{server.server_port}\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
