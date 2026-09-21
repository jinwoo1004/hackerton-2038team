"""Read-only deployment checks; never starts services or sends model requests.

Run from the repository root after the isolated backend/service/frontend checks.
Requires PyYAML. Evidence contains counts, hashes and fixed messages only.
"""
from pathlib import Path
import datetime as dt
import hashlib
import json
import os
import re
import shutil
import subprocess
import xml.etree.ElementTree as ET
import zipfile

import yaml

ROOT = Path(__file__).resolve().parents[2]
WORK = ROOT / '.work/deployment-verification'
checks = []

def check(name, condition):
    assert condition, name
    checks.append(name)

def read(name):
    return (ROOT / name).read_text(encoding='utf-8-sig')

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

base = yaml.safe_load(read('deploy/compose.yml'))
tls = yaml.safe_load(read('deploy/compose.tls.yml'))
services = base['services']
backend, analysis, mysql = (services[k] for k in ('backend', 'analysis', 'mysql'))
env = backend['environment']
check('private analysis/mysql: no host ports', all(not s.get('ports') and s['networks'] == ['private'] for s in (analysis, mysql)))
check('internal private network', base['networks']['private']['internal'] is True)
check('backend loopback publication', backend['ports'] == ['127.0.0.1:${BACKEND_PORT:-8080}:8080'])
check('TLS public ports and required hostname', tls['services']['caddy']['ports'] == ['80:80', '443:443'] and ':?' in tls['services']['caddy']['environment']['BACKEND_HOST'])
check('UID10001 and shared storage rw/ro', backend['user'] == analysis['user'] == '10001:10001' and backend['volumes'] == ['shared-storage:/data/storage'] and analysis['volumes'] == ['shared-storage:/data/storage:ro'])
check('explicit deployed API provider', env['APP_RUNTIME'] == 'deployed' and env['LLM_PROVIDER'] == 'openai_api' and env['SPRING_PROFILES_ACTIVE'] == 'deployed')
required = ['OPENAI_API_KEY', 'OPENAI_MODEL', 'DB_USERNAME', 'DB_PASSWORD', 'APP_JWT_SECRET', 'APP_ANALYSIS_SHARED_SECRET', 'APP_CORS_ALLOWED_ORIGINS', 'APP_PUBLIC_URL']
check('required runtime configuration', all(':?' in env[k] for k in required))
check('no OAuth environment in containers', all(not key.startswith('CODEX_') for svc in services.values() for key in svc.get('environment', {})))
check('shared analysis authentication contract', 'APP_ANALYSIS_SHARED_SECRET:?' in analysis['environment']['ANALYSIS_SHARED_SECRET'] and env['APP_ANALYSIS_BASE_URL'] == 'http://analysis:8000')
check('persistent mysql volume', mysql['volumes'] == ['mysql-data:/var/lib/mysql'])
check('single backend/analysis replica', backend['deploy']['replicas'] == analysis['deploy']['replicas'] == 1)
for name in ['backend/Dockerfile', 'service/Dockerfile']:
    text = read(name)
    check(name + ': nonroot and no literal runtime secrets', 'USER 10001:10001' in text and not re.search(r'(?m)^(?:ARG|ENV).*?(?:API_KEY|JWT_SECRET|DB_PASSWORD|AUTH_FILE)', text))
dockerignore = read('.dockerignore').splitlines()
check('private artifacts excluded from Docker context', all(p in dockerignore for p in ['.work', '.demo', '.tools', 'agent/dist', '**/auth.json', '**/.env', '**/application-local.yml', '**/*.zip']))
vercelignore = read('frontend/.vercelignore').splitlines()
check('private frontend artifacts excluded', all(p in vercelignore for p in ['.env*', '.codex', 'auth.json', '.next*']))
deployed = yaml.safe_load(read('backend/src/main/resources/application-deployed.yml'))
check('deployed MySQL and H2 disabled', deployed['spring']['datasource']['driver-class-name'] == 'com.mysql.cj.jdbc.Driver' and deployed['spring']['h2']['console']['enabled'] is False)

