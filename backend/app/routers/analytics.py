from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.models import Project, Site, SiteMetric, User
from app.security import get_current_user

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/sites/{site_id}/analytics", response_model=schemas.SiteAnalytics)
def site_analytics(
    site_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    site = (
        db.query(Site)
        .join(Project)
        .filter(Site.id == site_id, Project.owner_id == user.id)
        .first()
    )
    if not site:
        raise HTTPException(404, "Site not found")

    rows = (
        db.query(SiteMetric)
        .filter(SiteMetric.site_id == site_id)
        .order_by(SiteMetric.recorded_at)
        .all()
    )
    if not rows:
        raise HTTPException(404, "No metrics for site")

    first, last = rows[0].carbon_tco2e, rows[-1].carbon_tco2e
    trend = ((last - first) / first * 100) if first else 0.0

    return schemas.SiteAnalytics(
        site_id=site.id,
        site_name=site.name,
        area_hectares=site.area_hectares or 0.0,
        total_carbon_tco2e=round(sum(r.carbon_tco2e for r in rows), 2),
        avg_ndvi=round(sum(r.ndvi for r in rows) / len(rows), 4),
        latest_species_count=rows[-1].species_count,
        carbon_trend_pct=round(trend, 2),
        series=[
            schemas.MetricPoint(
                recorded_at=r.recorded_at,
                ndvi=r.ndvi,
                biomass_tonnes=r.biomass_tonnes,
                carbon_tco2e=r.carbon_tco2e,
                species_count=r.species_count,
            )
            for r in rows
        ],
    )
