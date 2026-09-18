import hashlib
import math
from datetime import date

from dateutil.relativedelta import relativedelta

from app.models import SiteMetric

MONTHS = 24


def _seed(site_id: int, area: float) -> int:
    raw = f"{site_id}:{area:.4f}".encode()
    return int(hashlib.sha256(raw).hexdigest()[:8], 16)


def generate_metrics_for_site(db, site) -> None:
    """Seed 24 months of plausible metrics derived from the site's geometry.

    Real deployments would pull Sentinel-2 NDVI via Google Earth Engine;
    this keeps the demo deterministic and offline.
    """
    area = site.area_hectares or 1.0
    seed = _seed(site.id, area)
    base_ndvi = 0.45 + (seed % 25) / 100.0
    start = date.today().replace(day=1) - relativedelta(months=MONTHS - 1)

    for i in range(MONTHS):
        d = start + relativedelta(months=i)
        season = 0.08 * math.sin((d.month / 12.0) * 2 * math.pi)
        growth = 0.0025 * i
        ndvi = max(0.05, min(0.95, base_ndvi + season + growth))
        biomass = area * (40 + 120 * ndvi)
        carbon = biomass * 0.47 * 3.67 / 1000.0
        species = int(12 + 60 * ndvi + (seed % 7))

        db.add(
            SiteMetric(
                site_id=site.id,
                recorded_at=d,
                ndvi=round(ndvi, 4),
                biomass_tonnes=round(biomass, 2),
                carbon_tco2e=round(carbon, 3),
                species_count=species,
            )
        )
