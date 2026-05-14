"""
Pydantic schemas for request/response validation.
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    category: str
    stock_quantity: int = 0


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    stock_quantity: Optional[int] = None


class ProductResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    price: float
    category: str
    stock_quantity: int
    created_at: Optional[datetime]

    class Config:
        from_attributes = True