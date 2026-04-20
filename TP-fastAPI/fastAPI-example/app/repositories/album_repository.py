from app.repositories.base_repository import BaseRepository
from app.schemas.album import AlbumCreate, AlbumUpdate
from models_all.models import Album
from sqlalchemy import select


class AlbumRepository(BaseRepository[Album, AlbumCreate, AlbumUpdate]):
    """Album-specific repository."""

    async def get_multi(
        self,
        db,
        skip: int = 0,
        limit: int = 100
    ):
        """Get multiple albums with artist name."""
        from models_all.models import Artist
        result = await db.execute(
            select(Album, Artist.Name.label('artist_name'))
            .join(Artist, Album.ArtistId == Artist.ArtistId)
            .offset(skip)
            .limit(limit)
        )
        albums = result.all()
        # Since we have Album and artist_name, we need to set it on the Album object
        for album, artist_name in albums:
            album.artist_name = artist_name
        return [album for album, _ in albums]

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
