"""Spotify integration API."""

from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.analytics_focus import SpotifyTrackResponse, SpotifyRecentlyPlayedResponse
from app.services import spotify_service
from app.utils.dependencies import get_current_active_user

router = APIRouter(prefix="/integrations/spotify", tags=["spotify"])


def _normalize_track(item: dict) -> dict:
    """Normalize a track dict from the service to match the response model."""
    # Service returns nested 'track' object for now-playing, or flat for recent
    track = item.get("track", item)
    if not track:
        return {"title": "Unknown", "artist": "Unknown"}
    return {
        "title": track.get("name", "Unknown"),
        "artist": track.get("artists", "Unknown"),
        "album": track.get("album"),
        "album_art": track.get("album_image"),
        "url": track.get("external_url"),
        "playing_at": item.get("played_at") or track.get("played_at"),
    }


@router.get("/now-playing", response_model=SpotifyTrackResponse)
async def get_now_playing(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SpotifyTrackResponse:
    """Get currently playing track."""
    data = await spotify_service.get_currently_playing(db, current_user.id)
    if not data or not data.get("track"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No track currently playing")
    return SpotifyTrackResponse(**_normalize_track(data))


@router.get("/recent", response_model=SpotifyRecentlyPlayedResponse)
async def get_recent_tracks(
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
) -> SpotifyRecentlyPlayedResponse:
    """Get recently played tracks."""
    data = await spotify_service.get_recent_tracks(db, current_user.id, limit)
    tracks = [_normalize_track(item) for item in data] if isinstance(data, list) else []
    return SpotifyRecentlyPlayedResponse(tracks=[SpotifyTrackResponse(**t) for t in tracks])
