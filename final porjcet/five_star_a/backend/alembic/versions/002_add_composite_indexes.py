"""Add composite indexes for optimized query patterns.

Revision ID: 002_composite_indexes
Revises: 001_initial
Create Date: 2026-04-10 12:00:00.000000

"""
from alembic import op

revision = '002_composite_indexes'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite indexes for common query patterns
    
    # Tasks: Filter by project + status (used in project views)
    op.create_index('ix_tasks_project_status', 'tasks', ['project_id', 'status'])
    
    # Tasks: Filter by assignee + status (used in "my tasks" views)
    op.create_index('ix_tasks_assigned_status', 'tasks', ['assigned_to', 'status'])
    
    # Tasks: Filter by project + priority (used in priority filtering)
    op.create_index('ix_tasks_project_priority', 'tasks', ['project_id', 'priority'])
    
    # Tasks: Filter by created_by + status (used in creator views)
    op.create_index('ix_tasks_created_status', 'tasks', ['created_by', 'status'])
    
    # Tasks: Filter by due_date + status (used in overdue/upcoming queries)
    op.create_index('ix_tasks_due_status', 'tasks', ['due_date', 'status'])
    
    # Notifications: Filter by user + read status (used in notification lists)
    op.create_index('ix_notifications_user_read', 'notifications', ['user_id', 'is_read'])
    
    # Notifications: Filter by user + created_at (used in sorted notification lists)
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'])
    
    # Daily goals: Filter by user + target_date (used in goal lookups)
    op.create_index('ix_daily_goals_user_date', 'daily_goals', ['user_id', 'target_date'])
    
    # Friend connections: Bidirectional lookup
    op.create_index('ix_friends_user_friend', 'friend_connections', ['user_id', 'friend_id'])
    op.create_index('ix_friends_friend_user', 'friend_connections', ['friend_id', 'user_id'])


def downgrade() -> None:
    op.drop_index('ix_friends_friend_user', 'friend_connections')
    op.drop_index('ix_friends_user_friend', 'friend_connections')
    op.drop_index('ix_daily_goals_user_date', 'daily_goals')
    op.drop_index('ix_notifications_user_created', 'notifications')
    op.drop_index('ix_notifications_user_read', 'notifications')
    op.drop_index('ix_tasks_due_status', 'tasks')
    op.drop_index('ix_tasks_created_status', 'tasks')
    op.drop_index('ix_tasks_project_priority', 'tasks')
    op.drop_index('ix_tasks_assigned_status', 'tasks')
    op.drop_index('ix_tasks_project_status', 'tasks')
