from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import  engine , get_db
from model import *
from schema import *
# Make sure tables are created
Base.metadata.create_all(bind=engine)

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

# Dependency



@router.post("/", response_model=ProductOut)
def create_product(product: ProductIn, db: Session = Depends(get_db)):

    db_product = Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product


@router.get("/", response_model=list[ProductOut])
def get_products(db: Session = Depends(get_db)):
    return db.query(Product).all()




@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)):

    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return product


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, update: ProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    for key, value in update.dict(exclude_unset=True).items():
        setattr(product, key, value)

    db.commit()
    db.refresh(product)
    return product


@router.delete("/{product_id}")
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    db.delete(product)
    db.commit()
    return {"message": "Product deleted"}