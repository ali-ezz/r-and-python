from fastapi import FastAPI

from routers.product_router import router as product_router
from routers.auth_router import router as auth_router

app = FastAPI(title="Excel CRUD API")

app.include_router(product_router)
app.include_router(auth_router)


