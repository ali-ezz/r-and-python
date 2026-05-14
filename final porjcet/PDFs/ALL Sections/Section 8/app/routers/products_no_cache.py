"""
==========================================================
Products WITHOUT Caching
==========================================================

This is the normal way — every request hits the database.

Try this:
  1. Call GET /no-cache/products 5 times
  2. Every call takes ~500ms because it always
     queries the database
  3. That's 5 database queries for the SAME data!

Then compare with the cached version.
==========================================================
"""

import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Product
from schemas import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter(
    prefix="/no-cache/products",
    tags=["Products WITHOUT Cache"],
)


@router.get("/")
def get_all_products(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    start_time = time.time()

    # Simulate a slow database query
    #time.sleep(0.5)

    query = db.query(Product)
    if category:
        query = query.filter(Product.category == category)
    products = query.all()

    # Convert to dicts
    result = []
    for p in products:
        result.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "price": p.price,
            "category": p.category,
            "stock_quantity": p.stock_quantity,
            "created_at": str(p.created_at) if p.created_at else None,
        })

    elapsed = time.time() - start_time

    return {
        "source": "DATABASE (always slow)",
        "response_time_ms": round(elapsed * 1000, 2),
        "count": len(result),
        "data": result,
    }


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    start_time = time.time()

    #time.sleep(0.3)

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    result = {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "price": product.price,
        "category": product.category,
        "stock_quantity": product.stock_quantity,
        "created_at": str(product.created_at) if product.created_at else None,
    }

    elapsed = time.time() - start_time

    return {
        "source": "DATABASE",
        "response_time_ms": round(elapsed * 1000, 2),
        "data": result,
    }


@router.post("/", status_code=201)
def create_product(product_data: ProductCreate, db: Session = Depends(get_db)):
    product = Product(**product_data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return {"message": "Product created", "id": product.id}


@router.put("/{product_id}")
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)

    db.commit()
    return {"message": "Product updated"}


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}