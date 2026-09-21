"""Independent metadata-only credential/artifact scan; no auth-store access."""
import datetime
import json
import pathlib
import re
import subprocess
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/evidence/llm'
PATTERNS = {
    'API key literal': re.compile(rb'\bsk-[A-Za-z0-9_-]{24,}'),
    'JWT literal': re.compile(rb'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}'),
    'Agent credential': re.compile(rb'\bagt_[A-Za-z0-9_-]{24,}'),
    'Slack webhook': re.compile(rb'https://hooks\.slack\.com/services/[A-Za-z0-9]{8,}/[A-Za-z0-9]{8,}/[A-Za-z0-9]{15,}'),
}
BINARY = {'.png', '.ico', '.pdf', '.docx', '.xlsx', '.zip', '.woff2', '.ttf', '.jar'}
findings = []
counts = {'sourceText': 0, 'indexText': 0, 'buildFiles': 0, 'jarEntries': 0, 'runtimeLogs': 0}


def git(*args):
    return subprocess.check_output(['git', '-c', 'safe.directory=' + ROOT.as_posix(), *args], cwd=ROOT, stderr=subprocess.PIPE)


def scan(scope, name, data):
    for label, pattern in PATTERNS.items():
        if pattern.search(data):
            findings.append({'scope': scope, 'file': name, 'pattern': label})


def private_name(name):
    base = pathlib.PurePosixPath(name.replace('\\', '/')).name.lower()
    return base in {'auth.json', 'application-local.yml', 'application-local.yaml'} or (
        '.example.' not in base and ('credential' in base or 'secret' in base)
        and base.endswith(('.json', '.yml', '.yaml')))


source_files = set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').decode('utf-8').split('\0')) - {''}
for name in sorted(source_files):
    file = ROOT / name
    if not file.is_file() or file.suffix.lower() in BINARY:
        continue
    counts['sourceText'] += 1
    scan('source', name, file.read_bytes())
for name in filter(None, git('ls-files', '-z').decode('utf-8').split('\0')):
    if pathlib.Path(name).suffix.lower() in BINARY:
        continue
    counts['indexText'] += 1
    scan('index', name, git('show', ':' + name))

artifact_names = []
for directory in ['backend/build/classes/java/main', 'backend/build/resources/main',
                  'frontend/.next-demo-full', 'frontend/.next-demo-frontend']:
    location = ROOT / directory
    if not location.exists():
        findings.append({'scope': 'build', 'file': directory, 'pattern': 'required build missing'})
        continue
    for file in location.rglob('*'):
        if not file.is_file() or 'cache' in file.relative_to(location).parts or file.suffix.lower() in BINARY:
            continue
        name = file.relative_to(ROOT).as_posix()
        counts['buildFiles'] += 1
        scan('build', name, file.read_bytes())
        if private_name(name):
            artifact_names.append(name)

jars = list((ROOT / 'backend/build/libs').glob('*.jar'))
boot_jars = [file for file in jars if not file.name.endswith('-plain.jar')]
if len(boot_jars) != 1:
    findings.append({'scope': 'jar', 'file': 'backend/build/libs', 'pattern': 'expected one boot JAR'})
for file in boot_jars:
    with zipfile.ZipFile(file) as archive:
        for entry in archive.infolist():
            if entry.is_dir() or not entry.filename.startswith('BOOT-INF/classes/'):
                continue
            counts['jarEntries'] += 1
            scan('jar', entry.filename, archive.read(entry))
            if private_name(entry.filename):
                artifact_names.append('JAR:' + entry.filename)

for file in (ROOT / '.demo/logs').glob('*'):
    if file.is_file():
        counts['runtimeLogs'] += 1
        scan('runtime-log', file.name, file.read_bytes())

changes = git('diff', '9851a58', '--name-only').decode('utf-8').splitlines()
unchanged_groups = ['frontend/src/', 'frontend/tailwind.config.ts', 'agent/', 'service/']
unexpected = [name for name in changes if any(name == group or name.startswith(group) for group in unchanged_groups)]
result = {
    'completedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'baseline': '9851a58', 'counts': counts, 'credentialPatternMatches': findings,
    'privateCredentialArtifacts': artifact_names, 'unchangedFeatureGroupChanges': unexpected,
    'result': 'PASS' if not findings and not artifact_names and not unexpected else 'FAIL',
    'limitations': 'Pattern scan, not proof against every encoding. Does not open external auth stores. Historical MVP evidence is preserved. Index scan must be rerun after final staging.',
}
OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'static.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
raise SystemExit(0 if result['result'] == 'PASS' else 1)
