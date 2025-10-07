from pydantic import BaseSettings

class Settings(BaseSettings):
    app_name: str = "AI Scheduler"
    jwt_secret: str = "CHANGE_ME"
    db_url: str = "sqlite:///./scheduler.db"

    class Config:
        env_file = ".env"

settings = Settings()
