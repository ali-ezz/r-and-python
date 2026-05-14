from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Connection string for Windows Authentication
SQLALCHEMY_DATABASE_URL = (
    "mssql+pyodbc://@USER/fastapi_db"
    "?driver=ODBC+Driver+17+for+SQL+Server"
    "&trusted_connection=yes"
)

# Create engine
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Create session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()