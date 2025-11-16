from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env")
    
    app_name: str = "AI Scheduler"
    jwt_secret: str = "CHANGE_ME"
    db_url: str = "sqlite:///./scheduler.db"

settings = Settings()
