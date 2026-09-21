from fastapi.testclient import TestClient

from app.analysis.anomaly import detect_last
from app.main import app

client = TestClient(app)


def test_spike_over_steady_baseline_is_reported():
    values = [2, 3, 2, 4, 3, 2, 3, 2, 3, 4, 2, 3, 3, 2, 40]
    hit = detect_last(values, min_delta=5)
    assert hit is not None
    assert hit["value"] == 40
    assert hit["baseline"] < 4


def test_small_change_or_short_history_is_ignored():
    assert detect_last([10] * 20 + [12], min_delta=5) is None
    assert detect_last([1, 2, 30], min_delta=5) is None
    assert detect_last([5] * 20 + [None], min_delta=5) is None


def test_flat_zero_errors_then_burst():
    assert detect_last([0] * 30 + [9], min_delta=5) is not None


def test_detect_endpoint_returns_only_anomalous_series():
    cpu = [20 + (i % 3) for i in range(30)] + [85]
    quiet = [20 + (i % 3) for i in range(31)]
    res = client.post("/anomaly/detect", json={"series": [
        {"key": "cpu:1", "values": cpu, "minDelta": 20},
        {"key": "cpu:2", "values": quiet, "minDelta": 20},
        {"key": "errors", "values": [None, None, 1], "minDelta": 5},
    ]})
    assert res.status_code == 200
    body = res.json()
    assert [a["key"] for a in body["anomalies"]] == ["cpu:1"]
    assert body["anomalies"][0]["score"] >= 3.5
