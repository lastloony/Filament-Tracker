from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

DEFAULT_BRAND = "Нонейм"


def normalize_brand(value):
    if value is None:
        return DEFAULT_BRAND
    if isinstance(value, str):
        return value.strip() or DEFAULT_BRAND
    return value


class LoginRequest(BaseModel):
    username: str
    password: str


class FilamentBase(BaseModel):
    brand: str = DEFAULT_BRAND
    material: str
    color: str | None = None
    color_hex: str | None = Field(default=None, min_length=7, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")
    weight_total_g: int = Field(gt=0)
    weight_remaining_g: int = Field(ge=0)
    price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    vendor: str | None = None
    purchase_date: date | None = None
    notes: str | None = None


class FilamentCreate(FilamentBase):
    color: str = Field(min_length=1, max_length=50)

    @model_validator(mode="after")
    def validate_weights(self):
        if self.weight_remaining_g > self.weight_total_g:
            raise ValueError("Остаток не может превышать вес катушки")
        return self

    @field_validator("brand", mode="before")
    @classmethod
    def default_brand(cls, value):
        return normalize_brand(value)

    @field_validator("color", mode="before")
    @classmethod
    def strip_color(cls, value):
        return value.strip() if isinstance(value, str) else value


class FilamentUpdate(BaseModel):
    brand: str | None = None
    material: str | None = None
    color: str | None = None
    color_hex: str | None = Field(default=None, min_length=7, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")
    weight_total_g: int | None = Field(default=None, gt=0)
    weight_remaining_g: int | None = Field(default=None, ge=0)
    price: Decimal | None = Field(default=None, ge=0)
    currency: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    vendor: str | None = None
    purchase_date: date | None = None
    notes: str | None = None

    @field_validator("weight_total_g", "weight_remaining_g")
    @classmethod
    def require_weight(cls, value):
        if value is None:
            raise ValueError("Укажите вес в граммах")
        return value

    @field_validator("brand", mode="before")
    @classmethod
    def default_brand(cls, value):
        return normalize_brand(value)

    @field_validator("color", mode="before")
    @classmethod
    def require_color(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            raise ValueError("Укажите цвет катушки")
        return value.strip() if isinstance(value, str) else value


class FilamentConsume(BaseModel):
    weight_used_g: int = Field(gt=0, strict=True)


class FilamentRead(FilamentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    currency: str
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def price_per_kg(self) -> Decimal | None:
        if self.price is None:
            return None
        return round(self.price / (Decimal(self.weight_total_g) / 1000), 2)


class BrandBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class BrandCreate(BrandBase):
    pass


class BrandRead(BrandBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class MaterialBase(BaseModel):
    name: str = Field(min_length=1, max_length=50)


class MaterialCreate(MaterialBase):
    pass


class MaterialRead(MaterialBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class CurrencyBase(BaseModel):
    code: str = Field(min_length=3, max_length=3)


class CurrencyCreate(CurrencyBase):
    pass


class CurrencyRead(CurrencyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_base: bool


class ReorderRuleBase(BaseModel):
    material: str = Field(min_length=1, max_length=50)
    color: str = Field(min_length=1, max_length=50)
    brand: str | None = Field(default=None, max_length=100)
    threshold_g: int = Field(ge=0)


class ReorderRuleCreate(ReorderRuleBase):
    pass


class ReorderDisable(BaseModel):
    material: str = Field(min_length=1, max_length=50)
    color: str = Field(min_length=1, max_length=50)

    @field_validator("material", "color", mode="before")
    @classmethod
    def strip_value(cls, value):
        return value.strip() if isinstance(value, str) else value


class ReorderRuleRead(ReorderRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class StatsByGroup(BaseModel):
    group: str
    total_spent: Decimal | None
    remaining_g: int
    count: int
    avg_rating: float | None


class StatsByRating(BaseModel):
    rating: int | None
    count: int


class InvestedByCurrency(BaseModel):
    currency: str
    total: Decimal


class StatsSummary(BaseModel):
    remaining_kg: Decimal
    total_invested: list[InvestedByCurrency]
    avg_rating: float | None
    missing_price_count: int


class InventoryByMaterialColor(BaseModel):
    material: str
    color: str | None
    color_hex: str | None
    remaining_g: int
    spool_count: int


class InventoryByBrand(BaseModel):
    brand: str
    remaining_g: int
    spool_count: int


class ReorderItem(BaseModel):
    id: int
    brand: str | None
    material: str
    color: str | None
    color_hex: str | None
    remaining_g: int
    spool_count: int
    threshold_g: int


class InventoryOverview(BaseModel):
    by_material_color: list[InventoryByMaterialColor]
    reorder: list[ReorderItem]
