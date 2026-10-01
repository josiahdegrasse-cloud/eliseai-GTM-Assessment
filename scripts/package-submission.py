"""Create a small, allowlisted reviewer ZIP; never copy a workspace wholesale."""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, zipfile
root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', default=str(root.parent / 'Inbound-Desk-Submission.zip'))
parser.add_argument('--allow-dirty', action='store_true', help='Local package verification only; final handoff requires a clean commit.')
args = parser.parse_args()
try:
    status = subprocess.check_output(['git','status','--porcelain'], cwd=root, text=True, stderr=subprocess.DEVNULL).strip()
    commit = subprocess.check_output(['git','rev-parse','HEAD'], cwd=root, text=True, stderr=subprocess.DEVNULL).strip()
except subprocess.CalledProcessError:
    manifest_path = root / 'SUBMISSION_MANIFEST.json'
    if not manifest_path.exists(): raise SystemExit('Package from the source checkout or a verified submission archive.')
    inherited = json.loads(manifest_path.read_text())
    status = 'uncommitted' if inherited.get('uncommitted_verification_copy') else ''
    commit = inherited['source_commit']
if status and not args.allow_dirty:
    raise SystemExit('Commit the reviewed source before packaging, or use --allow-dirty for local verification.')

roots = ['README.md','RELEASE_REVIEW.md','WEBSITE_SECURITY.md','.env.example','.openai/hosting.json','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','vite.config.mjs','drizzle.config.ts','design/DESIGN_SCRIPT.md','website','static','db','drizzle','test-data','docs','scripts','tests']
files = []
for item in roots:
    path = root / item
    files += list(path.rglob('*')) if path.is_dir() else [path]
files = sorted({p for p in files if p.is_file() and not p.is_symlink() and '__pycache__' not in p.parts and not (p.parent.name == 'tests' and p.suffix == '.py')})
manifest = {'source_commit':commit, 'uncommitted_verification_copy':bool(status), 'files':{}}
archive = Path(args.output).resolve()
archive.parent.mkdir(parents=True, exist_ok=True)
for path in files:
    rel = path.relative_to(root).as_posix()
    if path.name.startswith('.env') and path.name != '.env.example' or path.suffix in {'.sqlite3','.zip','.gz'}:
        raise SystemExit('Unexpected sensitive or generated file in package allowlist.')
    data = path.read_bytes()
    # UUID-shaped credentials and common secret prefixes must never enter this package.
    scan_data = data
    if rel.startswith('drizzle/meta/') and rel.endswith('_snapshot.json'):
        schema = json.loads(data)
        for field in ['id', 'prevId']: schema.pop(field, None)
        scan_data = json.dumps(schema).encode()
    # Reviewed non-secret UUID contexts: spreadsheet format identifiers, synthetic
    # record IDs, public profile URLs, and the explicit dummy test credential.
    uuid = rb'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
    if rel == 'static/vendor/xlsx.mjs':
        for prefix, suffix in [(b"uuid:", b"'"), (b"'fmtid': '{", b"}'"), (b'<ext uri="{', b'}">')]:
            scan_data = re.sub(re.escape(prefix) + uuid + re.escape(suffix), prefix + b'FORMAT_ID' + suffix, scan_data)
    if rel.startswith('test-data/') and rel.endswith('.json'):
        scan_data = re.sub(rb'("id"\s*:\s*")' + uuid + rb'(")', rb'\1RECORD_ID\2', scan_data)
        scan_data = re.sub(rb'(?i)(/person-details/default\.aspx\?itemid=)' + uuid, rb'\1PUBLIC_PROFILE_ID', scan_data)
    if rel in {'tests/jina-free-key.test.mjs', 'tests/jina-key-worker.test.mjs', 'tests/hybrid-research.test.mjs'}:
        scan_data = scan_data.replace(b'00000000-0000-' + b'4000-8000-000000000000', b'SYNTHETIC_TEST_KEY')
    if re.search(rb'(?i)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b|\bsk-[A-Za-z0-9_-]{24,}|\bjina_[A-Za-z0-9_-]{24,}', scan_data):
        raise SystemExit('Possible credential found in an allowlisted file. Inspect privately before packaging.')
    manifest['files'][rel] = hashlib.sha256(data).hexdigest()
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as z:
    for path in files:
        z.write(path, 'Inbound-Desk/' + path.relative_to(root).as_posix())
    z.writestr('Inbound-Desk/SUBMISSION_MANIFEST.json', json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'archive':str(archive),'files':len(files),'source_commit':commit,'bytes':archive.stat().st_size,'verification_copy':bool(status)}))
