"""Tests for task status transition validation."""

import pytest
from fastapi import HTTPException, status
from uuid import uuid4

from app.schemas.task import TaskStatus
from app.services.task_service import validate_status_transition, VALID_STATUS_TRANSITIONS


class TestStatusTransitionValidation:
    """Test task status transition business rules."""

    def test_todo_to_in_progress_allowed(self):
        """Should allow transition from todo to in_progress."""
        # Should not raise
        validate_status_transition(TaskStatus.TODO, TaskStatus.IN_PROGRESS)

    def test_todo_to_done_not_allowed(self):
        """Should require todo -> in_progress before done."""
        with pytest.raises(HTTPException) as exc_info:
            validate_status_transition(TaskStatus.TODO, TaskStatus.DONE)

        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid status transition" in exc_info.value.detail

    def test_in_progress_to_done_allowed(self):
        """Should allow transition from in_progress to done."""
        # Should not raise
        validate_status_transition(TaskStatus.IN_PROGRESS, TaskStatus.DONE)

    def test_done_to_todo_not_allowed(self):
        """Should NOT allow backward transition from done to todo."""
        with pytest.raises(HTTPException) as exc_info:
            validate_status_transition(TaskStatus.DONE, TaskStatus.TODO)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid status transition" in exc_info.value.detail
        assert "done" in exc_info.value.detail.lower()
        assert "todo" in exc_info.value.detail.lower()

    def test_done_to_in_progress_not_allowed(self):
        """Should NOT allow backward transition from done to in_progress."""
        with pytest.raises(HTTPException) as exc_info:
            validate_status_transition(TaskStatus.DONE, TaskStatus.IN_PROGRESS)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid status transition" in exc_info.value.detail

    def test_in_progress_to_todo_not_allowed(self):
        """Should NOT allow backward transition from in_progress to todo."""
        with pytest.raises(HTTPException) as exc_info:
            validate_status_transition(TaskStatus.IN_PROGRESS, TaskStatus.TODO)
        
        assert exc_info.value.status_code == status.HTTP_400_BAD_REQUEST
        assert "Invalid status transition" in exc_info.value.detail

    def test_same_status_no_error(self):
        """Should allow setting same status (no-op)."""
        # Should not raise
        validate_status_transition(TaskStatus.TODO, TaskStatus.TODO)
        validate_status_transition(TaskStatus.IN_PROGRESS, TaskStatus.IN_PROGRESS)
        validate_status_transition(TaskStatus.DONE, TaskStatus.DONE)

    def test_valid_transitions_constant_defined(self):
        """Should have proper transition rules defined."""
        assert TaskStatus.TODO in VALID_STATUS_TRANSITIONS
        assert TaskStatus.IN_PROGRESS in VALID_STATUS_TRANSITIONS
        assert TaskStatus.DONE in VALID_STATUS_TRANSITIONS
        
        # TODO can only go to IN_PROGRESS
        assert TaskStatus.IN_PROGRESS in VALID_STATUS_TRANSITIONS[TaskStatus.TODO]
        assert TaskStatus.DONE not in VALID_STATUS_TRANSITIONS[TaskStatus.TODO]
        
        # IN_PROGRESS can only go to DONE
        assert TaskStatus.DONE in VALID_STATUS_TRANSITIONS[TaskStatus.IN_PROGRESS]
        assert TaskStatus.TODO not in VALID_STATUS_TRANSITIONS[TaskStatus.IN_PROGRESS]
        
        # DONE cannot go anywhere
        assert len(VALID_STATUS_TRANSITIONS[TaskStatus.DONE]) == 0

    def test_error_message_includes_allowed_transitions(self):
        """Error message should include list of allowed transitions."""
        with pytest.raises(HTTPException) as exc_info:
            validate_status_transition(TaskStatus.DONE, TaskStatus.TODO)
        
        # Error should mention that no transitions are allowed from done
        assert "none" in exc_info.value.detail.lower() or "in_progress" in exc_info.value.detail.lower()

    def test_error_message_for_in_progress_to_todo(self):
        """Error message should show allowed transitions for in_progress."""
        with pytest.raises(HTTPException) as exc_info:
            validate_status_transition(TaskStatus.IN_PROGRESS, TaskStatus.TODO)
        
        # Should mention that only 'done' is allowed
        assert "done" in exc_info.value.detail.lower()
