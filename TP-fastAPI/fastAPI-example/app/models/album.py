from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship


class Album:
    __tablename__ = 'Album'
    
    AlbumId = Column(Integer, primary_key=True)
    Title = Column(String(160), nullable=False)
    ArtistId = Column(Integer, ForeignKey('Artist.ArtistId'), nullable=False)

