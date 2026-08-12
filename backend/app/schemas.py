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


class StatsByGroup(BaseModel):
    group: str
    total_spent: Decimal
    remaining_g: int
    count: int
    avg_rating: float | None


class StatsByRating(BaseModel):
    rating: int | None
    count: int


class StatsSummary(BaseModel):
    remaining_kg: Decimal
    total_invested: Decimal
    avg_rating: float | None
