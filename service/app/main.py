from fastapi import FastAPI
from fastapi.responses import JSONResponse
import secrets

from app.api.routes import router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    docs_url=None if settings.app_runtime == "deployed" else "/docs",
    redoc_url=None if settings.app_runtime == "deployed" else "/redoc",
    openapi_url=None if settings.app_runtime == "deployed" else "/openapi.json",
    description="프로젝트 소스와 운영 로그를 분석해 백엔드에 결과를 돌려주는 서비스",
)

@app.middleware("http")
async def internal_authentication(request, call_next):
    configured = get_settings().analysis_shared_secret.get_secret_value()
    if request.url.path != "/health" and configured:
        supplied = request.headers.getlist("x-analysis-token")
        if len(supplied) != 1 or not secrets.compare_digest(supplied[0].encode("utf-8"), configured.encode("utf-8")):
            return JSONResponse(status_code=401, content={"detail": "Analysis authentication required"})
    return await call_next(request)


app.include_router(router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"service": settings.app_name, "version": settings.version, "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
