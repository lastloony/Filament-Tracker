from sqlalchemy import func, select
from sqlalchemy.engine import Row
from sqlalchemy.orm import Session

from app import models, schemas

SORTABLE_FIELDS = {"price", "rating", "weight_remaining_g", "created_at", "brand"}


def get_filament(db: Session, filament_id: int) -> models.Filament | None:
    return db.get(models.Filament, filament_id)


def list_filaments(
    db: Session,
    *,
    brand: str | None = None,
    material: str | None = None,
    rating_min: int | None = None,
    sort: str = "created_at",
    order: str = "desc",
    limit: int = 50,
    offset: int = 0,
) -> list[models.Filament]:
    query = select(models.Filament)
    if brand:
        query = query.where(models.Filament.brand == brand)
    if material:
        query = query.where(models.Filament.material == material)
    if rating_min is not None:
        query = query.where(models.Filament.rating >= rating_min)

    sort_field = sort if sort in SORTABLE_FIELDS else "created_at"
    sort_column = getattr(models.Filament, sort_field)
    query = query.order_by(sort_column.desc() if order == "desc" else sort_column.asc())
    query = query.limit(limit).offset(offset)

    return list(db.execute(query).scalars())


def create_filament(db: Session, data: schemas.FilamentCreate) -> models.Filament:
    filament = models.Filament(**data.model_dump())
    db.add(filament)
    db.commit()
    db.refresh(filament)
    return filament


def update_filament(db: Session, filament: models.Filament, data: schemas.FilamentUpdate) -> models.Filament:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(filament, field, value)
    db.commit()
    db.refresh(filament)
    return filament


def delete_filament(db: Session, filament: models.Filament) -> None:
    db.delete(filament)
    db.commit()


def _stats_by_field(db: Session, field) -> list[Row]:
    query = (
        select(
            field,
            func.coalesce(func.sum(models.Filament.price), 0),
            func.coalesce(func.sum(models.Filament.weight_remaining_g), 0),
            func.count(models.Filament.id),
            func.avg(models.Filament.rating),
        )
        .group_by(field)
        .order_by(field)
    )
    return list(db.execute(query).all())


def stats_by_brand(db: Session) -> list[Row]:
    return _stats_by_field(db, models.Filament.brand)


def stats_by_material(db: Session) -> list[Row]:
    return _stats_by_field(db, models.Filament.material)


def stats_by_rating(db: Session) -> list[Row]:
    query = (
        select(models.Filament.rating, func.count(models.Filament.id))
        .group_by(models.Filament.rating)
        .order_by(models.Filament.rating)
    )
    return list(db.execute(query).all())


def stats_summary(db: Session) -> Row:
    query = select(
        func.coalesce(func.sum(models.Filament.weight_remaining_g), 0),
        func.coalesce(func.sum(models.Filament.price), 0),
        func.avg(models.Filament.rating),
    )
    return db.execute(query).one()
