# app/core/config.py
from typing import Optional

# Try Pydantic v2 + pydantic-settings first; fall back to Pydantic v1 BaseSettings
try:
    from pydantic_settings import BaseSettings  # v2 way
    from pydantic import Field
    V2 = True
except Exception:
    from pydantic import BaseSettings, Field  # v1 way
    V2 = False

class Settings(BaseSettings):
    # Field names are canonical; aliases map to env var names
    app_name: str = Field(default="AI Scheduler", alias="APP_NAME")
    db_url: str = Field(default="sqlite:///./scheduler.db", alias="DB_URL")
    jwt_secret: str = Field(default="CHANGE_ME", alias="JWT_SECRET")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")

    # Cross-version config
    if V2:
        # Pydantic v2
        model_config = {
            "env_file": ".env",
            "extra": "ignore",
            "populate_by_name": True,  # allow using field names as well as aliases
        }
    else:
        # Pydantic v1
        class Config:
            env_file = ".env"
            case_sensitive = False
            allow_population_by_field_name = True

settings = Settings()
