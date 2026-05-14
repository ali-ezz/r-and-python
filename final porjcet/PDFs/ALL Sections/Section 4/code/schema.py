from pydantic import BaseModel
from typing import Optional

class ProductBase(BaseModel):
    name: str
    price: float
    description: Optional[str] = None

class ProductIn(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    description: Optional[str] = None

class ProductOut(ProductBase):
    id: int

    class Config:
        from_attributes = True