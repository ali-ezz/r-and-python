"""Integrations API - manage connected services."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.integration import Integration
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.analytics_focus import IntegrationItem, IntegrationConnectResponse
from app.services import integration_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/integrations", tags=["integrations"])


class IntegrationConnectRequest(BaseModel):
    provider: str
    settings: dict = Field(default_factory=dict)


@router.get("", response_model=list[IntegrationItem])
def list_integrations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> list[IntegrationItem]:
    """List all connected integrations for the current user."""
    integrations = integration_service.list_integrations(db, current_user.id)
    return [
        IntegrationItem(
            id=str(item.id),
            provider=item.provider.value if hasattr(item.provider, "value") else str(item.provider),
            is_active=item.is_active,
            last_sync=str(item.last_sync) if item.last_sync else None,
        )
        for item in integrations
    ]


@router.post("/connect", response_model=IntegrationConnectResponse, status_code=status.HTTP_201_CREATED)
def connect_integration(
    payload: IntegrationConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> IntegrationConnectResponse:
    """Connect a new integration."""
    if payload.provider not in ("spotify",):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unsupported provider: {payload.provider}")

    integration = integration_service.connect_integration(
        db,
        current_user.id,
        payload.provider,
        settings_payload=payload.settings,
    )
    return IntegrationConnectResponse(
        id=str(integration.id),
        provider=integration.provider.value if hasattr(integration.provider, "value") else str(integration.provider),
        is_active=integration.is_active,
    )


@router.delete("/{provider}", response_model=MessageResponse)
def disconnect_integration(
    provider: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> MessageResponse:
    """Disconnect an integration."""
    integration = (
        db.query(Integration)
        .filter(Integration.user_id == current_user.id, Integration.provider == provider)
        .first()
    )
    if not integration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not found")

    db.delete(integration)
    db.commit()
    return MessageResponse(message=f"{provider} integration disconnected")
