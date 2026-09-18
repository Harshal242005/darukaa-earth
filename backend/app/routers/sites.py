import json

from fastapi import APIRouter, Depends, HTTPException
from geoalchemy2 import Geography
from geoalchemy2.functions import ST_Area, ST_AsGeoJSON, ST_Centroid
from geoalchemy2.shape import from_shape
from shapely.geometry import shape
from sqlalchemy import cast
from sqlalchemy.orm import Session

from app import schemas
from app.analytics import generate_metrics_for_site
from app.database import get_db
from app.models import Project, Site, User
from app.security import get_current_user

router = APIRouter(prefix="/api", tags=["sites"])


def _site_to_out(db, site) -> schemas.SiteOut:
    geojson, centroid = (
        db.query(ST_AsGeoJSON(Site.geom), ST_AsGeoJSON(ST_Centroid(Site.geom)))
        .filter(Site.id == site.id)
        .first()
    )
    c = json.loads(centroid)["coordinates"]
    return schemas.SiteOut(
        id=site.id,
        project_id=site.project_id,
        name=site.name,
        area_hectares=site.area_hectares,
        geometry=json.loads(geojson),
        centroid=c,
    )


def _assert_owner(db, project_id, user):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")
    return project


@router.get("/projects/{project_id}/sites", response_model=list[schemas.SiteOut])
def list_sites(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _assert_owner(db, project_id, user)
    sites = db.query(Site).filter(Site.project_id == project_id).all()
    return [_site_to_out(db, s) for s in sites]


@router.post(
    "/projects/{project_id}/sites",
    response_model=schemas.SiteOut,
    status_code=201,
)
def create_site(
    project_id: int,
    payload: schemas.SiteCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _assert_owner(db, project_id, user)
    if payload.geometry.get("type") != "Polygon":
        raise HTTPException(422, "Geometry must be a GeoJSON Polygon")

    # GeoJSON → Shapely → GeoAlchemy2 WKTElement with SRID 4326
    geom = from_shape(shape(payload.geometry), srid=4326)

    site = Site(project_id=project_id, name=payload.name, geom=geom)
    db.add(site)
    db.flush()

    # Geodesic area in hectares, denormalised at write time.
    area = (
        db.query(ST_Area(cast(Site.geom, Geography)) / 10000.0)
        .filter(Site.id == site.id)
        .scalar()
    )
    site.area_hectares = round(float(area), 4)

    generate_metrics_for_site(db, site)
    db.commit()
    db.refresh(site)
    return _site_to_out(db, site)


@router.get("/sites", response_model=list[schemas.SiteOut])
def all_sites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Every site across every project — powers the global map view."""
    sites = db.query(Site).join(Project).filter(Project.owner_id == user.id).all()
    return [_site_to_out(db, s) for s in sites]
