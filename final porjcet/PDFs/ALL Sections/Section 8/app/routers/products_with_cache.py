"""
==========================================================
Products WITH Caching (Cache-Aside Pattern)
==========================================================

How it works:

  GET request comes in
       │
       ▼
  Check Redis: do we have this data?
       │
       ├── YES (Cache Hit) → Return data from Redis (FAST!)
       │
       └── NO (Cache Miss)
              │
              ▼
         Query Database (slow)
              │
              ▼
         Save result in Redis
              │
              ▼
         Return data


What is TTL (Time To Live)?
    When we save data in Redis, we set a timer.
    After the timer expires, Redis deletes the data.
    This prevents the cache from having old data forever.

    Example: TTL = 60 means the data expires after 60 seconds


What is Cache Invalidation?
    When we CREATE, UPDATE, or DELETE a product, the cached
    data becomes outdated (stale). We must DELETE the old
    cached data so the next request gets fresh data.

==========================================================
"""

import json
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Product
from redis_client import redis_client
from schemas import ProductCreate,ProductUpdate

router = APIRouter(
    prefix="/cached/products",
    tags=["Products WITH Cache"],
)

# How long to keep data in cache (in seconds)
CACHE_TTL = 180  # 3 minutes


# ==========================================================
#  Helper: Convert a product row to a dictionary
# ==========================================================
def product_to_dict(product: Product) -> dict:
    return {
        "id": product.id,
        "name": product.name,
        "description": product.description,
        "price": product.price,
        "category": product.category,
        "stock_quantity": product.stock_quantity,
        "created_at": str(product.created_at) if product.created_at else None,
    }


# ==========================================================
#  GET ALL PRODUCTS (with cache)
# ==========================================================
@router.get("/")
def get_all_products(
    category: Optional[str] = None,
    db: Session = Depends(get_db),
):
    start_time = time.time()

    # --- Step 1: Build a cache key ---
    # The key must be unique for each different request
    # "products:all"  or  "products:category:electronics"
    if category:
        cache_key = f"products:category:{category}"
    else:
        cache_key = "products:all"

    # --- Step 2: Check if data exists in Redis ---
    cached_data = redis_client.get(cache_key)

    if cached_data is not None:
        # ✅ CACHE HIT — found it in Redis!
        # Redis stores strings, so we convert back to Python list
        products = json.loads(cached_data)
        elapsed = time.time() - start_time

        return {
            "source": "CACHE (Redis) ⚡",
            "response_time_ms": round(elapsed * 1000, 2),
            "cache_key": cache_key,
            "count": len(products),
            "data": products,
        }

    # --- Step 3: CACHE MISS — query the database ---
    #time.sleep(0.5)  # Simulate slow query

    query = db.query(Product)
    if category:
        query = query.filter(Product.category == category)
    db_products = query.all()

    products = [product_to_dict(p) for p in db_products]

    # --- Step 4: Save the result in Redis for next time ---
    # json.dumps converts Python list → JSON string
    # setex = SET with EXpiration (auto-deletes after TTL)
    redis_client.setex(cache_key, CACHE_TTL, json.dumps(products))

    elapsed = time.time() - start_time

    return {
        "source": "DATABASE 🐌 (saved to cache for next time)",
        "response_time_ms": round(elapsed * 1000, 2),
        "cache_key": cache_key,
        "ttl_seconds": CACHE_TTL,
        "count": len(products),
        "data": products,
    }


# ==========================================================
#  GET SINGLE PRODUCT (with cache)
# ==========================================================
@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    start_time = time.time()

    # Step 1: Build cache key for this specific product
    cache_key = f"product:{product_id}"

    # Step 2: Check Redis
    cached_data = redis_client.get(cache_key)

    if cached_data is not None:
        # CACHE HIT
        product = json.loads(cached_data)
        elapsed = time.time() - start_time

        return {
            "source": "CACHE (Redis) ⚡",
            "response_time_ms": round(elapsed * 1000, 2),
            "data": product,
        }

    # Step 3: CACHE MISS — query database
    #time.sleep(0.3)

    db_product = db.query(Product).filter(Product.id == product_id).first()
    if not db_product:
        raise HTTPException(status_code=404, detail="Product not found")

    product = product_to_dict(db_product)

    # Step 4: Save in Redis
    redis_client.setex(cache_key, CACHE_TTL, json.dumps(product))

    elapsed = time.time() - start_time

    return {
        "source": "DATABASE 🐌 (saved to cache)",
        "response_time_ms": round(elapsed * 1000, 2),
        "data": product,
    }


# ==========================================================
#  CREATE PRODUCT (with cache invalidation)
# ==========================================================
@router.post("/", status_code=201)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
):
    product = Product(**product_data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)

    # 🗑️ CACHE INVALIDATION
    # The "all products" list is now outdated because we
    # added a new product. We must delete it from cache!
    # Next GET request will fetch fresh data from DB.
    _clear_product_list_cache()

    return {
        "message": "Product created",
        "id": product.id,
        "cache_note": "Product list cache cleared",
    }


# ==========================================================
#  UPDATE PRODUCT (with cache invalidation)
# ==========================================================
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

    # 🗑️ CACHE INVALIDATION
    # Delete the cached version of this specific product
    redis_client.delete(f"product:{product_id}")
    # Also delete all list caches
    _clear_product_list_cache()

    return {
        "message": "Product updated",
        "cache_note": f"Cache cleared for product:{product_id} and product lists",
    }


# ==========================================================
#  DELETE PRODUCT (with cache invalidation)
# ==========================================================
@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    db.delete(product)
    db.commit()

    # 🗑️ CACHE INVALIDATION
    redis_client.delete(f"product:{product_id}")
    _clear_product_list_cache()

    return {
        "message": "Product deleted",
        "cache_note": "Cache cleared",
    }


# ==========================================================
#  Helper: Clear all product list caches
# ==========================================================
def _clear_product_list_cache():
    """
    Delete all keys that start with "products:"
    This includes "products:all" and "products:category:..."

    scan_iter finds all matching keys without blocking Redis.
    """
    for key in redis_client.scan_iter(match="products:*"):
        redis_client.delete(key)