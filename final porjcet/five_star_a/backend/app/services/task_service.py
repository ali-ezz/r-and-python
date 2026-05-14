from __future__ import annotations

from typing import Optional
import calendar
from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import or_, func
from sqlalchemy.orm import Session

from app.models.notification import NotificationType
from app.models.task import Task, TaskPriority, TaskStatus as TaskStatusModel
from app.models.user import User
from app.schemas.task import TaskCreate, TaskFilterRequest, TaskStatus, TaskUpdate
from app.services import cache_service
from app.utils.nlp_parser import parse_natural_language_task

# Valid status transitions: from_status -> [allowed_to_statuses]
VALID_STATUS_TRANSITIONS = {
    TaskStatus.TODO: {TaskStatus.IN_PROGRESS},
    TaskStatus.IN_PROGRESS: {TaskStatus.DONE},
    TaskStatus.DONE: set(),  # No backward transitions allowed
}


def validate_status_transition(current_status: TaskStatus, new_status: TaskStatus) -> None:
    """Validate that status transitions follow business rules.
    
    Rules:
    - todo -> in_progress (allowed)
    - in_progress -> done (allowed)
    - done -> anything (NOT allowed - no backward transitions)
    """
    current = current_status if isinstance(current_status, TaskStatus) else TaskStatus(current_status)
    new = new_status if isinstance(new_status, TaskStatus) else TaskStatus(new_status)
    
    if current == new:
        return  # No change needed
    
    allowed_transitions = VALID_STATUS_TRANSITIONS.get(current, set())
    if new not in allowed_transitions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from '{current.value}' to '{new.value}'. "
                   f"Allowed transitions: {', '.join(t.value for t in allowed_transitions) or 'none'}",
        )


VALID_RECURRENCE_RULES = {"daily", "weekly", "monthly"}
TASK_CACHE_DOMAIN = "tasks"


def _task_to_dict(task: Task) -> dict:
	return {
		"id": str(task.id),
		"title": task.title,
		"description": task.description,
		"status": task.status.value if hasattr(task.status, "value") else str(task.status),
		"priority": task.priority.value if hasattr(task.priority, "value") else str(task.priority),
		"difficulty": task.difficulty,
		"urgency": task.urgency,
		"importance": task.importance,
		"project_id": str(task.project_id),
		"assigned_to": str(task.assigned_to) if task.assigned_to else None,
		"created_by": str(task.created_by),
		"location": task.location,
		"recurrence_rule": task.recurrence_rule,
		"created_at": task.created_at.isoformat() if task.created_at else None,
		"updated_at": task.updated_at.isoformat() if task.updated_at else None,
		"due_date": task.due_date.isoformat() if task.due_date else None,
		"completed_at": task.completed_at.isoformat() if task.completed_at else None,
	}


def invalidate_task_cache() -> None:
	cache_service.clear_domain(TASK_CACHE_DOMAIN)


def _user_role_str(user: User) -> str:
	return user.role.value if hasattr(user.role, "value") else str(user.role)


def user_can_access_task(db: Session, user: User, task: Task) -> bool:
	"""Whether the user may read/act on this task (workspace + role rules)."""
	from app.models.project import Project

	project = db.query(Project).filter(Project.id == task.project_id).first()
	if not project or project.workspace_id != user.workspace_id:
		return False

	role = _user_role_str(user)
	if role == "employee":
		return task.assigned_to == user.id
	if role in ("admin", "project_manager"):
		return True
	return False


def _normalize_recurrence_rule(rule: Optional[str]) -> Optional[str]:
	if rule is None:
		return None

	normalized = rule.strip().lower()
	if not normalized:
		return None
	if normalized not in VALID_RECURRENCE_RULES:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="recurrence_rule must be one of: daily, weekly, monthly",
		)
	return normalized


def _advance_month(value: datetime) -> datetime:
	year = value.year + (1 if value.month == 12 else 0)
	month = 1 if value.month == 12 else value.month + 1
	day = min(value.day, calendar.monthrange(year, month)[1])
	return value.replace(year=year, month=month, day=day)


def _next_due_date(base_date: datetime, recurrence_rule: str) -> datetime:
	if recurrence_rule == "daily":
		return base_date + timedelta(days=1)
	if recurrence_rule == "weekly":
		return base_date + timedelta(weeks=1)
	if recurrence_rule == "monthly":
		return _advance_month(base_date)

	raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported recurrence rule")


