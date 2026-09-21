from fastapi import FastAPI

from app.api.routes import router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description="프로젝트 소스와 운영 로그를 분석해 백엔드에 결과를 돌려주는 서비스",
)

app.include_router(router)


@app.get("/", include_in_schema=False)
def root() -> dict:
    return {"service": settings.app_name, "version": settings.version, "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=True)
