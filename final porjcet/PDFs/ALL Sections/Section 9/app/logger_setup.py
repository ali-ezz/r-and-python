# logger_setup.py
# ============================================================
# This file is responsible for setting up logging.
# We call setup_logger() ONCE at the start in main.py.
# After that, every file can use logging freely.
#
# Think of it as designing the diary format:
#   - What does each entry look like?
#   - Where do we write? (terminal, file, or both)
#   - What is the minimum level we care about?
# ============================================================

import logging
import os


def setup_logger():

    # Create the logs folder if it does not exist
    os.makedirs("logs", exist_ok=True)

    # Define the format of every single log line
    # Example output:
    # 2024-12-15 10:30:00 | INFO     | notes_api.notes | Note created
    log_format  = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    date_format = "%Y-%m-%d %H:%M:%S"
    formatter   = logging.Formatter(fmt=log_format, datefmt=date_format)

    # ── Handler 1: Console ──────────────────────────────────
    # Shows logs in the terminal while the app is running
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.DEBUG)   # Show ALL levels
    console_handler.setFormatter(formatter)

    # ── Handler 2: app.log ──────────────────────────────────
    # Saves INFO and above to a file
    file_handler = logging.FileHandler("logs/app.log", encoding="utf-8")
    file_handler.setLevel(logging.INFO)
    file_handler.setFormatter(formatter)

    # ── Handler 3: errors.log ───────────────────────────────
    # Saves ONLY errors and critical messages to a separate file
    # This way, when something breaks, you check errors.log first
    error_handler = logging.FileHandler("logs/errors.log", encoding="utf-8")
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)

    # ── Root Logger ─────────────────────────────────────────
    # The root logger is the "parent" of all loggers.
    # Attaching handlers here means ALL loggers in the project
    # will use these handlers automatically.
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(error_handler)

    logging.getLogger("notes_api").info("Logger setup complete")