owner = json.loads(read('deploy/verification.json'))
check('runtime-owner frozen file hashes match', all(sha(ROOT / p) == value for p, value in owner['fileSHA256'].items()))
bash = Path(os.environ.get('GIT_BASH', r'C:\Program Files\Git\bin\bash.exe'))
check('Git Bash exists', bash.is_file())
result = subprocess.run([str(bash), '-n', 'deploy/up.sh'], cwd=ROOT, capture_output=True)
check('bash syntax', result.returncode == 0)
for name, value in [('missing', None), ('relative', 'deploy/.env.example'), ('inside-checkout', (ROOT / 'deploy/compose.yml').as_posix())]:
    child = os.environ.copy()
    child.pop('DEPLOY_ENV_FILE', None)
    if value is not None:
        # Git Bash absolute drive paths use /c/... rather than C:/....
        child['DEPLOY_ENV_FILE'] = '/' + value[0].lower() + value[2:] if re.match(r'^[A-Za-z]:/', value) else value
    result = subprocess.run([str(bash), 'deploy/up.sh', 'loopback'], cwd=ROOT, env=child, capture_output=True)
    check('external env guard: ' + name, result.returncode != 0 and b'Docker' not in result.stderr)

test_suites = [ET.parse(p).getroot() for p in (WORK / 'backend-build/test-results/test').glob('TEST-*.xml')]
totals = {key: sum(int(s.get(key, '0')) for s in test_suites) for key in ['tests', 'failures', 'errors', 'skipped']}
check('backend 72 tests', totals == {'tests': 72, 'failures': 0, 'errors': 0, 'skipped': 0})
service = ET.parse(WORK / 'service-tests.xml').getroot().find('testsuite')
service_totals = {key: int(service.get(key, '0')) for key in ['tests', 'failures', 'errors', 'skipped']}
check('service 23 tests', service_totals == {'tests': 23, 'failures': 0, 'errors': 0, 'skipped': 0})
frontend = json.loads((WORK / 'frontend-tests.json').read_text(encoding='utf-8-sig'))
check('frontend tests and type check', frontend['tests'] == 13 and frontend['testExitCode'] == frontend['typeCheckExitCode'] == 0)
jar = WORK / 'backend-build/libs/monitoring-backend-0.0.1-SNAPSHOT.jar'
forbidden_names = re.compile(r'(^|/)(auth\.json|application-local\.ya?ml|application-secrets\.ya?ml|\.env(?:\..*)?)$', re.I)
with zipfile.ZipFile(jar) as archive:
    check('JAR excludes private runtime resources', not any(forbidden_names.search(name) for name in archive.namelist()))
    jar_text = [(name, archive.read(name)) for name in archive.namelist() if name.startswith('BOOT-INF/classes/') and name.endswith(('.yml', '.yaml', '.properties', '.json'))]

