from functools import lru_cache
from typing import Literal

from pydantic import SecretStr, ValidationError, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Monitoring Analysis Service"
    version: str = "0.1.0"
    host: str = "0.0.0.0"
    port: int = 8000
    storage_location: str = "../backend/storage"
    app_runtime: Literal["local", "deployed", "test"] = "local"
    analysis_shared_secret: SecretStr = SecretStr("")

    @model_validator(mode="after")
    def deployment_settings(self):
        secret = self.analysis_shared_secret.get_secret_value()
        if self.app_runtime == "deployed":
            if len(secret) < 32 or len(set(secret)) < 12 or not all(33 <= ord(c) <= 126 for c in secret):
                raise ValueError("Invalid deployed analysis authentication configuration")
            from pathlib import Path
            if not Path(self.storage_location).is_absolute():
                raise ValueError("Deployed analysis storage must be absolute")
        return self


@lru_cache
def get_settings() -> Settings:
    try:
        return Settings()
    except ValidationError:
        # Never print Pydantic's input dictionary, which can contain credentials.
        raise RuntimeError("Analysis service configuration is invalid") from None
