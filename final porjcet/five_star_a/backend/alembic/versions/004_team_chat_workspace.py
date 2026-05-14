"""Add workspace isolation to team chat messages.

Revision ID: 004_team_chat_workspace
Revises: 003_workspaces
Create Date: 2026-04-14 00:00:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "004_team_chat_workspace"
down_revision = "003_workspaces"
branch_labels = None
depends_on = None


def upgrade() -> None:
	op.add_column(
		"team_chat_messages",
		sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=True),
	)

	# Backfill: message.workspace_id = author.workspace_id
	bind = op.get_bind()
	bind.execute(
		sa.text(
			"UPDATE team_chat_messages "
			"SET workspace_id = users.workspace_id "
			"FROM users "
			"WHERE users.id = team_chat_messages.user_id"
		)
	)

	op.alter_column("team_chat_messages", "workspace_id", nullable=False)
	op.create_foreign_key(
		"fk_team_chat_messages_workspace_id",
		"team_chat_messages",
		"workspaces",
		["workspace_id"],
		["id"],
	)
	op.create_index(
		"ix_team_chat_messages_workspace_id",
		"team_chat_messages",
		["workspace_id"],
	)


def downgrade() -> None:
	op.drop_index("ix_team_chat_messages_workspace_id", table_name="team_chat_messages")
	op.drop_constraint("fk_team_chat_messages_workspace_id", "team_chat_messages", type_="foreignkey")
	op.drop_column("team_chat_messages", "workspace_id")

