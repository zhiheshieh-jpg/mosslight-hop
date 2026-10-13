#!/bin/bash
set -euo pipefail
cd /home/ubuntu/mosslight-deploy
expected=d0fe91fa8a6fdc98b30a83e6ff8b115a6e57b06149e26fb897a30083b04d847a
echo "$expected  mosslight-web.tar.gz" | sha256sum --check --status
stamp=$(date -u +%Y%m%dT%H%M%SZ)
release=/srv/mosslight/releases/$stamp
config=/etc/nginx/sites-available/pelican-public
backup=$config.before-mosslight-$stamp
snippet=/etc/nginx/snippets/mosslight.conf
old_current=$(readlink /srv/mosslight/current || true)
sudo cp -a "$config" "$backup"
snippet_existed=false
if sudo test -e "$snippet"; then
  snippet_existed=true
  sudo cp -a "$snippet" "$snippet.before-$stamp"
fi
rollback() {
  sudo cp -a "$backup" "$config"
  if [ "$snippet_existed" = true ]; then
    sudo cp -a "$snippet.before-$stamp" "$snippet"
  else
    sudo rm -f "$snippet"
  fi
  if [ -n "$old_current" ]; then
    sudo ln -sfn "$old_current" /srv/mosslight/current
  else
    sudo rm -f /srv/mosslight/current
  fi
  sudo nginx -t && sudo systemctl reload nginx
}
trap 'rollback' ERR
sudo install -d -m 755 "$release"
sudo tar --no-same-owner --no-same-permissions -xzf mosslight-web.tar.gz -C "$release"
sudo chmod -R a+rX "$release"
sudo python3 - "$release" <<'PY'
import hashlib,json,sys
from pathlib import Path
root=Path(sys.argv[1])
manifest=json.loads((root/'release-manifest.json').read_text())
for item in manifest['files']:
    assert hashlib.sha256((root/item['path']).read_bytes()).hexdigest()==item['sha256'],item['path']
assert 'MOSSLIGHT 2D' in (root/'index.html').read_text()
assert 'href="./3d/">前往3D</a>' in (root/'index.html').read_text()
assert 'href="../">前往2D</a>' in (root/'3d/index.html').read_text()
print('Verified release files:',len(manifest['files']))
PY
sudo ln -s "$release" /srv/mosslight/.current-$stamp
sudo mv -Tf /srv/mosslight/.current-$stamp /srv/mosslight/current
sudo install -m 644 mosslight.conf "$snippet"
sudo python3 - <<'PY'
from pathlib import Path
p=Path('/etc/nginx/sites-available/pelican-public')
s=p.read_text()
line='  include /etc/nginx/snippets/mosslight.conf;'
anchor='  include /etc/nginx/snippets/pelican-lumiere.conf;'
if line not in s:
    assert s.count(anchor)==1,'Unexpected public configuration; refusing changes'
    p.write_text(s.replace(anchor,line+'\n'+anchor))
PY
sudo nginx -t
sudo systemctl reload nginx
python3 - "$release" <<'PY'
import hashlib,json,sys,time,urllib.request
from pathlib import Path
root=Path(sys.argv[1])
items=json.loads((root/'release-manifest.json').read_text())['files']
def fetch(name):
    request=urllib.request.Request('http://127.0.0.1/mosslight/'+name,headers={'Host':'124.221.255.132'})
    return urllib.request.urlopen(request,timeout=15).read()
for attempt in range(10):
    try:
        for item in items:
            assert hashlib.sha256(fetch(item['path'])).hexdigest()==item['sha256'],item['path']
        break
    except Exception:
        if attempt==9:raise
        time.sleep(.5)
print('Verified served files:',len(items))
PY
trap - ERR
printf 'Release: %s\nConfig backup: %s\nURL: http://124.221.255.132/mosslight/\n' "$release" "$backup"
