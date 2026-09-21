from pathlib import Path
import zipfile
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.parser.documents import extract_text

ROOT = Path(__file__).resolve().parents[2] / "demo-fixtures"
client = TestClient(app)


@pytest.mark.parametrize("extension", ["md", "pdf", "xlsx", "docx"])
def test_actual_document_rules_map_to_source(extension):
    document = ROOT / f"rules.{extension}"
    text, error = extract_text(str(document))
    assert error is None and "console.log" in text
    body = client.post("/analysis", json={"projectId": 1, "projectCode": "WALLPAD-DEMO",
        "sourceFile": str(ROOT / "wallpad-source.zip"), "ruleFiles": [str(document)],
        "fileNames": {str(document): document.name}}).json()
    assert body["status"] == "COMPLETED"
    result = body["result"]
    assert 0 < result["overview"]["score"] < 100
    violations = [finding for finding in result["findings"] if finding["category"] == "rules"]
    assert {"R001", "R002", "R003", "R005"} <= {f["ruleId"] for f in violations}
    assert all(f["file"] == "src/WallpadClient.ts" and f["line"] and f["ruleSource"] == document.name and f["ruleText"] for f in violations)


def test_structured_rules_are_applied_without_executing_code(tmp_path):
    source = tmp_path / "source.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("test.ts", 'function parseResponse() {\n  riskyCall();\n}\n')
    body = client.post("/analysis", json={"projectId": 1, "projectCode": "GPT",
        "sourceFile": str(source), "extractedRules": [{"type": "forbidden", "value": "riskyCall",
        "source": "contract.md", "text": "Do not use riskyCall"}], "ruleExtractionSource": "OPENAI"}).json()
    assert body["result"]["rules"]["extractionSource"] == "OPENAI"
    assert any(f["ruleId"] == "R001" and f["ruleSource"] == "contract.md" for f in body["result"]["findings"])


def test_no_findings_has_coverage_evidence(tmp_path):
    source = tmp_path / "clean.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("clean.py", "def square(value):\n    return value * value\n")
    result = client.post("/analysis", json={"projectId": 1, "projectCode": "CLEAN", "sourceFile": str(source)}).json()["result"]
    assert result["findings"] == []
    assert any("위반이 없습니다" in note and "2개 코드 줄" in note for note in result["notes"])


def test_encrypted_office_is_reported(tmp_path):
    protected = tmp_path / "protected.docx"
    protected.write_bytes(bytes.fromhex("d0cf11e0a1b11ae1") + b"EncryptedPackage")
    text, error = extract_text(str(protected))
    assert text is None and "암호화" in error
