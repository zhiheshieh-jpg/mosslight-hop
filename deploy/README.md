# Mosslight server deployment

The merged game is installed on `124.221.255.132` at
`http://124.221.255.132/mosslight/`. The default document is the 2D adventure;
its “前往3D” link opens `/mosslight/3d/`, and “前往2D” returns to the default.

The 46 current static game files built from `dist` by `node tools/build-web.mjs`
and a release hash manifest are uploaded. Run `python tools/package-web.py`
to package `.web` and update the installer archive hash. Windows launchers, Node.js, SSH credentials, and private
server data are not part of the website. Each game keeps its own browser saves.

Deployment on 2026-10-13:

- Release: `/srv/mosslight/releases/20261013T143300Z`
- Active symlink: `/srv/mosslight/current`
- Nginx snippet: `/etc/nginx/snippets/mosslight.conf`
- Public site: `/etc/nginx/sites-available/pelican-public`
- Config backup: `/etc/nginx/sites-available/pelican-public.before-mosslight-20261013T143300Z`
- Upload staging: `/home/ubuntu/mosslight-deploy`
- Local verification reports: `.deploy/tencent/`

The original root redirect and `/pelican/` page are preserved. Existing private
guide services continue using their original loopback listeners. The game URL
currently uses HTTP.

`install-mosslight.sh` verifies the uploaded archive and all release-file hashes,
backs up the Nginx configuration, switches the release symlink atomically, tests
Nginx before reloading, and checks all files through the server's HTTP listener.
On installation failure it restores the prior configuration and active release.
For another release, generate a new archive/manifest and update the expected
archive SHA-256 before running the installer.

Current frontend release: 2.6.1. 2D terrain decorations and city windows keep
stable seeds and local coordinates while the camera scrolls. 3D uses only the
original white block, with no character selector or logo form; its chapter
progress combines previous profile wins. Both modes retain chapter four and
completion-gated god mode. 3D remains noncombat.
Archive SHA-256: `ac127b4a1f35060452c4b142fe0e0bbb5474fed34d6a22287caf1b46afb00529`.
The installer verified all 46 release files and all 46 HTTP-served file hashes.
The account API remains 2.5.0, with its persistent database unchanged.

Account API: loopback `127.0.0.1:3197`, proxied only at `/mosslight/api/`.
Install with `bash deploy/install-api.sh`; code lives in `/opt/mosslight-api`.
Persistent SQLite accounts/sessions/saves live outside releases at `/var/lib/mosslight/account.sqlite3`.
`mosslight-api.service` starts on boot; `mosslight-backup.timer` creates verified daily backups.
A manual backup was verified after installation. Never package account data or local session caches.
The 2.5.0 client adds interactive chests, temporary double attack, no kill healing,
full-run saves, menu-only character selection, Escape pause fallback, and restores the original white 3D block.

Production verification also restarted the API service and proved that an existing
account token and its saved data survived; a new verified backup was then created.

Version 2.6.1 returns to the exact last grounded foot position before falling in both modes, including platform edges and temporary platforms. Moving or rotating platforms preserve the local foot position; temporary platforms offer a brief standing window at the same location. No safety search, earlier-platform fallback or center relocation occurs. Two-HP fall recovery, the six-HP 3D HUD and backward-compatible run saves are retained. Accounts and SQLite data are unchanged.
