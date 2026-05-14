from app.schemas.task import TaskUpdate

payload = {
    "due_date": "2026-04-13"
}

try:
    print(TaskUpdate(**payload))
except Exception as e:
    print(e)
