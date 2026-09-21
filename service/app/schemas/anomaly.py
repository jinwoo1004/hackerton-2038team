from typing import List, Optional

from pydantic import BaseModel, Field


class AnomalySeries(BaseModel):
    key: str
    values: List[Optional[float]] = Field(default_factory=list, max_length=2000)
    minDelta: float = 0


class AnomalyRequest(BaseModel):
    series: List[AnomalySeries] = Field(default_factory=list, max_length=200)


class Anomaly(BaseModel):
    key: str
    value: float
    baseline: float
    score: float


class AnomalyResponse(BaseModel):
    anomalies: List[Anomaly]