patterns = [re.compile(rb'\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}'), re.compile(rb'eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}'), re.compile(rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----')]
scan_files = []
for directory in ['backend/src/main', 'service/app', 'frontend/src']:
    scan_files += [p for p in (ROOT / directory).rglob('*') if p.is_file() and p.suffix in {'.java', '.py', '.ts', '.tsx', '.yml', '.yaml', '.json'}]
browser_files = list((ROOT / 'frontend/.next-vercel-check/static').rglob('*.js'))
scan_files += browser_files
check('source/browser high-confidence credential patterns absent', not any(pattern.search(p.read_bytes()) for p in scan_files for pattern in patterns))
check('JAR config high-confidence credential patterns absent', not any(pattern.search(data) for _, data in jar_text for pattern in patterns))
check('deployment build artifact exists', bool(read('frontend/.next-vercel-check/BUILD_ID').strip()))
check('compiled browser uses explicit example HTTPS API origin', any(b'https://api.example.com' in p.read_bytes() for p in browser_files))
build_config = json.loads(read('frontend/.next-vercel-check/required-server-files.json'))
check('deployment build isolated from running frontend', build_config['config']['distDir'] == '.next-vercel-check')

before = json.loads((WORK / 'preservation-before.json').read_text(encoding='utf-8-sig'))
after = json.loads((WORK / 'preservation-after.json').read_text(encoding='utf-8-sig'))
normal = lambda data: sorted((x['LocalPort'], x['LocalAddress'], x['OwningProcess']) for x in data['listeners'])
check('six app listener identities preserved', normal(before) == normal(after) and len(normal(after)) == 6)
check('running backend JAR preserved', before['runningBackendJarSha256'] == after['runningBackendJarSha256'])
check('user Agent ZIP preserved', before['zipBytes'] == after['zipBytes'] and before['zipSha256'] == after['zipSha256'])
check('operational database remains present', before['databaseExists'] and after['databaseExists'])
check('user ZIP remains untracked', subprocess.check_output(['git', 'ls-files', '--', 'agent/dist/MonitoringAgentSetup.zip'], cwd=ROOT).strip() == b'')

evidence = {
    'verifiedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
    'sourceReadinessStatus': 'PASS', 'externalDeploymentStatus': 'BLOCKED',
    'externalBlocker': 'MISSING_ACCESS_AND_SERVER', 'dockerAvailable': shutil.which('docker') is not None,
    'realModelRequests': 0, 'installerExecuted': False, 'operationalRestarts': 0,
    'backend': dict(totals, bootJar='PASS', isolatedOutput=True, jarSHA256=sha(jar)),
    'service': service_totals, 'frontend': frontend,
    'vercelBuild': {'executionOwner': 'MAIN', 'status': 'PASS_OWNER_REPORTED_AND_ARTIFACT_VERIFIED', 'buildId': read('frontend/.next-vercel-check/BUILD_ID').strip(), 'apiOrigin': 'https://api.example.com', 'published': False},
    'composeSchema': {'executionOwner': 'runtime_manager', 'status': 'PASS_OWNER_REPORTED', 'variants': ['base', 'TLS', 'merged'], 'schemaSHA256': owner['schemaSHA256'], 'frozenFilesIndependentlyMatched': True},
    'secrets': {'bakedInSecretsFoundByStaticChecks': False, 'actualImageSecretScan': 'UNVERIFIED', 'requiredRuntimeServerEnvironment': True, 'scope': 'COPY/environment/static credential patterns and resource names; actual images not built', 'sourceAndBrowserFilesScanned': len(scan_files), 'jarConfigResourcesScanned': len(jar_text), 'credentialPatternMatches': 0},
    'preservation': {'sixPortProcessesUnchanged': True, 'runningBackendJarUnchanged': True, 'databaseExists': True, 'databaseNotByteComparedBecauseLiveAgentWrites': True, 'userZipUnchangedAndUntracked': True},
    'independentChecks': checks, 'frozenDeploymentFiles': owner['fileSHA256'],
    'notVerified': ['actual Vercel workspace deployment and browser UI', 'Docker image build and compose config/up', 'server/DNS/TLS', 'MySQL live startup and persistence', 'actual shared-volume UID ownership', 'backup and restore', 'real deployed OpenAI API call'],
    'validationNote': 'Initial verifier command retained empty environment values, causing 13/72 JWT-related failures; fixed only the verification environment with Remove-Item Env:, rerun 72/72 passed. No product fix was needed.'
}
out = ROOT / 'docs/evidence/deployment-readiness.json'
out.write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'status': 'PASS', 'checks': len(checks), 'backendTests': totals['tests'], 'serviceTests': service_totals['tests'], 'frontendTests': frontend['tests'], 'externalDeployment': 'BLOCKED'}))
