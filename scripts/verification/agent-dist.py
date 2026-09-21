"""Read-only EXE/API verification. Never execute the installer or install a service."""
import datetime
import hashlib
import json
import os
import pathlib
import re
import struct
import subprocess
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
DIST = ROOT / 'agent/dist'
EXE = DIST / 'MonitoringAgentSetup.exe'
EVIDENCE = ROOT / 'docs/evidence/agent-dist.json'
BASE = 'http://localhost:18080'


def require(condition, message):
    if not condition:
        raise AssertionError(message)


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, target):
        return None


opener = urllib.request.build_opener(NoRedirect())


def open_api(path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(BASE + path, headers=headers,
                                     data=json.dumps(body).encode() if body is not None else None)
    return opener.open(request, timeout=20)


report = {
    'checkedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'verifier': 'session-monitor', 'installerExecuted': False,
    'serviceInstalledOrChanged': False, 'applicationRestarted': False,
}
try:
    require(sorted(p.name for p in DIST.iterdir()) == ['MonitoringAgentSetup.exe', 'README.md', 'SHA256SUMS'],
            'Unexpected dist contents.')
    data = EXE.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    expected = (DIST / 'SHA256SUMS').read_text(encoding='ascii').strip().split()
    require(expected == [digest, EXE.name], 'Checksum manifest mismatch.')
    require(len(data) == 113920203, 'Unexpected frozen artifact size.')
    require(data[:2] == b'MZ', 'Missing DOS header.')
    pe = struct.unpack_from('<I', data, 0x3c)[0]
    require(data[pe:pe+4] == b'PE\0\0', 'Missing PE header.')
    machine = struct.unpack_from('<H', data, pe + 4)[0]
    magic = struct.unpack_from('<H', data, pe + 24)[0]
    require(machine == 0x8664 and magic == 0x20b, 'Artifact is not x64 PE32+.')

    # Query PE metadata and signature only; never load or invoke the EXE entry point.
    env = dict(os.environ, AGENT_VERIFY_EXE=str(EXE))
    metadata_code = "$f=(Get-Item -LiteralPath $env:AGENT_VERIFY_EXE).VersionInfo; $s=Get-AuthenticodeSignature -LiteralPath $env:AGENT_VERIFY_EXE; [ordered]@{fileVersion=$f.FileVersion;productVersion=$f.ProductVersion;productName=$f.ProductName;company=$f.CompanyName;originalFilename=$f.OriginalFilename;authenticode=$s.Status.ToString()} | ConvertTo-Json -Compress"
    metadata = json.loads(subprocess.check_output(['pwsh', '-NoLogo', '-NoProfile', '-NonInteractive',
                                                   '-Command', metadata_code], env=env, encoding='utf-8'))
    require(metadata['fileVersion'] == '1.0.0.0', 'Unexpected file version.')
    require(metadata['productVersion'] == '1.0.0+42bffa80e1bb28d90d9cdf2a6e561c0a2843562d',
            'Unexpected product/source version.')
    require(metadata['authenticode'] == 'NotSigned', 'Signature state differs from documented artifact.')
    report['artifact'] = dict(name=EXE.name, bytes=len(data), sha256=digest, machine='AMD64', pe='PE32+',
                              checksumManifest='MATCH', **metadata)

    patterns = {
        'API key literal': rb'\bsk-[A-Za-z0-9_-]{24,}',
        'JWT literal': rb'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}',
        'Agent credential': rb'\bagt_[A-Za-z0-9_-]{24,}',
        'Slack webhook': rb'https://hooks\.slack\.com/services/[A-Za-z0-9]{8,}/[A-Za-z0-9]{8,}/[A-Za-z0-9]{15,}',
        'UTF16 API key literal': rb's\x00k\x00-\x00(?:[A-Za-z0-9_-]\x00){24,}',
        'UTF16 Agent credential': rb'a\x00g\x00t\x00_\x00(?:[A-Za-z0-9_-]\x00){24,}',
        'UTF16 JWT literal': rb'e\x00y\x00J\x00(?:[A-Za-z0-9_-]\x00){10,}\.\x00(?:[A-Za-z0-9_-]\x00){15,}\.\x00(?:[A-Za-z0-9_-]\x00){15,}',
    }
    candidates = [(str(EXE.relative_to(ROOT)), data)]
    for base in [ROOT / 'agent/src', ROOT / 'agent/installer']:
        for file in base.rglob('*'):
            if not file.is_file() or any(part in {'bin', 'obj', 'Resources'} for part in file.relative_to(base).parts):
                continue
            if file.suffix.lower() in {'.cs', '.json', '.csproj', '.xaml', '.ps1'}:
                candidates.append((str(file.relative_to(ROOT)), file.read_bytes()))
    matches = []
    for name, content in candidates:
        for label, pattern in patterns.items():
            if re.search(pattern, content):
                matches.append({'file': name, 'pattern': label})
    require(not matches, 'Potential credential pattern found; inspect metadata-only evidence.')
    settings = json.loads((ROOT / 'agent/src/MonitoringAgent.Worker/appsettings.json').read_text(encoding='utf-8-sig'))
    require(set(settings) == {'Serilog'}, 'Worker default settings contain unexpected sections.')
    options = (ROOT / 'agent/src/MonitoringAgent.Worker/Models/AgentOptions.cs').read_text(encoding='utf-8-sig')
    require('string Server { get; set; } = string.Empty;' in options and
            'string Token { get; set; } = string.Empty;' in options, 'Agent credential defaults are not empty.')
    report['staticReview'] = {
        'sourceAndRawArtifactFilesScanned': len(candidates), 'credentialPatternMatches': matches,
        'workerDefaultSettingsSections': sorted(settings), 'serverAndTokenDefaults': 'EMPTY',
        'publishedFiles': sorted(p.name for p in DIST.iterdir()),
        'packagingRecipe': 'Only self-contained Worker and WPF application outputs are copied; private configuration names rejected before dist copy.',
        'limitations': 'Source/publish-recipe review and raw UTF8/UTF16 literal scan; not a proof against every encoding or compressed payload. Embedded Worker verification is attributed separately to the build owner.',
    }

    unauthorized = {}
    for path in ['/api/agent-installer', '/api/agent-installer/download']:
        try:
            with open_api(path) as response:
                status = response.status
        except urllib.error.HTTPError as error:
            status = error.code
            error.close()
        require(status in {401, 403}, 'Unauthenticated installer access was not rejected.')
        unauthorized[path] = status
    with open_api('/api/auth/login', body={'email': 'admin@xisnd.com', 'password': 'test1234'}) as response:
        token = json.load(response)['token']
    with open_api('/api/agent-installer', token) as response:
        info = json.load(response)
    require(info.get('available') is True and info.get('fileName') == EXE.name and info.get('sizeBytes') == len(data),
            'Authenticated installer metadata does not match dist.')
    downloaded = hashlib.sha256()
    length = 0
    with open_api('/api/agent-installer/download', token) as response:
        require(response.status == 200, 'Download did not succeed.')
        content_type = response.headers.get_content_type()
        disposition = response.headers.get('Content-Disposition', '')
        require(content_type == 'application/octet-stream' and EXE.name in disposition, 'Download headers are incorrect.')
        while chunk := response.read(1024 * 1024):
            downloaded.update(chunk)
            length += len(chunk)
            require(length <= len(data), 'Download exceeded expected artifact size.')
    token = None
    require(length == len(data) and downloaded.hexdigest() == digest, 'Streamed download differs from dist artifact.')
    report['api'] = {
        'base': BASE, 'unauthorizedStatuses': unauthorized, 'authenticatedInfo': info,
        'downloadStatus': 200, 'downloadBytes': length, 'downloadSha256': downloaded.hexdigest(),
        'contentType': content_type, 'contentDisposition': disposition, 'distHashMatch': True,
        'downloadSavedToDisk': False, 'tokenLoggedOrSaved': False,
    }
    report['buildOwnerEvidence'] = {
        'agentTests': '27 PASS reported by runtime_manager; not independently rerun for this artifact-only change.',
        'embeddedWorker': 'pack-agent.ps1 compares the SHA256 of manifest resource MonitoringAgentService.exe with the published Worker; reported PASS by runtime_manager. Installer entry point was not executed.',
    }
    report['result'] = 'PASS'
except Exception as error:
    report['result'] = 'FAIL'
    report['failureType'] = type(error).__name__
    # Never serialize HTTP request objects, headers, response bodies, or login exceptions.
    report['failure'] = str(error) if isinstance(error, AssertionError) else 'Verification could not complete; raw error details withheld.'
finally:
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: report.get(key) for key in ['result', 'artifact', 'api', 'failure']}, ensure_ascii=False))
raise SystemExit(0 if report['result'] == 'PASS' else 1)
