"""Add workspaces for per-tenant isolation.

Revision ID: 003_workspaces
Revises: 002_composite_indexes
Create Date: 2026-04-14 00:00:00.000000

"""
from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "003_workspaces"
down_revision = "002_composite_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, server_default="Workspace"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    default_ws_id = uuid.uuid4()
    bind = op.get_bind()
    bind.execute(
        sa.text("INSERT INTO workspaces (id, name) VALUES (:id, :name)"),
        {"id": default_ws_id, "name": "Default workspace"},
    )

    op.add_column("users", sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True))
    bind.execute(
        sa.text("UPDATE users SET workspace_id = :ws WHERE workspace_id IS NULL"),
        {"ws": default_ws_id},
    )
    op.alter_column("users", "workspace_id", nullable=False)
    op.create_foreign_key("fk_users_workspace_id", "users", "workspaces", ["workspace_id"], ["id"])
    op.create_index("ix_users_workspace_id", "users", ["workspace_id"])

    op.add_column("projects", sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.execute(
        sa.text(
            "UPDATE projects SET workspace_id = users.workspace_id "
            "FROM users WHERE users.id = projects.created_by"
        )
    )
    op.alter_column("projects", "workspace_id", nullable=False)
    op.create_foreign_key("fk_projects_workspace_id", "projects", "workspaces", ["workspace_id"], ["id"])
    op.create_index("ix_projects_workspace_id", "projects", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("ix_projects_workspace_id", table_name="projects")
    op.drop_constraint("fk_projects_workspace_id", "projects", type_="foreignkey")
    op.drop_column("projects", "workspace_id")

    op.drop_index("ix_users_workspace_id", table_name="users")
    op.drop_constraint("fk_users_workspace_id", "users", type_="foreignkey")
    op.drop_column("users", "workspace_id")

    op.drop_table("workspaces")
