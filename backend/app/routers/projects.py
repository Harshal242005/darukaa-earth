from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.models import Project, Site, User
from app.security import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.get("", response_model=list[schemas.ProjectOut])
def list_projects(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(
            Project,
            func.count(Site.id).label("site_count"),
            func.coalesce(func.sum(Site.area_hectares), 0.0).label("total_ha"),
        )
        .outerjoin(Site, Site.project_id == Project.id)
        .filter(Project.owner_id == user.id)
        .group_by(Project.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return [
        schemas.ProjectOut(
            id=p.id,
            name=p.name,
            description=p.description,
            project_type=p.project_type,
            created_at=p.created_at,
            site_count=c,
            total_hectares=round(ha, 2),
        )
        for p, c, ha in rows
    ]


@router.post("", response_model=schemas.ProjectOut, status_code=201)
def create_project(
    payload: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(**payload.model_dump(), owner_id=user.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return schemas.ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=schemas.ProjectOut)
def get_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")
    return schemas.ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.owner_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(404, "Project not found")
    db.delete(project)
    db.commit()
