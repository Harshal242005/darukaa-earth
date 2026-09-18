from geoalchemy2 import Geometry
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    projects = relationship(
        "Project", back_populates="owner", cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    project_type = Column(String(50), default="carbon")
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    owner = relationship("User", back_populates="projects")
    sites = relationship("Site", back_populates="project", cascade="all, delete-orphan")


class Site(Base):
    __tablename__ = "sites"
    id = Column(Integer, primary_key=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String(255), nullable=False)
    geom = Column(Geometry("POLYGON", srid=4326, spatial_index=True), nullable=False)
    area_hectares = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    project = relationship("Project", back_populates="sites")
    metrics = relationship(
        "SiteMetric", back_populates="site", cascade="all, delete-orphan"
    )


class SiteMetric(Base):
    __tablename__ = "site_metrics"
    __table_args__ = (UniqueConstraint("site_id", "recorded_at"),)
    id = Column(Integer, primary_key=True)
    site_id = Column(
        Integer,
        ForeignKey("sites.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recorded_at = Column(Date, nullable=False)
    ndvi = Column(Float)
    biomass_tonnes = Column(Float)
    carbon_tco2e = Column(Float)
    species_count = Column(Integer)
    site = relationship("Site", back_populates="metrics")
