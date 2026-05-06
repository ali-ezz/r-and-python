from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "FastAPI Student Management System"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://sms_user:sms_password@localhost:5433/fastapi_sms"
    
    # Redis Cache
    REDIS_URL: str = "redis://localhost:6380/0"
    CACHE_ENABLED: bool = True

    # Observability
    ENABLE_METRICS: bool = True

    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Security
    SECRET_KEY: str = "change_me_to_a_secure_random_string_fastapi_backend"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Admin creation
    ADMIN_EMAIL: str = "admin@sms.edu"
    ADMIN_PASSWORD: str = "Admin@2026"

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
