
# `fastapi_ai_scheduler/app/core/config.py`
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "AI Scheduler"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    DB_URL: str  # .env\`den gelir
    JWT_SECRET: str = "CHANGE_ME_BEFORE_DEPLOY"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
