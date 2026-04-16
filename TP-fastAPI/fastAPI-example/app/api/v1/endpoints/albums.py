from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.schemas.album import Album, AlbumCreate, AlbumUpdate, Track
from app.services.album_service import album_service

router = APIRouter()


@router.post("/", response_model=Album, status_code=status.HTTP_201_CREATED)
async def create_album(
    album_in: AlbumCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new album."""
    try:
        album = await album_service.create_album(db, album_in)
        return album
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=List[Album])
async def read_albums(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get multiple albums with pagination."""
    albums = await album_service.get_albums(db, skip, limit)
    return albums


@router.get("/artist/{artist_id}", response_model=List[Album])
async def read_albums_by_artist(
    artist_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all albums by a specific artist."""
    albums = await album_service.get_albums_by_artist(db, artist_id)
    if not albums:
        raise HTTPException(status_code=404, detail="No albums found for this artist")
    return albums


@router.get("/{album_id}/tracks", response_model=List[Track])
async def read_album_tracks(
    album_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get all tracks for a specific album."""
    try:
        album = await album_service.get_album(db, album_id)
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        
        tracks = await album_service.get_album_tracks(db, album_id)
        return tracks
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving tracks: {str(e)}")


@router.get("/{album_id}", response_model=Album)
async def read_album(
    album_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get album by ID."""
    album = await album_service.get_album(db, album_id)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


@router.patch("/{album_id}", response_model=Album)
async def update_album(
    album_id: int,
    album_in: AlbumUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update album."""
    try:
        album = await album_service.update_album(db, album_id, album_in)
        if not album:
            raise HTTPException(status_code=404, detail="Album not found")
        return album
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{album_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_album(
    album_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete album."""
    deleted = await album_service.delete_album(db, album_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Album not found")
