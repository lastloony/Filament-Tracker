from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import crud, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/filaments", tags=["filaments"], dependencies=[Depends(get_current_user)])


def _get_or_404(db: Session, filament_id: int):
    filament = crud.get_filament(db, filament_id)
    if filament is None:
        raise HTTPException(status_code=404, detail="Filament not found")
    return filament


@router.get("", response_model=list[schemas.FilamentRead])
def list_filaments(
    brand: str | None = None,
    material: str | None = None,
    rating_min: int | None = Query(default=None, ge=1, le=5),
    sort: str = "created_at",
    order: str = "desc",
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return crud.list_filaments(
        db,
        brand=brand,
        material=material,
        rating_min=rating_min,
        sort=sort,
        order=order,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=schemas.FilamentRead, status_code=201)
def create_filament(data: schemas.FilamentCreate, db: Session = Depends(get_db)):
    return crud.create_filament(db, data)


@router.get("/{filament_id}", response_model=schemas.FilamentRead)
def get_filament(filament_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, filament_id)


@router.patch("/{filament_id}", response_model=schemas.FilamentRead)
def update_filament(filament_id: int, data: schemas.FilamentUpdate, db: Session = Depends(get_db)):
    filament = _get_or_404(db, filament_id)
    return crud.update_filament(db, filament, data)


@router.delete("/{filament_id}", status_code=204)
def delete_filament(filament_id: int, db: Session = Depends(get_db)):
    filament = _get_or_404(db, filament_id)
    crud.delete_filament(db, filament)
