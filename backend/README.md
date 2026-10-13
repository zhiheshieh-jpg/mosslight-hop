# Mosslight account API 2.5.0

The standard-library Python service binds only to `127.0.0.1:3197`. It serves
JSON APIs, never static files. Python 3.10+ is supported; production uses the
server's `/usr/bin/python3`.

## Run and install

For local development, set `MOSSLIGHT_DATA_DIR` to a private directory outside
the published game files, then run `python backend/account_api.py`. An optional
`--port` overrides 3197. Run tests with `python qa/account-api.test.py`.

Upload `backend/account_api.py`, `deploy/install-api.sh`, and
`deploy/mosslight-api.service` keeping their sibling directories, then run
`bash deploy/install-api.sh`. The installer uses `sudo -n`, creates the dedicated
`mosslight` system user, installs root-owned code at `/opt/mosslight-api`, and
enables the service. Updates preserve `/var/lib/mosslight/account.sqlite3` and
make a verified SQLite backup before restarting. No pip dependencies are needed.
The installer also enables `mosslight-backup.timer`: once daily at 04:00 UTC
with up to 15 minutes of randomized delay and `Persistent=true` for missed runs.
All backups are retained in the private mode-700 data/backups directory.

Nginx must rewrite the public `/mosslight/api/` prefix to `/api/`, preserve the
original `Host`, overwrite `X-Real-IP` with `$remote_addr`, and set
`X-Forwarded-Proto` to `$scheme`. The loopback listener trusts only the single
`X-Real-IP` supplied by this proxy; it never reads `X-Forwarded-For`. Set the
Nginx body limit to 900 KB or slightly higher so API JSON size errors can reach
the client. Do not expose port 3197 or proxy arbitrary client forwarding headers.
`MOSSLIGHT_ALLOWED_HOSTS` is an optional comma-separated exact host/port list;
the service unit includes the public IP and local health-check address. Add any
future domain here when enabling it. Browser Origin must exactly match the
preserved Host and forwarded scheme. Cross-site fetches are rejected.

## Contract

All successful responses are JSON with `Cache-Control: no-store`. Errors carry
`{ok:false,code,message}` with a Chinese user-facing message. Authentication uses
an `Authorization: Bearer ...` header, never cookies or query parameters.

- `GET /api/health` returns `{ok:true,version:"2.5.0"}`.
- `POST /api/auth` accepts optional `username` and `password`. A new username
  creates an account. An omitted username becomes `player-` plus random letters
  and numbers; an omitted new password becomes six digits and is returned as
  `generatedPassword` once. Existing accounts always require the correct
  password. The response has `token`, `user:{id,username}`, `created`,
  `document:{storage:{}}`, `revision`, and `updatedAt`. Display/copy generated
  credentials before dismissing the login UI.
- `GET /api/me` returns `user`, `document`, `revision`, and `updatedAt`.
- `PUT /api/save` accepts `{changes:{key:string|null},baseRevision?:int}`.
  Changes merge atomically into the latest account document. A stale revision
  is accepted; a future revision returns 409 so the client can refetch. A null
  explicitly deletes a key. The response includes the full merged `document`,
  new/current `revision`, and `updatedAt`. Unchanged writes retain the revision.
- `POST /api/logout` accepts no body or `{}` and revokes this session immediately.

Names use NFKC Unicode normalization, case-insensitive uniqueness, a maximum
of 24 characters, and no whitespace/control characters. Passwords may be simple
(4–256 characters, including six-digit numbers). Passwords use salted
PBKDF2-HMAC-SHA256 with 600,000 iterations. Random 256-bit sessions last 90 days;
only SHA-256 token hashes are stored and survive service restarts. The client
must keep the bearer token out of cloud-save changes and page URLs.

The exact storage allowlist is `ALLOWED_KEYS` in the source. It includes current
2D/3D keys, legacy `mosslight-best-0..2`, character/chapter normal best times,
and `mosslight-run-2d` / `mosslight-run-3d`. It rejects other keys even if they
start with `mosslight`. Progress v1 legacy flags and v2 character flags merge
with OR; v2 aggregate `completed` is derived from those flags. Historical legacy
chapter-four flags are ignored, matching the game migration. 2D best scores
merge with max, 3D best times with min. Other keys use the latest accepted write.
Each string is at most 300 KiB, the combined document at most 800 KiB, and each
request at most 900 KiB. Invalid progress/score/time JSON rejects the entire
patch without modifying the account.

Rate windows are process-local and bounded: 300 API requests/minute/IP,
60 authentication attempts/15 minutes/IP, 10 failed logins/15 minutes/account,
and 10 registrations/hour/IP. There are at most 32 request threads. Logs contain
only method/status and exception class, never request URLs, passwords, tokens,
or bodies. SQLite uses WAL, foreign keys, busy timeouts, and durable writes.

## Backup and restore

Use SQLite's online backup API rather than copying the live database file alone:

```sh
sudo -n -u mosslight env MOSSLIGHT_DATA_DIR=/var/lib/mosslight \
  /usr/bin/python3 /opt/mosslight-api/account_api.py \
  --backup /var/lib/mosslight/backups/manual-20261013.sqlite3
```

The destination must be a new filename. The backup includes committed WAL data
and passes `PRAGMA integrity_check`; it contains password hashes and sessions
and must remain private. It can be called from a root-owned daily systemd timer.
On restore, stop `mosslight-api`, retain a backup of the existing database plus
its `-wal`/`-shm` companions, replace the database with the selected verified
backup, remove only the old database's WAL/SHM files, ensure ownership
`mosslight:mosslight` and mode 600, then restart and check health. A backup also
restores the sessions present at backup time. Never publish `/var/lib/mosslight`
or include it in the website source/archive.

The timer calls `--backup-daily`, which uses the same verified backup method and
a unique UTC timestamp plus random suffix. A complete backup becomes visible
only after integrity verification. Manually test with
`sudo -n systemctl start mosslight-backup.service`; inspect the timer with
`systemctl list-timers mosslight-backup.timer`.
