#!/bin/bash
# Run from the uploaded source tree. Only code is replaced; account data is retained.
set -euo pipefail
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
source_dir=${1:-"$script_dir/../backend"}
source_dir=$(CDPATH= cd -- "$source_dir" && pwd)
code_dir=/opt/mosslight-api
data_dir=/var/lib/mosslight
unit_dir=/etc/systemd/system
unit_names=(mosslight-api.service mosslight-backup.service mosslight-backup.timer)
stamp=$(date -u +%Y%m%dT%H%M%SZ)
sudo -n true
test -f "$source_dir/account_api.py"
for unit_name in "${unit_names[@]}"; do
  test -f "$script_dir/$unit_name"
done
/usr/bin/python3 - "$source_dir/account_api.py" <<'PY'
import ast, pathlib, sys
assert sys.version_info >= (3, 10), 'Python 3.10 or later is required'
ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
PY
if ! id mosslight >/dev/null 2>&1; then
  sudo -n useradd --system --user-group --home-dir "$data_dir" --no-create-home --shell /usr/sbin/nologin mosslight
fi
sudo -n install -d -o root -g root -m 755 "$code_dir"
sudo -n install -d -o mosslight -g mosslight -m 700 "$data_dir" "$data_dir/backups"
for suffix in '' '-wal' '-shm'; do
  if sudo -n test -f "$data_dir/account.sqlite3$suffix"; then
    sudo -n chown mosslight:mosslight "$data_dir/account.sqlite3$suffix"
    sudo -n chmod 600 "$data_dir/account.sqlite3$suffix"
  fi
done
had_code=false
declare -A had_units
timer_was_enabled=false
timer_was_active=false
if sudo -n systemctl is-enabled --quiet mosslight-backup.timer 2>/dev/null; then timer_was_enabled=true; fi
if sudo -n systemctl is-active --quiet mosslight-backup.timer 2>/dev/null; then timer_was_active=true; fi
if sudo -n test -f "$code_dir/account_api.py"; then
  had_code=true
  sudo -n cp -a "$code_dir/account_api.py" "$code_dir/account_api.py.previous"
fi
for unit_name in "${unit_names[@]}"; do
  had_units[$unit_name]=false
  if sudo -n test -f "$unit_dir/$unit_name"; then
    had_units[$unit_name]=true
    sudo -n cp -a "$unit_dir/$unit_name" "$unit_dir/$unit_name.previous"
  fi
done
rollback() {
  sudo -n systemctl stop mosslight-backup.timer || true
  if [ "$timer_was_enabled" = false ]; then sudo -n systemctl disable mosslight-backup.timer || true; fi
  if [ "${had_units[mosslight-api.service]}" = false ]; then sudo -n systemctl disable mosslight-api.service || true; fi
  if [ "$had_code" = true ]; then
    sudo -n cp -a "$code_dir/account_api.py.previous" "$code_dir/account_api.py"
  fi
  for unit_name in "${unit_names[@]}"; do
    if [ "${had_units[$unit_name]}" = true ]; then
      sudo -n cp -a "$unit_dir/$unit_name.previous" "$unit_dir/$unit_name"
    else
      sudo -n rm -f "$unit_dir/$unit_name"
    fi
  done
  sudo -n systemctl daemon-reload
  if [ "$had_code" = true ] && [ "${had_units[mosslight-api.service]}" = true ]; then
    sudo -n systemctl restart mosslight-api.service || true
  else
    sudo -n systemctl stop mosslight-api.service || true
  fi
  if [ "$timer_was_enabled" = true ]; then
    sudo -n systemctl enable mosslight-backup.timer || true
  else
    sudo -n systemctl disable mosslight-backup.timer || true
  fi
  if [ "$timer_was_active" = true ]; then sudo -n systemctl start mosslight-backup.timer || true; fi
  printf 'API update failed; existing account data was retained at %s\n' "$data_dir" >&2
}
trap rollback ERR
sudo -n install -o root -g root -m 644 "$source_dir/account_api.py" "$code_dir/account_api.py.next"
sudo -n mv -f "$code_dir/account_api.py.next" "$code_dir/account_api.py"
if sudo -n test -f "$data_dir/account.sqlite3"; then
  sudo -n -u mosslight env MOSSLIGHT_DATA_DIR="$data_dir" /usr/bin/python3 "$code_dir/account_api.py" \
    --backup "$data_dir/backups/before-update-$stamp.sqlite3"
fi
for unit_name in "${unit_names[@]}"; do
  sudo -n install -o root -g root -m 644 "$script_dir/$unit_name" "$unit_dir/$unit_name"
done
sudo -n systemctl daemon-reload
sudo -n systemctl enable mosslight-api.service
sudo -n systemctl restart mosslight-api.service
/usr/bin/python3 - <<'PY'
import json, time, urllib.request
for attempt in range(30):
    try:
        with urllib.request.urlopen('http://127.0.0.1:3197/api/health', timeout=2) as response:
            data = json.load(response)
            assert data == {'ok': True, 'version': '2.5.1'}, data
        break
    except Exception:
        if attempt == 29:
            raise
        time.sleep(.5)
print('Verified API 2.5.1 on 127.0.0.1:3197')
PY
sudo -n systemctl enable --now mosslight-backup.timer
sudo -n systemctl is-active --quiet mosslight-backup.timer
trap - ERR
printf 'API installed. Persistent accounts: %s/account.sqlite3\n' "$data_dir"
printf 'Daily verified backups enabled: %s/backups (all previous backups retained)\n' "$data_dir"
