from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal


class AlbumBase(BaseModel):
    Title: str = Field(..., min_length=1, max_length=160)
    ArtistId: int


class AlbumCreate(AlbumBase):
    pass


class AlbumUpdate(BaseModel):
    Title: Optional[str] = Field(None, min_length=1, max_length=160)
    ArtistId: Optional[int] = None


class Album(AlbumBase):
    AlbumId: int
    artist_name: Optional[str] = None

    class Config:
        from_attributes = True


class AlbumWithArtist(Album):
    artist: Optional[dict] = None

    class Config:
        from_attributes = True


class AlbumWithTracks(Album):
    tracks: List[dict] = []

    class Config:
        from_attributes = True


class Track(BaseModel):
    TrackId: int
    Name: str
    AlbumId: int
    MediaTypeId: int
    GenreId: Optional[int] = None
    Composer: Optional[str] = None
    Milliseconds: int
    Bytes: Optional[int] = None
    UnitPrice: Decimal

    class Config:
        from_attributes = True