def _notify_task_assignment(db: Session, task: Task, assignee_id: UUID) -> None:
	from app.services import notification_service

	if assignee_id == task.created_by:
		return

	notification_service.create_notification(
		db,
		user_id=assignee_id,
		title="New task assigned",
		message=f"You were assigned to '{task.title}'.",
		notification_type=NotificationType.task_assigned,
		related_task_id=task.id,
		extra_data={"project_id": str(task.project_id)},
		commit=False,
	)


def _notify_task_completion(db: Session, task: Task, actor_id: UUID) -> None:
	from app.services import notification_service

	recipient_ids: set[UUID] = set()
	if task.created_by != actor_id:
		recipient_ids.add(task.created_by)
	if task.assigned_to and task.assigned_to != actor_id:
		recipient_ids.add(task.assigned_to)

	for recipient_id in recipient_ids:
		notification_service.create_notification(
			db,
			user_id=recipient_id,
			title="Task completed",
			message=f"Task '{task.title}' was marked as done.",
			notification_type=NotificationType.task_completed,
			related_task_id=task.id,
			extra_data={"project_id": str(task.project_id), "completed_by": str(actor_id)},
			commit=False,
		)


def _notify_recurring_task_generated(db: Session, source_task: Task, recurring_task: Task) -> None:
	from app.services import notification_service

	recipient_ids: set[UUID] = {source_task.created_by}
	if source_task.assigned_to:
		recipient_ids.add(source_task.assigned_to)

	due_text = recurring_task.due_date.isoformat() if recurring_task.due_date else "no due date"
	for recipient_id in recipient_ids:
		notification_service.create_notification(
			db,
			user_id=recipient_id,
			title="Recurring task generated",
			message=f"A new recurring copy of '{source_task.title}' was created (due {due_text}).",
			notification_type=NotificationType.recurring_generated,
			related_task_id=recurring_task.id,
			extra_data={"source_task_id": str(source_task.id)},
			commit=False,
		)


def _create_next_recurring_task(db: Session, task: Task) -> Optional[Task]:
	recurrence_rule = _normalize_recurrence_rule(task.recurrence_rule)
	if recurrence_rule is None:
		return None

	already_generated = db.query(Task.id).filter(Task.parent_task_id == task.id).first()
	if already_generated:
		return None

	base_date = task.due_date or task.completed_at or datetime.utcnow()
	next_due = _next_due_date(base_date, recurrence_rule)

	next_task = Task(
		title=task.title,
		description=task.description,
		priority=task.priority,
		difficulty=task.difficulty,
		urgency=task.urgency,
		importance=task.importance,
		project_id=task.project_id,
		assigned_to=task.assigned_to,
		created_by=task.created_by,
		due_date=next_due,
		location=task.location,
		recurrence_rule=recurrence_rule,
		parent_task_id=task.id,
		order_index=task.order_index,
	)
	db.add(next_task)
	db.flush()

	_notify_recurring_task_generated(db, task, next_task)
	return next_task


def list_tasks(
    db: Session,
    filters: TaskFilterRequest,
    current_user: User,
    search: Optional[str] = None,
    due_date: Optional[str] = None,
) -> tuple[list[Task], int]:
	from app.models.project import Project

	cache_key = (
		f"{TASK_CACHE_DOMAIN}:list:{current_user.workspace_id}:{current_user.id}:"
		f"{_user_role_str(current_user)}:{filters.status}:{filters.priority}:"
		f"{filters.assigned_to}:{filters.project_id}:{due_date}:{search}:{filters.skip}:{filters.limit}"
	)
	cached = cache_service.get_json(cache_key)
	if cached is not None:
		return cached["tasks"], cached["total"]

	query = db.query(Task).join(Project, Task.project_id == Project.id)
	role = _user_role_str(current_user)

	query = query.filter(Project.workspace_id == current_user.workspace_id)

	if role == "employee":
		query = query.filter(Task.assigned_to == current_user.id)
