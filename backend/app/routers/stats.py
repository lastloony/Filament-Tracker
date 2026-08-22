from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import crud, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/stats", tags=["stats"], dependencies=[Depends(get_current_user)])


def _to_stats_by_group(rows) -> list[schemas.StatsByGroup]:
    return [
        schemas.StatsByGroup(
            group=group, total_spent=total_spent, remaining_g=remaining_g, count=count, avg_rating=avg_rating
        )
        for group, total_spent, remaining_g, count, avg_rating in rows
    ]


@router.get("/by-brand", response_model=list[schemas.StatsByGroup])
def by_brand(db: Session = Depends(get_db)):
    return _to_stats_by_group(crud.stats_by_brand(db))


@router.get("/by-material", response_model=list[schemas.StatsByGroup])
def by_material(db: Session = Depends(get_db)):
    return _to_stats_by_group(crud.stats_by_material(db))


@router.get("/by-rating", response_model=list[schemas.StatsByRating])
def by_rating(db: Session = Depends(get_db)):
    return [schemas.StatsByRating(rating=rating, count=count) for rating, count in crud.stats_by_rating(db)]


@router.get("/summary", response_model=schemas.StatsSummary)
def summary(db: Session = Depends(get_db)):
    remaining_g, avg_rating, invested_by_currency = crud.stats_summary(db)
    return schemas.StatsSummary(
        remaining_kg=Decimal(remaining_g) / 1000,
        total_invested=[
            schemas.InvestedByCurrency(currency=currency, total=total) for currency, total in invested_by_currency
        ],
        avg_rating=avg_rating,
    )
