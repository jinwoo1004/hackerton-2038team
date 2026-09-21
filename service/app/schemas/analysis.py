from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class AnalysisStatus(str, Enum):
    QUEUED = "QUEUED"
    ANALYZING = "ANALYZING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class AnalysisRequest(BaseModel):

    projectId: int = Field(..., description="프로젝트 식별자")
    projectCode: str = Field(..., description="프로젝트 코드")
    technologies: List[str] = Field(default_factory=list, description="선택된 기술 스택")
    ruleFiles: List[str] = Field(default_factory=list, description="규칙 문서 경로 목록")
    sourceFile: Optional[str] = Field(None, description="소스 ZIP 경로")
    logFiles: List[str] = Field(default_factory=list, description="로그 파일 경로 목록")
    fileNames: Dict[str, str] = Field(default_factory=dict, description="경로별 원래 파일명")
    extractedRules: List[Dict[str, Any]] = Field(default_factory=list)
    ruleExtractionSource: str = "LOCAL"


class AnalysisResponse(BaseModel):
    analysisId: str
    status: AnalysisStatus
    projectCode: str
    summary: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    createdAt: datetime


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
