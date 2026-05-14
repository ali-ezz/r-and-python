"""Alembic initial migration - create all tables from current models.

Revision ID: 001_initial
Revises:
Create Date: 2026-04-07 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enums
    op.execute("CREATE TYPE user_role AS ENUM ('admin', 'project_manager', 'employee')")
    op.execute("CREATE TYPE oauth_provider AS ENUM ('google', 'github', 'microsoft')")
    op.execute("CREATE TYPE device_type AS ENUM ('web', 'mobile', 'desktop', 'extension')")
    op.execute("CREATE TYPE project_member_role AS ENUM ('owner', 'editor', 'viewer')")
    op.execute("CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done')")
    op.execute("CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent')")
    op.execute("CREATE TYPE collection_view AS ENUM ('list', 'kanban', 'grid', 'planner', 'skyline', 'calendar', 'stream', 'matrix', 'workload', 'map')")
    op.execute("CREATE TYPE integration_provider AS ENUM ('spotify')")
    op.execute("CREATE TYPE widget_type AS ENUM ('weather', 'spotify', 'pomodoro', 'goals', 'insights', 'friends')")
    op.execute("CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked')")
    op.execute("CREATE TYPE notification_type AS ENUM ('system', 'task_assigned', 'task_completed', 'recurring_generated')")

    # Users
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('username', sa.String(100), nullable=False, unique=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(200), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('role', sa.Enum('admin', 'project_manager', 'employee', name='user_role'), nullable=False, server_default='employee'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('is_verified', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('two_factor_enabled', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('two_factor_secret', sa.String(32), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('preferences', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='UTC'),
    )
    op.create_index('ix_users_email', 'users', ['email'])
    op.create_index('ix_users_username', 'users', ['username'])
    op.create_index('ix_users_created_at', 'users', ['created_at'])

    # OAuth accounts
    op.create_table('oauth_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider', sa.Enum('google', 'github', 'microsoft', name='oauth_provider'), nullable=False),
        sa.Column('provider_user_id', sa.String(255), nullable=False),
        sa.Column('access_token', sa.Text, nullable=True),
        sa.Column('refresh_token', sa.Text, nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('provider', 'provider_user_id', name='uq_oauth_provider_user'),
    )
    op.create_index('ix_oauth_accounts_user_id', 'oauth_accounts', ['user_id'])

    # Devices
    op.create_table('devices',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('device_name', sa.String(200), nullable=False),
        sa.Column('device_type', sa.Enum('web', 'mobile', 'desktop', 'extension', name='device_type'), nullable=False),
        sa.Column('device_fingerprint', sa.String(255), nullable=False, unique=True),
        sa.Column('last_active', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.Text, nullable=True),
        sa.Column('is_trusted', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Refresh tokens
    op.create_table('refresh_tokens',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('token', sa.String(500), nullable=False, unique=True),
        sa.Column('device_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('devices.id'), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_refresh_tokens_token', 'refresh_tokens', ['token'])

    # Projects
    op.create_table('projects',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('color', sa.String(7), nullable=False, server_default='#000000'),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('is_template', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('template_category', sa.String(100), nullable=True),
        sa.Column('settings', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_projects_name', 'projects', ['name'])

    # Project members
    op.create_table('project_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.Enum('owner', 'editor', 'viewer', name='project_member_role'), nullable=False, server_default='viewer'),
        sa.Column('can_edit', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('can_delete', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('project_id', 'user_id', name='uq_project_member'),
    )

    # Tasks
    op.create_table('tasks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('title', sa.String(500), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('rich_content', postgresql.JSON, nullable=True),
        sa.Column('status', sa.Enum('todo', 'in_progress', 'done', name='task_status'), nullable=False, server_default='todo'),
        sa.Column('priority', sa.Enum('low', 'medium', 'high', 'urgent', name='task_priority'), nullable=False, server_default='medium'),
        sa.Column('difficulty', sa.Integer, nullable=False, server_default='1'),
        sa.Column('urgency', sa.Integer, nullable=False, server_default='1'),
        sa.Column('importance', sa.Integer, nullable=False, server_default='1'),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('assigned_to', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('start_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('estimated_duration', sa.Integer, nullable=True),
        sa.Column('actual_duration', sa.Integer, nullable=True),
        sa.Column('location', sa.String(500), nullable=True),
        sa.Column('latitude', sa.Float, nullable=True),
        sa.Column('longitude', sa.Float, nullable=True),
        sa.Column('voice_note_url', sa.String(500), nullable=True),
        sa.Column('parent_task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id'), nullable=True),
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('recurrence_rule', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_tasks_title', 'tasks', ['title'])
    op.create_index('ix_tasks_status', 'tasks', ['status'])
    op.create_index('ix_tasks_priority', 'tasks', ['priority'])
    op.create_index('ix_tasks_project_id', 'tasks', ['project_id'])
    op.create_index('ix_tasks_assigned_to', 'tasks', ['assigned_to'])
    op.create_index('ix_tasks_due_date', 'tasks', ['due_date'])

    # Task attachments
    op.create_table('task_attachments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id'), nullable=False),
        sa.Column('file_url', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_type', sa.String(100), nullable=False),
        sa.Column('file_size', sa.BigInteger, nullable=False),
        sa.Column('uploaded_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Task comments
    op.create_table('task_comments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id'), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('content', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Labels
    op.create_table('labels',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(7), nullable=False, server_default='#000000'),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('is_ai_generated', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('usage_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'name', name='uq_label_user_name'),
    )
    op.create_index('ix_labels_name', 'labels', ['name'])

    # Task labels association
    op.create_table('task_labels',
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id'), primary_key=True),
        sa.Column('label_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('labels.id'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Collections
    op.create_table('collections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(300), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('color', sa.String(7), nullable=False, server_default='#000000'),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('default_view', sa.Enum('list', 'kanban', 'grid', 'planner', 'skyline', 'calendar', 'stream', 'matrix', 'workload', 'map', name='collection_view'), nullable=False, server_default='list'),
        sa.Column('is_shared', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('is_template', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('pin_protected', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('pin_hash', sa.String(255), nullable=True),
        sa.Column('settings', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_collections_name', 'collections', ['name'])

    # User collections association
    op.create_table('user_collections',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), primary_key=True),
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('collections.id'), primary_key=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Collection projects association
    op.create_table('collection_projects',
        sa.Column('collection_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('collections.id'), primary_key=True),
        sa.Column('project_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('projects.id'), primary_key=True),
    )

    # Integrations
    op.create_table('integrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('provider', sa.Enum('spotify', name='integration_provider'), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('access_token', sa.Text, nullable=True),
        sa.Column('refresh_token', sa.Text, nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('settings', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('last_sync', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
        sa.UniqueConstraint('user_id', 'provider', name='uq_user_provider'),
    )

    # Widget states
    op.create_table('widget_states',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('widget_type', sa.Enum('weather', 'spotify', 'pomodoro', 'goals', 'insights', 'friends', name='widget_type'), nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='true'),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
        sa.Column('settings', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('state', postgresql.JSON, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Pomodoro sessions
    op.create_table('pomodoro_sessions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id'), nullable=True),
        sa.Column('duration', sa.Integer, nullable=False),
        sa.Column('break_duration', sa.Integer, nullable=False),
        sa.Column('completed_cycles', sa.Integer, nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Daily goals
    op.create_table('daily_goals',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('goal_text', sa.String(500), nullable=False),
        sa.Column('target_date', sa.Date, nullable=False),
        sa.Column('is_completed', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_daily_goals_target_date', 'daily_goals', ['target_date'])

    # User analytics
    op.create_table('user_analytics',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('date', sa.Date, nullable=False),
        sa.Column('tasks_created', sa.Integer, nullable=False, server_default='0'),
        sa.Column('tasks_completed', sa.Integer, nullable=False, server_default='0'),
        sa.Column('tasks_overdue', sa.Integer, nullable=False, server_default='0'),
        sa.Column('pomodoro_sessions', sa.Integer, nullable=False, server_default='0'),
        sa.Column('active_minutes', sa.Integer, nullable=False, server_default='0'),
        sa.Column('productivity_score', sa.Float, nullable=False, server_default='0.0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'date', name='uq_user_analytics_date'),
    )
    op.create_index('ix_user_analytics_date', 'user_analytics', ['date'])

    # Friend connections
    op.create_table('friend_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('friend_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('status', sa.Enum('pending', 'accepted', 'blocked', name='friend_status'), nullable=False, server_default='pending'),
        sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('user_id', 'friend_id', name='uq_friend_connection'),
        sa.CheckConstraint('user_id <> friend_id', name='ck_user_not_friend_self'),
    )

    # Notifications
    op.create_table('notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('title', sa.String(220), nullable=False),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('notification_type', sa.Enum('system', 'task_assigned', 'task_completed', 'recurring_generated', name='notification_type'), nullable=False, server_default='system'),
        sa.Column('related_task_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('tasks.id'), nullable=True),
        sa.Column('extra_data', postgresql.JSON, nullable=True),
        sa.Column('is_read', sa.Boolean, nullable=False, server_default='false'),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('ix_notifications_type', 'notifications', ['notification_type'])
    op.create_index('ix_notifications_is_read', 'notifications', ['is_read'])
    op.create_index('ix_notifications_related_task_id', 'notifications', ['related_task_id'])
    op.create_index('ix_notifications_created_at', 'notifications', ['created_at'])

    # Seed admin user
    op.execute("""
        INSERT INTO users (id, email, username, hashed_password, full_name, role, is_active, is_verified, timezone, preferences)
        VALUES (gen_random_uuid(), 'admin@5stara.com', 'admin', '$2b$12$placeholder_hash_replace_on_first_login', 'System Admin', 'admin', true, true, 'UTC', '{}')
    """)


def downgrade() -> None:
    op.drop_table('notifications')
    op.drop_table('friend_connections')
    op.drop_table('user_analytics')
    op.drop_table('daily_goals')
    op.drop_table('pomodoro_sessions')
    op.drop_table('widget_states')
    op.drop_table('integrations')
    op.drop_table('collection_projects')
    op.drop_table('user_collections')
    op.drop_table('collections')
    op.drop_table('task_labels')
    op.drop_table('labels')
    op.drop_table('task_comments')
    op.drop_table('task_attachments')
    op.drop_table('tasks')
    op.drop_table('project_members')
    op.drop_table('projects')
    op.drop_table('refresh_tokens')
    op.drop_table('devices')
    op.drop_table('oauth_accounts')
    op.drop_table('users')

    # Drop enums
    op.execute("DROP TYPE notification_type")
    op.execute("DROP TYPE friend_status")
    op.execute("DROP TYPE widget_type")
    op.execute("DROP TYPE integration_provider")
    op.execute("DROP TYPE collection_view")
    op.execute("DROP TYPE task_priority")
    op.execute("DROP TYPE task_status")
    op.execute("DROP TYPE project_member_role")
    op.execute("DROP TYPE device_type")
    op.execute("DROP TYPE oauth_provider")
    op.execute("DROP TYPE user_role")
