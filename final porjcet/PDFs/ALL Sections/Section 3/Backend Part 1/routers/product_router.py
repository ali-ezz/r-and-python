from fastapi import APIRouter, HTTPException
from model import ProductIn, ProductOut, ProductUpdate
from excel import read_data, save_data

router = APIRouter(
    prefix="/products",
    tags=["Products"]
)

@router.post("/", response_model=ProductOut)
def create_product(product: ProductIn):

    df = read_data()
    new_id = 1 if df.empty else int(df["id"].max()) + 1

    new_product = {
        "id": new_id,
        **product.dict()
    }

    df = df._append(new_product, ignore_index=True)
    save_data(df)

    return new_product

@router.get("/", response_model=list[ProductOut])
def get_products():
    df = read_data()
    return df.to_dict(orient="records")



@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int):

    df = read_data()
    product = df[df["id"] == product_id]

    if product.empty:
        raise HTTPException(404, "Product not found")

    return product.to_dict(orient="records")[0]


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, update: ProductUpdate):

    df = read_data()

    index = df.index[df["id"] == product_id]

    if len(index) == 0:
        raise HTTPException(404, "Product not found")

    idx = index[0]

    for key, value in update.dict(exclude_unset=True).items():
        df.at[idx, key] = value

    save_data(df)

    return df.loc[idx].to_dict()

@router.delete("/{product_id}")
def delete_product(product_id: int):

    df = read_data()

    if product_id not in df["id"].values:
        raise HTTPException(404, "Product not found")

    df = df[df["id"] != product_id]
    save_data(df)

    return {"message": "Product deleted"}

