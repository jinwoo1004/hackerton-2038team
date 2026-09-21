import zipfile

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

JAVA = """package demo;

public class OrderService {
    private String password = "SuperSecret99";

    public void place(String id) {
        try {
            System.out.println("order " + id); // TODO 로거로 교체
            String q = "select * from orders where id = " + id;
        } catch (Exception e) {}
    }
}
"""

PY = """import hashlib, subprocess

def run(cmd):
    try:
        subprocess.call(cmd, shell=True)
    except:
        pass
    return hashlib.md5(b"x").hexdigest()
"""

LOG = """2026-09-14 10:00:01 INFO  started
2026-09-14 10:05:12 ERROR [main] OrderService - java.lang.NullPointerException: id is null
2026-09-14 10:05:13 ERROR [main] OrderService - java.lang.NullPointerException: id is null
2026-09-14 11:00:00 WARN  slow query 3200ms
"""


def _project(tmp_path):
    src = tmp_path / "app.zip"
    with zipfile.ZipFile(src, "w") as z:
        z.writestr("app/src/OrderService.java", JAVA)
        z.writestr("app/tools/run.py", PY)
        z.writestr("app/.env", "DB_PASSWORD=abc\n")
        z.writestr("app/node_modules/lib/index.js", "eval('x')\n")
    rule = tmp_path / "rules.md"
    rule.write_text("# 규칙\n- System.out.println 금지\n- 메서드는 5줄 이하로 작성\n", encoding="utf-8")
    log = tmp_path / "app.log"
    log.write_text(LOG, encoding="utf-8")
    return {
        "projectId": 1,
        "projectCode": "DEMO",
        "technologies": ["Java", "Python"],
        "ruleFiles": [str(rule)],
        "sourceFile": str(src),
        "logFiles": [str(log)],
        "fileNames": {str(rule): "코딩규칙.md"},
    }


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "UP"


def test_analysis_finds_issues(tmp_path):
    body = client.post("/analysis", json=_project(tmp_path)).json()
    assert body["status"] == "COMPLETED"
    result = body["result"]

    rule_ids = {f["ruleId"] for f in result["findings"]}
    assert {"S001", "E001", "E004", "Q001", "S004", "P001", "S006", "E003", "S008", "S011", "R001", "R002"} <= rule_ids
    # node_modules 는 분석 대상이 아니다
    assert not any("node_modules" in (f["file"] or "") for f in result["findings"])

    secret = next(f for f in result["findings"] if f["ruleId"] == "S001")
    assert "SuperSecret99" not in secret["snippet"]

    assert result["source"]["analyzedFiles"] == 2
    assert {l["name"] for l in result["source"]["languages"]} == {"Java", "Python"}
    assert result["rules"]["forbidden"] == ["System.out.println"]
    assert result["rules"]["documents"][0]["name"] == "코딩규칙.md"
    assert result["rules"]["limits"]["functionLines"] == 5

    logs = result["logs"]
    assert logs["levels"]["ERROR"] == 2 and logs["levels"]["WARN"] == 1
    assert logs["topErrors"][0]["count"] == 2
    assert logs["exceptions"][0]["name"] == "NullPointerException"

    assert result["overview"]["critical"] >= 1
    assert 0 <= result["overview"]["score"] < 100
    assert "품질 점수" in body["summary"]


def test_missing_files_still_complete():
    payload = {"projectId": 1, "projectCode": "TREECS", "ruleFiles": ["/nope/rule.pdf"], "sourceFile": "/nope/app.zip"}
    body = client.post("/analysis", json=payload).json()
    assert body["status"] == "COMPLETED"
    assert body["result"]["source"]["available"] is False
    assert any("찾을 수 없습니다" in n for n in body["result"]["notes"])

    fetched = client.get(f"/analysis/{body['analysisId']}")
    assert fetched.status_code == 200


def test_unknown_analysis_returns_404():
    assert client.get("/analysis/NOT-EXISTS").status_code == 404


def test_project_code_is_required():
    assert client.post("/analysis", json={"projectId": 1}).status_code == 422
