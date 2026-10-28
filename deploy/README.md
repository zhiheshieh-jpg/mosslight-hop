# Mosslight server deployment

The merged game is installed on `124.221.255.132` at
`http://124.221.255.132/mosslight/`. The default document is the 2D adventure;
its “前往3D” link opens `/mosslight/3d/`, and “前往2D” returns to the default.

The 53 current static game files built from `dist` by `node tools/build-web.mjs`
and a release hash manifest are uploaded. Run `python tools/package-web.py`
to package `.web` and update the installer archive hash. Windows launchers, Node.js, SSH credentials, and private
server data are not part of the website. Each game keeps its own browser saves.

Deployment on 2026-10-28:

- Release: `/srv/mosslight/releases/20261028T112001Z`
- Active symlink: `/srv/mosslight/current`
- Nginx snippet: `/etc/nginx/snippets/mosslight.conf`
- Public site: `/etc/nginx/sites-available/pelican-public`
- Config backup: `/etc/nginx/sites-available/pelican-public.before-mosslight-20261028T112001Z`
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

Current frontend release: 2.8.2. 2D terrain decorations and city windows keep
stable seeds and local coordinates while the camera scrolls. 3D uses only the
original white block, with no character selector or logo form; its chapter
progress combines previous profile wins. Both modes retain chapter four and
completion-gated god mode. 3D remains noncombat.
Archive SHA-256: `0281431bb59ba278c7e3f375d9730114ede2c15548d9d2be47e26769060874e7`.
The installer verified all 53 release files and all 53 HTTP-served file hashes.
The account API is 2.5.1; its persistent database and existing sessions are retained.

Account API: loopback `127.0.0.1:3197`, proxied only at `/mosslight/api/`.
Install with `bash deploy/install-api.sh`; code lives in `/opt/mosslight-api`.
Persistent SQLite accounts/sessions/saves live outside releases at `/var/lib/mosslight/account.sqlite3`.
`mosslight-api.service` starts on boot; `mosslight-backup.timer` creates verified daily backups.
A manual backup was verified after installation. Never package account data or local session caches.
The 2.5.0 client adds interactive chests, temporary double attack, no kill healing,
full-run saves, menu-only character selection, Escape pause fallback, and restores the original white 3D block.

Production verification also restarted the API service and proved that an existing
account token and its saved data survived; a new verified backup was then created.

Version 2.6.2 keeps two-HP fall recovery in 2D, placing the body fully on the last platform with a small 32-pixel edge margin. Interior coordinates stay unchanged; narrow platforms reduce the margin. 3D returns directly to its checkpoint on every fall and has no HP system or health HUD. Existing 3D saves still load, while removed HP and fall-history fields are omitted from new saves. Accounts and SQLite data are unchanged.

Version 2.7.0 adds four original self-contained BGM compositions in both modes. 2D boxes roll independently on first opening (95% empty, 5% double attack), retain their outcomes in saves, and support multiple pending rewards. GPT and Claude have distinct combat profiles, finishers and visual effects; names and 2D/3D titles are unified. 3D physics, level data and checkpoint behavior are unchanged. Production browser checks also verify real account saves containing the new loot state.

Version 2.7.1 strengthens confirmed-hit feedback only in 2D: brief differentiated hitstop, bounded damped camera impulses, local impact sparks and layered hit sounds. Empty swings do not freeze the game; BGM continues, inputs queue and multiple targets do not stack pauses. All 3D runtime files match 2.7.0 byte-for-byte.

Version 2.8.0 adds original four-chapter story scenes and a menu story archive to both modes, with character-specific 2D dialogue and a noncombat 3D narration. Consumed story gates travel with existing run saves. 2D combat Foley adds bass thuds, crisp cracks, distinct combo/finisher timbres and a sustained/revving Logo chainsaw. Muting, pausing and leaving a run stop its sources. Physics, combat values, progression, BGM and the account backend are unchanged. 160 logic tests, 116 raw-browser checks and 116 merged-browser checks passed. 18 public release checks verify deployed story/audio and real account persistence; only large image/model assets use the hash-verified local build cache.

Version 2.8.1 improves keyboard input focus isolation and persistent account entitlements without changing chapter completion evidence. API 2.5.1 validates the new entitlement and preserves it across stale updates. A verified backup was made before installation; a pre-update account and session survived the update. Validation passed 164 logic tests, 20 HTTP API tests, 35 raw and 35 merged browser checks, plus 18 public release checks and 8 real-account input/persistence checks. All 52 static files and HTTP hashes were verified.

Version 2.8.2 replaces only the GPT fan character atlas with a web-reference-based ImageGen adaptation: long silver hair and a white/lilac dress, eight action poses, and shared portraits. Reference URLs and the full generation/edit prompts are recorded in dist/2d/assets/DRAGON-20261028-PROMPT.json. Raw/merged/private browser checks each passed 24 checks, plus 164 logic and 18 public release checks. The public atlas was fetched independently and matched the generated PNG SHA-256. Game logic, combat values, other characters, 3D runtime and API 2.5.1 remain unchanged.
