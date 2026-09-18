from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None


class UserOut(BaseModel):
    id: int
    email: EmailStr
    full_name: str | None
    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    project_type: Literal["carbon", "biodiversity", "mixed"] = "carbon"


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    project_type: str
    created_at: datetime
    site_count: int = 0
    total_hectares: float = 0.0
    model_config = {"from_attributes": True}


class SiteCreate(BaseModel):
    name: str
    geometry: dict[str, Any]


class SiteOut(BaseModel):
    id: int
    project_id: int
    name: str
    area_hectares: float | None
    geometry: dict[str, Any]
    centroid: list[float] | None = None


class MetricPoint(BaseModel):
    recorded_at: date
    ndvi: float
    biomass_tonnes: float
    carbon_tco2e: float
    species_count: int


class SiteAnalytics(BaseModel):
    site_id: int
    site_name: str
    area_hectares: float
    total_carbon_tco2e: float
    avg_ndvi: float
    latest_species_count: int
    carbon_trend_pct: float
    series: list[MetricPoint]