# Admins and project managers see all tasks in the workspace (same team).

	if filters.status is not None:
		query = query.filter(Task.status == filters.status.value)
	if filters.priority is not None:
		query = query.filter(Task.priority == filters.priority.value)
	if filters.assigned_to is not None:
		query = query.filter(Task.assigned_to == filters.assigned_to)
	if filters.project_id is not None:
		query = query.filter(Task.project_id == filters.project_id)
	if due_date:
		query = query.filter(func.date(Task.due_date) == due_date)
	if search:
		query = query.filter(or_(Task.title.ilike(f"%{search}%"), Task.description.ilike(f"%{search}%")))

	total = query.count()
	tasks = query.order_by(Task.created_at.desc()).offset(filters.skip).limit(filters.limit).all()
	cache_service.set_json(
		cache_key,
		{"tasks": [_task_to_dict(task) for task in tasks], "total": total},
		ttl_seconds=90,
	)
	return tasks, total


def get_task(db: Session, task_id: UUID) -> Task:
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


def create_task(db: Session, creator_id: UUID, payload: TaskCreate) -> Task:
	from app.models.project import Project

	creator = db.query(User).filter(User.id == creator_id).first()
	if not creator:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
	project = db.query(Project).filter(Project.id == payload.project_id).first()
	if not project or project.workspace_id != creator.workspace_id:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project")
	if payload.assigned_to is not None:
		assignee = db.query(User).filter(User.id == payload.assigned_to).first()
		if not assignee or assignee.workspace_id != creator.workspace_id:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assignee")

	task = Task(
		created_by=creator_id,
		title=payload.title,
		description=payload.description,
		priority=TaskPriority(payload.priority.value),
		difficulty=payload.difficulty,
		urgency=payload.urgency,
		importance=payload.importance,
		project_id=payload.project_id,
		assigned_to=payload.assigned_to,
		due_date=payload.due_date,
		location=payload.location,
		recurrence_rule=_normalize_recurrence_rule(payload.recurrence_rule.value if payload.recurrence_rule else None),
	)
	db.add(task)
	db.flush()

	if task.assigned_to:
		_notify_task_assignment(db, task, task.assigned_to)

	db.commit()
	db.refresh(task)
	invalidate_task_cache()
	return task


def update_task(
	db: Session,
	task: Task,
	payload: TaskUpdate,
	actor_id: Optional[UUID] = None,
	actor: Optional[User] = None,
) -> Task:
	from app.models.project import Project

	old_assignee = task.assigned_to
	data = payload.model_dump(exclude_unset=True)
	if not data:
		return task

	if actor is not None and _user_role_str(actor) == "employee":
		if task.assigned_to != actor.id:
			raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employees can only update assigned tasks")
		disallowed = set(data) - {"status"}
		if disallowed:
			raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Employees can only update task status")

	status_changed = False
	requested_status: Optional[TaskStatus] = None
	if "status" in data:
		current_status = TaskStatus(task.status.value if hasattr(task.status, "value") else str(task.status))
		requested_status = data["status"] if isinstance(data["status"], TaskStatus) else TaskStatus(data["status"])
		validate_status_transition(current_status, requested_status)
		data["status"] = TaskStatusModel(requested_status.value)
		status_changed = current_status != requested_status

		if requested_status == TaskStatus.DONE:
			task.completed_at = datetime.utcnow()
		else:
			task.completed_at = None

	if "project_id" in data:
		project = db.query(Project).filter(Project.id == data["project_id"]).first()
		if not project:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project")
		if actor is not None and project.workspace_id != actor.workspace_id:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project")

	if "assigned_to" in data and data["assigned_to"] is not None:
		assignee = db.query(User).filter(User.id == data["assigned_to"]).first()
		if not assignee:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assignee")
		project = db.query(Project).filter(Project.id == data.get("project_id", task.project_id)).first()
		if project and assignee.workspace_id != project.workspace_id:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assignee")

	if "recurrence_rule" in data:
		recurrence_value = payload.recurrence_rule.value if payload.recurrence_rule is not None else None
		data["recurrence_rule"] = _normalize_recurrence_rule(recurrence_value)

	for key, value in data.items():
		setattr(task, key, value)

	if task.assigned_to and task.assigned_to != old_assignee and task.assigned_to != actor_id:
		_notify_task_assignment(db, task, task.assigned_to)

	generated_task: Optional[Task] = None
	if status_changed and requested_status == TaskStatus.DONE:
		_notify_task_completion(db, task, actor_id or task.created_by)
		generated_task = _create_next_recurring_task(db, task)

	db.commit()
	db.refresh(task)
	if generated_task is not None:
		db.refresh(generated_task)
	invalidate_task_cache()
	return task


