from app.repositories.base_repository import BaseRepository
from app.schemas.artist import ArtistCreate, ArtistUpdate
from sqlalchemy import select
from models_all.models import Artist


class ArtistRepository(BaseRepository[Artist, ArtistCreate, ArtistUpdate]):
    """Artist-specific repository."""

    async def get_by_name(self, db, name: str):
        """Get artist by name."""
        result = await db.execute(
            select(Artist).where(Artist.Name == name)
        )
        return result.scalars().first()

artist_repository = ArtistRepository(Artist)