import sys
from loguru import logger

def setup_logging():
    # Remove default handler
    logger.remove()
    
    # Add structured JSON logging to stdout
    logger.add(
        sys.stdout,
        serialize=True,
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
        backtrace=True,
        diagnose=True,
    )
    
    # Add a file logger
    logger.add(
        "logs/app.log",
        rotation="10 MB",
        retention="10 days",
        level="DEBUG",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {name}:{function}:{line} - {message}"
    )

    logger.info("Structured logging configured.")
