from pydantic import BaseModel
from typing import Optional


# Input Model (Create / Update)
class ProductIn(BaseModel):
    name: str
    category: str
    price: float
    quantity: int


# Output Model
class ProductOut(ProductIn):
    id: int


# Optional Update Model
class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    quantity: Optional[int] = None