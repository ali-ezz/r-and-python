from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


def register_exception_handlers(app: FastAPI) -> None:
	@app.exception_handler(HTTPException)
	async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
		return JSONResponse(
			status_code=exc.status_code,
			content={"detail": exc.detail, "path": str(request.url.path)},
		)

	@app.exception_handler(RequestValidationError)
	async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
		errors = []
		for err in exc.errors():
			errors.append({
				"loc": [str(loc) for loc in err.get("loc", [])],
				"msg": str(err.get("msg", "")),
				"type": str(err.get("type", "")),
			})
		return JSONResponse(
			status_code=422,
			content={
				"detail": "Validation error",
				"errors": errors,
				"path": str(request.url.path),
			},
		)

	@app.exception_handler(Exception)
	async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
		return JSONResponse(
			status_code=500,
			content={"detail": "Internal server error", "path": str(request.url.path)},
		)
