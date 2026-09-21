from fastapi import APIRouter, HTTPException, status

from app.analysis import anomaly
from app.analysis.engine import AnalysisEngine
from app.core.config import get_settings
from app.schemas.analysis import AnalysisRequest, AnalysisResponse, HealthResponse
from app.schemas.anomaly import AnomalyRequest, AnomalyResponse

router = APIRouter()
engine = AnalysisEngine()


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    settings = get_settings()
    return HealthResponse(status="UP", service=settings.app_name, version=settings.version)


@router.post("/analysis", response_model=AnalysisResponse, tags=["analysis"])
def create_analysis(request: AnalysisRequest) -> AnalysisResponse:
    return engine.run(request)


@router.get("/analysis/{analysis_id}", response_model=AnalysisResponse, tags=["analysis"])
def get_analysis(analysis_id: str) -> AnalysisResponse:
    result = engine.get(analysis_id)
    if result is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="분석 결과를 찾을 수 없습니다.")
    return result


@router.post("/anomaly/detect", response_model=AnomalyResponse, tags=["anomaly"])
def detect_anomaly(request: AnomalyRequest) -> AnomalyResponse:
    return AnomalyResponse(anomalies=anomaly.detect([s.model_dump() for s in request.series]))
