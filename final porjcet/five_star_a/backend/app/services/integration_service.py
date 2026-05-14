"""Integration service - manage provider connections."""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.integration import Integration, IntegrationProvider


def list_integrations(db: Session, user_id: UUID) -> list[Integration]:
    """List all integrations for a user."""
    return db.query(Integration).filter(Integration.user_id == user_id).all()


def connect_integration(
    db: Session,
    user_id: UUID,
    provider: str,
    settings_payload: Optional[dict] = None,
) -> Integration:
    """Connect or update an integration for a user."""
    provider_enum = IntegrationProvider(provider)
    integration = (
        db.query(Integration)
        .filter(Integration.user_id == user_id, Integration.provider == provider_enum)
        .first()
    )

    if integration:
        integration.is_active = True
        integration.settings = settings_payload or integration.settings
    else:
        integration = Integration(
            user_id=user_id,
            provider=provider_enum,
            settings=settings_payload or {},
        )
        db.add(integration)

    db.commit()
    db.refresh(integration)
    return integration
