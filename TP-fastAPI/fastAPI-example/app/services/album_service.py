from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.repositories.album_repository import album_repository
from app.schemas.album import AlbumCreate, AlbumUpdate, Album
from models_all.models import Album as AlbumModel, Artist


class AlbumService:
    """Business logic for albums."""

    def __init__(self):
        self.repository = album_repository

    async def get_album(self, db: AsyncSession, album_id: int) -> Optional[Album]:
        """Get album by ID."""
        return await self.repository.get(db, album_id)

    async def get_albums(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[Album]:
        """Get multiple albums."""
        return await self.repository.get_multi(db, skip, limit)

    async def get_albums_by_artist(self, db: AsyncSession, artist_id: int) -> List[Album]:
        """Get all albums by a specific artist."""
        return await self.repository.get_by_artist(db, artist_id)

    async def create_album(self, db: AsyncSession, album_in: AlbumCreate) -> Album:
        """Create new album."""
        # Validate artist exists
        result = await db.execute(
            select(Artist).where(Artist.ArtistId == album_in.ArtistId)
        )
        artist = result.scalars().first()
        if not artist:
            raise ValueError(f"Artist with ID {album_in.ArtistId} not found")
        
        return await self.repository.create(db, album_in)

    async def update_album(self, db: AsyncSession, album_id: int, album_in: AlbumUpdate) -> Optional[Album]:
        """Update album."""
        album = await self.repository.get(db, album_id)
        if not album:
            return None
        
        # If ArtistId is being updated, validate it exists
        if album_in.ArtistId:
            result = await db.execute(
                select(Artist).where(Artist.ArtistId == album_in.ArtistId)
            )
            artist = result.scalars().first()
            if not artist:
                raise ValueError(f"Artist with ID {album_in.ArtistId} not found")
        
        return await self.repository.update(db, album, album_in)

    async def delete_album(self, db: AsyncSession, album_id: int) -> bool:
        """Delete album."""
        return await self.repository.delete(db, album_id)

    async def get_album_tracks(self, db: AsyncSession, album_id: int) -> list:
        """Get all tracks for an album."""
        from models_all.models import Track
        
        result = await db.execute(
            select(Track).where(Track.AlbumId == album_id)
        )
        tracks = result.scalars().all()
        return tracks


album_service = AlbumService()
