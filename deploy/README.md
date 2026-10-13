# Mosslight server deployment

The merged game is installed on `124.221.255.132` at
`http://124.221.255.132/mosslight/`. The default document is the 2D adventure;
its “前往3D” link opens `/mosslight/3d/`, and “前往2D” returns to the default.

The 46 current static game files built from `dist` by `node tools/build-web.mjs`
and a release hash manifest are uploaded. Run `python tools/package-web.py`
to package `.web` and update the installer archive hash. Windows launchers, Node.js, SSH credentials, and private
server data are not part of the website. Each game keeps its own browser saves.

Deployment on 2026-10-13:

- Release: `/srv/mosslight/releases/20261013T083447Z`
- Active symlink: `/srv/mosslight/current`
- Nginx snippet: `/etc/nginx/snippets/mosslight.conf`
- Public site: `/etc/nginx/sites-available/pelican-public`
- Config backup: `/etc/nginx/sites-available/pelican-public.before-mosslight-20261013T083447Z`
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

Current release: 2.5.0. Both modes include chapter four, character-specific
progression, completion-gated god mode, and the logo form. 3D remains noncombat.
Archive SHA-256: `d0fe91fa8a6fdc98b30a83e6ff8b115a6e57b06149e26fb897a30083b04d847a`.

Account API: loopback `127.0.0.1:3197`, proxied only at `/mosslight/api/`.
Install with `bash deploy/install-api.sh`; code lives in `/opt/mosslight-api`.
Persistent SQLite accounts/sessions/saves live outside releases at `/var/lib/mosslight/account.sqlite3`.
`mosslight-api.service` starts on boot; `mosslight-backup.timer` creates verified daily backups.
A manual backup was verified after installation. Never package account data or local session caches.
The 2.5.0 client adds interactive chests, temporary double attack, no kill healing,
full-run saves, menu-only character selection, Escape pause fallback, and restores the original white 3D block.

Production verification also restarted the API service and proved that an existing
account token and its saved data survived; a new verified backup was then created.
