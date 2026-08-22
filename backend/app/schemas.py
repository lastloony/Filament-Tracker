from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field


class LoginRequest(BaseModel):
    username: str
    password: str


class FilamentBase(BaseModel):
    brand: str
    material: str
    color: str | None = None
    color_hex: str | None = Field(default=None, min_length=7, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")
    weight_total_g: int = Field(gt=0)
    weight_remaining_g: int = Field(ge=0)
    price: Decimal = Field(gt=0)
    currency: str
    rating: int | None = Field(default=None, ge=1, le=5)
    vendor: str | None = None
    purchase_date: date | None = None
    notes: str | None = None


class FilamentCreate(FilamentBase):
    pass


class FilamentUpdate(BaseModel):
    brand: str | None = None
    material: str | None = None
    color: str | None = None
    color_hex: str | None = Field(default=None, min_length=7, max_length=7, pattern=r"^#[0-9a-fA-F]{6}$")
    weight_total_g: int | None = Field(default=None, gt=0)
    weight_remaining_g: int | None = Field(default=None, ge=0)
    price: Decimal | None = Field(default=None, gt=0)
    currency: str | None = None
    rating: int | None = Field(default=None, ge=1, le=5)
    vendor: str | None = None
    purchase_date: date | None = None
    notes: str | None = None


class FilamentRead(FilamentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def price_per_kg(self) -> Decimal:
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
    threshold_g: int = Field(gt=0)


class ReorderRuleCreate(ReorderRuleBase):
    pass


class ReorderRuleRead(ReorderRuleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class StatsByGroup(BaseModel):
    group: str
    total_spent: Decimal
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


class InventoryByMaterialColor(BaseModel):
    material: str
    color: str | None
    color_hex: str | None
    remaining_g: int
    spool_count: int


class ReorderItem(BaseModel):
    id: int
    brand: str
    material: str
    color: str | None
    color_hex: str | None
    remaining_g: int


class InventoryOverview(BaseModel):
    by_material_color: list[InventoryByMaterialColor]
    reorder: list[ReorderItem]
