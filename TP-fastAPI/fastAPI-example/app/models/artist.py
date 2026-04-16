from sqlalchemy import Column, Integer, String


class Artist:
    __tablename__ = 'Artist'
    ArtistId = Column(Integer, primary_key=True)
    Name = Column(String(120))