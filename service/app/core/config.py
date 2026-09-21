from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Monitoring Analysis Service"
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8000
    storage_location: str = "../backend/storage"


@lru_cache
def get_settings() -> Settings:
    return Settings()
