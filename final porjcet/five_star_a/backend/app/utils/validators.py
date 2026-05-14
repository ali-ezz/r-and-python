from __future__ import annotations

import re

HEX_COLOR_PATTERN = re.compile(r"^#[0-9A-Fa-f]{6}$")
VALID_VIEWS = {
    "list",
    "kanban",
    "grid",
    "planner",
    "skyline",
    "calendar",
    "stream",
    "matrix",
    "workload",
    "map",
}


def validate_hex_color(value: str) -> bool:
    return bool(HEX_COLOR_PATTERN.match(value))


def validate_view_type(value: str) -> bool:
    return value in VALID_VIEWS
