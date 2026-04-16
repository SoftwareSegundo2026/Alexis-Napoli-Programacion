from app.repositories.base_repository import BaseRepository
from app.schemas.album import AlbumCreate, AlbumUpdate
from models_all.models import Album
from sqlalchemy import select


class AlbumRepository(BaseRepository[Album, AlbumCreate, AlbumUpdate]):
    """Album-specific repository."""

    async def get_by_artist(self, db, artist_id: int):
        """Get all albums by artist."""
        from sqlalchemy import select
        result = await db.execute(
            select(Album).where(Album.ArtistId == artist_id)
        )
        return result.scalars().all()

    async def get_by_title(self, db, title: str):
        """Get album by title."""
        from sqlalchemy import select
        result = await db.execute(
            select(Album).where(Album.Title == title)
        )
        return result.scalars().first()


album_repository = AlbumRepository(Album)
