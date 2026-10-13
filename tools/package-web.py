"""Package the generated .web tree and pin the exact archive in the installer."""
from pathlib import Path
import gzip
import hashlib
import json
import re
import tarfile

root = Path(__file__).resolve().parents[1]
web = root / '.web'
manifest = json.loads((web / 'release-manifest.json').read_text('utf-8'))
for entry in manifest['files']:
    assert hashlib.sha256((web / entry['path']).read_bytes()).hexdigest() == entry['sha256'], entry['path']
out = root / '.deploy' / 'tencent'
out.mkdir(parents=True, exist_ok=True)
archive = out / f"mosslight-web-v{manifest['version']}.tar.gz"
# Deterministic metadata: rebuilding identical website bytes gives the same digest.
with archive.open('wb') as raw, gzip.GzipFile(filename='', mode='wb', fileobj=raw, mtime=0) as compressed, tarfile.open(fileobj=compressed, mode='w') as tar:
    for file in sorted(web.rglob('*')):
        if file.is_file():
            entry = tar.gettarinfo(str(file), file.relative_to(web).as_posix())
            entry.mtime = 0
            entry.uid = entry.gid = 0
            entry.uname = entry.gname = ''
            entry.mode = 0o644
            with file.open('rb') as data:
                tar.addfile(entry, data)
digest = hashlib.sha256(archive.read_bytes()).hexdigest()
installer = root / 'deploy' / 'install-mosslight.sh'
text, count = re.subn(r'^expected=[0-9a-f]{64}$', 'expected=' + digest, installer.read_text('utf-8'), flags=re.M)
assert count == 1
installer.write_text(text, 'utf-8', newline='\n')
result = {'version': manifest['version'], 'archive': str(archive), 'bytes': archive.stat().st_size, 'sha256': digest, 'files': len(manifest['files'])}
(out / f"package-v{manifest['version']}.json").write_text(json.dumps(result, indent=2), 'utf-8')
print(json.dumps(result))
