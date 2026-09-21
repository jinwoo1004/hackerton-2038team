from statistics import median, pstdev
from typing import List, Optional, Sequence

MIN_HISTORY = 12
Z_THRESHOLD = 3.5
EWMA_ALPHA = 0.1


def ewma(values: Sequence[float], alpha: float = EWMA_ALPHA) -> float:
    level = values[0]
    for v in values[1:]:
        level = alpha * v + (1 - alpha) * level
    return level


def robust_spread(values: Sequence[float]) -> float:
    mid = median(values)
    mad = median(abs(v - mid) for v in values)
    if mad > 0:
        return 1.4826 * mad
    return pstdev(values)


def detect_last(values: Sequence[Optional[float]], min_delta: float) -> Optional[dict]:
    if not values or values[-1] is None:
        return None
    last = float(values[-1])
    history = [float(v) for v in values[:-1] if v is not None]
    if len(history) < MIN_HISTORY:
        return None

    baseline = ewma(history)
    # 늘 같은 값이던 지표는 편차가 0이라 작은 변화도 튀지 않게 바닥값을 둔다
    spread = max(robust_spread(history), min_delta / 3, 1e-6)
    score = (last - baseline) / spread
    if score >= Z_THRESHOLD and last - baseline >= min_delta:
        return {"value": round(last, 2), "baseline": round(baseline, 2), "score": round(score, 2)}
    return None


def detect(series: List[dict]) -> List[dict]:
    found = []
    for s in series:
        hit = detect_last(s.get("values") or [], float(s.get("minDelta") or 0))
        if hit:
            found.append({"key": s["key"], **hit})
    return found
