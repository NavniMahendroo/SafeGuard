import datetime
import os
from typing import Optional
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, DeclarativeBase
from sqlalchemy import Column, Integer, Float, String, DateTime, Text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./safeguard.db")
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

class Permit(Base):
    __tablename__ = "permits"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    permit_type = Column(String, nullable=False)  # "Hot Work", "Cold Work", "Confined Space"
    zone = Column(String, nullable=False)  # Zone name
    issued_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))
    status = Column(String, default="active")  # "active" or "revoked"

class Incident(Base):
    __tablename__ = "incidents"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    timestamp = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None))
    rule_id = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    action = Column(String, nullable=False)
    gas_level = Column(Float, nullable=False)
    temperature = Column(Float, nullable=False)
    workers_affected = Column(Integer, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

class Worker(Base):
    __tablename__ = "workers"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)

async def init_db():
    """Initializes the database schema."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

# ==============================================================================
# PYDANTIC MODEL SCHEMAS
# ==============================================================================
class PermitCreate(BaseModel):
    type: str
    zone: str

class PermitResponse(BaseModel):
    id: int
    type: str
    zone: str
    issued_at: datetime.datetime
    status: str
    
    class Config:
        from_attributes = True

class IncidentResponse(BaseModel):
    id: int
    timestamp: datetime.datetime
    rule_id: str
    severity: str
    action: str
    gas_level: float
    temperature: float
    workers_affected: int
    resolved_at: Optional[datetime.datetime] = None
    
    class Config:
        from_attributes = True
