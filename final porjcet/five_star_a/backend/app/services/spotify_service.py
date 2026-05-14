"""Spotify integration service."""

from __future__ import annotations

from typing import Optional
from datetime import datetime, timedelta
from uuid import UUID

import httpx
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.config import settings
from app.models.integration import Integration


def get_spotify_integration(db: Session, user_id: UUID) -> Integration:
    """Get user's Spotify integration."""
    integration = (
        db.query(Integration)
        .filter(
            Integration.user_id == user_id,
            Integration.provider == "spotify",
        )
        .first()
    )
    if not integration or not integration.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Spotify not connected")
    return integration


async def refresh_spotify_token(db: Session, integration: Integration) -> str:
    """Refresh Spotify access token."""
    if not integration.refresh_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token available")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://accounts.spotify.com/api/token",
            data={
                "grant_type": "refresh_token",
                "refresh_token": integration.refresh_token,
                "client_id": settings.SPOTIFY_CLIENT_ID,
                "client_secret": settings.SPOTIFY_CLIENT_SECRET,
            },
        )

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Failed to refresh Spotify token")

    data = response.json()
    integration.access_token = data["access_token"]
    integration.expires_at = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600))
    if "refresh_token" in data:
        integration.refresh_token = data["refresh_token"]

    db.commit()
    return integration.access_token


async def get_currently_playing(db: Session, user_id: UUID) -> dict:
    """Get currently playing track on Spotify."""
    integration = get_spotify_integration(db, user_id)

    if not integration.access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No access token")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.spotify.com/v1/me/player/currently-playing",
            headers={"Authorization": f"Bearer {integration.access_token}"},
        )

    if response.status_code == 401:
        token = await refresh_spotify_token(db, integration)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.spotify.com/v1/me/player/currently-playing",
                headers={"Authorization": f"Bearer {token}"},
            )

    if response.status_code == 204 or response.status_code == 404:
        return {"is_playing": False, "track": None}

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Spotify API error")

    data = response.json()
    item = data.get("item") or {}
    artists = ", ".join(a["name"] for a in item.get("artists", []))

    return {
        "is_playing": data.get("is_playing", False),
        "progress_ms": data.get("progress_ms"),
        "track": {
            "name": item.get("name"),
            "artists": artists,
            "album": item.get("album", {}).get("name"),
            "album_image": item.get("album", {}).get("images", [{}])[0].get("url"),
            "duration_ms": item.get("duration_ms"),
            "external_url": item.get("external_urls", {}).get("spotify"),
        } if item else None,
    }


async def get_recent_tracks(db: Session, user_id: UUID, limit: int = 20) -> list[dict]:
    """Get recently played tracks."""
    integration = get_spotify_integration(db, user_id)

    if not integration.access_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No access token")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.spotify.com/v1/me/player/recently-played?limit={limit}",
            headers={"Authorization": f"Bearer {integration.access_token}"},
        )

    if response.status_code == 401:
        token = await refresh_spotify_token(db, integration)
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://api.spotify.com/v1/me/player/recently-played?limit={limit}",
                headers={"Authorization": f"Bearer {token}"},
            )

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Spotify API error")

    data = response.json()
    tracks = []
    for item in data.get("items", []):
        track = item.get("track", {})
        artists = ", ".join(a["name"] for a in track.get("artists", []))
        tracks.append({
            "name": track.get("name"),
            "artists": artists,
            "album": track.get("album", {}).get("name"),
            "album_image": track.get("album", {}).get("images", [{}])[0].get("url"),
            "played_at": item.get("played_at"),
        })

    return tracks
