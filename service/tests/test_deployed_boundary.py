import os
from pathlib import Path
import subprocess
import zipfile
import shutil
import builtins
import io

import pytest
from fastapi.testclient import TestClient
from app.core.config import get_settings
from app.analysis.engine import _resolve
from app.main import app

TOKEN = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$"


@pytest.fixture
def deployed(tmp_path, monkeypatch):
    root = tmp_path / "storage"
    root.mkdir()
    monkeypatch.setenv("APP_RUNTIME", "deployed")
    monkeypatch.setenv("ANALYSIS_SHARED_SECRET", TOKEN)
    monkeypatch.setenv("STORAGE_LOCATION", str(root))
    get_settings.cache_clear()
    yield root
    get_settings.cache_clear()


def test_health_is_minimal_and_every_other_path_requires_token(deployed):
    with TestClient(app) as client:
        assert client.get("/health").json() == {"status": "UP"}
        for path in ["/", "/docs", "/openapi.json", "/analysis/unknown"]:
            assert client.get(path).status_code == 401
        for path in ["/analysis", "/rules/documents", "/anomaly/detect"]:
            assert client.post(path, json={}).status_code == 401
            assert client.post(path, json={}, headers={"X-Analysis-Token": "wrong"}).status_code == 401
        assert client.get("/analysis/unknown", headers={"X-Analysis-Token": TOKEN}).status_code == 404
        duplicate = [("X-Analysis-Token", TOKEN), ("X-Analysis-Token", TOKEN)]
        assert client.get("/analysis/unknown", headers=duplicate).status_code == 401


def test_authenticated_analysis_and_documents_keep_existing_results(deployed):
    source = deployed / "source.zip"
    with zipfile.ZipFile(source, "w") as archive:
        archive.writestr("clean.py", "def square(value):\n    return value * value\n")
    rule = deployed / "rules.md"
    rule.write_text("Do not use eval()", encoding="utf-8")
    payload = {"projectId": 1, "projectCode": "SAFE", "sourceFile": str(source), "ruleFiles": [str(rule)]}
    with TestClient(app, headers={"X-Analysis-Token": TOKEN}) as client:
        assert client.post("/analysis", json=payload).json()["status"] == "COMPLETED"
        assert client.post("/rules/documents", json=payload).json()["documents"][0]["parsed"]


def test_all_document_parsers_only_read_the_shared_storage(deployed, monkeypatch):
    fixtures = Path(__file__).resolve().parents[2] / "demo-fixtures"
    for name in ["rules.md", "rules.pdf", "rules.xlsx", "rules.docx", "wallpad-source.zip"]:
        shutil.copyfile(fixtures / name, deployed / name)

    def guarded(original):
        def open_read_only(file, mode="r", *args, **kwargs):
            if isinstance(file, (str, os.PathLike)):
                path = Path(file).resolve()
                if path.is_relative_to(deployed) and any(flag in mode for flag in "wax+"):
                    raise PermissionError("Shared analysis storage is read-only")
            return original(file, mode, *args, **kwargs)
        return open_read_only

    monkeypatch.setattr(builtins, "open", guarded(builtins.open))
    monkeypatch.setattr(io, "open", guarded(io.open))
    with TestClient(app, headers={"X-Analysis-Token": TOKEN}) as client:
        for extension in ["md", "pdf", "xlsx", "docx"]:
            payload = {"projectId": 1, "projectCode": "READONLY", "sourceFile": str(deployed / "wallpad-source.zip"), "ruleFiles": [str(deployed / f"rules.{extension}")]}
            result = client.post("/analysis", json=payload).json()
            assert result["status"] == "COMPLETED"
            assert result["result"]["rules"]["documents"][0]["parsed"]


def test_absolute_relative_and_symlink_escape_are_rejected(deployed, tmp_path):
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "private.md").write_text("synthetic secret text", encoding="utf-8")
    for path in [str(outside / "private.md"), "../outside/private.md"]:
        with pytest.raises(ValueError, match="outside analysis storage"):
            _resolve(path)
    assert _resolve("missing.txt") == str(deployed / "missing.txt")
    link = deployed / "alias"
    if os.name == "nt":
        created = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(outside)], capture_output=True)
        assert created.returncode == 0
    else:
        link.symlink_to(outside, target_is_directory=True)
    try:
        with pytest.raises(ValueError, match="outside analysis storage"):
            _resolve(str(link / "private.md"))
        with TestClient(app, headers={"X-Analysis-Token": TOKEN}) as client:
            payload = {"projectId": 1, "projectCode": "SAFE", "ruleFiles": [str(link / "private.md")]}
            response = client.post("/rules/documents", json=payload)
            assert response.status_code == 400
            assert "synthetic secret text" not in response.text
            response = client.post("/analysis", json=payload)
            assert response.json()["status"] == "FAILED"
            assert "synthetic secret text" not in response.text
    finally:
        # Delete the temporary link itself, never its target tree.
        if os.name == "nt":
            link.rmdir()
        else:
            link.unlink()


@pytest.mark.parametrize("secret", ["", "short-sensitive-value", "a" * 64])
def test_deployed_missing_or_weak_secret_fails_without_disclosing_input(deployed, monkeypatch, secret):
    monkeypatch.setenv("ANALYSIS_SHARED_SECRET", secret)
    get_settings.cache_clear()
    with pytest.raises(RuntimeError) as failure:
        get_settings()
    assert str(failure.value) == "Analysis service configuration is invalid"
    assert failure.value.__suppress_context__