def delete_task(db: Session, task: Task) -> None:
    db.delete(task)
    db.commit()
    invalidate_task_cache()


def update_task_status(db: Session, task: Task, status_value: TaskStatus, actor_id: UUID) -> tuple[Task, Optional[Task]]:
	# Validate status transition
	current_status = TaskStatus(task.status.value if hasattr(task.status, "value") else str(task.status))
	validate_status_transition(current_status, status_value)

	previous_status = task.status.value if hasattr(task.status, "value") else str(task.status)
	# Convert schema TaskStatus to model TaskStatus enum for proper ORM assignment
	task.status = TaskStatusModel(status_value.value)

	if status_value == TaskStatus.DONE:
		task.completed_at = datetime.utcnow()
	else:
		task.completed_at = None

	generated_task: Optional[Task] = None
	status_changed = previous_status != status_value.value

	if status_changed and status_value == TaskStatus.DONE:
		_notify_task_completion(db, task, actor_id)
		generated_task = _create_next_recurring_task(db, task)

	db.commit()
	db.refresh(task)
	if generated_task is not None:
		db.refresh(generated_task)

	invalidate_task_cache()
	return task, generated_task


def reopen_task(db: Session, task: Task) -> Task:
	raise HTTPException(
		status_code=status.HTTP_400_BAD_REQUEST,
		detail="Completed tasks cannot be reopened because the workflow is todo -> in_progress -> done",
	)


def assign_task(db: Session, task: Task, assignee_id: Optional[UUID]) -> Task:
	from app.models.project import Project

	if assignee_id is not None:
		assignee = db.query(User).filter(User.id == assignee_id).first()
		if not assignee:
			raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
		project = db.query(Project).filter(Project.id == task.project_id).first()
		if not project or assignee.workspace_id != project.workspace_id:
			raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid assignee")
		_notify_task_assignment(db, task, assignee_id)
	task.assigned_to = assignee_id
	db.commit()
	db.refresh(task)
	invalidate_task_cache()
	return task


def create_task_from_text(db: Session, creator_id: UUID, project_id: UUID, text: str) -> Task:
	from app.models.project import Project

	creator = db.query(User).filter(User.id == creator_id).first()
	if not creator:
		raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
	project = db.query(Project).filter(Project.id == project_id).first()
	if not project or project.workspace_id != creator.workspace_id:
		raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid project")

	parsed = parse_natural_language_task(text)
	task = Task(
		title=parsed["title"],
		description=parsed["description"],
		priority=TaskPriority(parsed["priority"]),
		due_date=parsed["due_date"],
		project_id=project_id,
		created_by=creator_id,
	)
	db.add(task)
	db.commit()
	db.refresh(task)
	invalidate_task_cache()
	return task


def generate_next_recurring_task(db: Session, task: Task) -> Task:
	if task.status != TaskStatusModel.done:
		raise HTTPException(
			status_code=status.HTTP_400_BAD_REQUEST,
			detail="Recurring instance can only be generated from completed task",
		)

	next_task = _create_next_recurring_task(db, task)
	if next_task is None:
		raise HTTPException(
			status_code=status.HTTP_409_CONFLICT,
			detail="Recurring task already generated or recurrence_rule missing",
		)

	db.commit()
	db.refresh(next_task)
	invalidate_task_cache()
	return next_task


def run_recurrence_generation(db: Session, user_id: UUID, limit: int = 100) -> list[Task]:
	source_tasks = (
		db.query(Task)
		.filter(
			Task.created_by == user_id,
			Task.status == TaskStatusModel.done,
			Task.recurrence_rule.is_not(None),
		)
		.order_by(Task.updated_at.desc(), Task.created_at.desc())
		.limit(limit)
		.all()
	)

	generated: list[Task] = []
	for source_task in source_tasks:
		next_task = _create_next_recurring_task(db, source_task)
		if next_task is not None:
			generated.append(next_task)

	if generated:
		db.commit()
		for task in generated:
			db.refresh(task)
		invalidate_task_cache()

	return generated
