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


@router.get("/reorder-rules", response_model=list[schemas.ReorderRuleRead])
def list_reorder_rules(db: Session = Depends(get_db)):
    return crud.list_reorder_rules(db)


@router.post("/reorder-rules", response_model=schemas.ReorderRuleRead, status_code=201)
def create_reorder_rule(data: schemas.ReorderRuleCreate, db: Session = Depends(get_db)):
    brand = data.brand.strip() if data.brand else None
    existing = crud.find_reorder_rule(db, material=data.material.strip(), color=data.color.strip(), brand=brand)
    if existing is not None:
        raise HTTPException(status_code=409, detail="Rule for this material/color/brand already exists")
    return crud.create_reorder_rule(db, data)


@router.delete("/reorder-rules/{rule_id}", status_code=204)
def delete_reorder_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = crud.get_reorder_rule(db, rule_id)
    if rule is None:
        raise HTTPException(status_code=404, detail="Rule not found")
    crud.delete_reorder_rule(db, rule)
