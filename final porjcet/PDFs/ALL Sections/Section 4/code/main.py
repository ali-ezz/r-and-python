from fastapi import FastAPI

from routers.product_router import router as product_router

app = FastAPI(title="Excel CRUD API")

app.include_router(product_router)


