from fastapi import FastAPI
from excel import init_excel
from routers.product_router import router as product_router

app = FastAPI(title="Excel CRUD API")

app.include_router(product_router)

init_excel()

