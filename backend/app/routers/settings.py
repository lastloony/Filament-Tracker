from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import crud, schemas
from app.auth import get_current_user
from app.database import get_db

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[Depends(get_current_user)])


@router.get("/brands", response_model=list[schemas.BrandRead])
def list_brands(db: Session = Depends(get_db)):
    return crud.list_brands(db)


@router.post("/brands", response_model=schemas.BrandRead, status_code=201)
def create_brand(data: schemas.BrandCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_brand(db, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Brand already exists")


@router.get("/materials", response_model=list[schemas.MaterialRead])
def list_materials(db: Session = Depends(get_db)):
    return crud.list_materials(db)


@router.post("/materials", response_model=schemas.MaterialRead, status_code=201)
def create_material(data: schemas.MaterialCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_material(db, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Material already exists")


@router.get("/currencies", response_model=list[schemas.CurrencyRead])
def list_currencies(db: Session = Depends(get_db)):
    return crud.list_currencies(db)


@router.post("/currencies", response_model=schemas.CurrencyRead, status_code=201)
def create_currency(data: schemas.CurrencyCreate, db: Session = Depends(get_db)):
    try:
        return crud.create_currency(db, data)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Currency already exists")


@router.post("/currencies/{currency_id}/set-base", response_model=schemas.CurrencyRead)
def set_base_currency(currency_id: int, db: Session = Depends(get_db)):
    currency = crud.get_currency(db, currency_id)
    if currency is None:
        raise HTTPException(status_code=404, detail="Currency not found")
    return crud.set_base_currency(db, currency)
