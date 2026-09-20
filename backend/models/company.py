"""Modelos de empresa y respuesta de búsqueda."""

from pydantic import BaseModel

from .common import MatchResult
from .offer import OfferWithMatch


class Company(BaseModel):
    id: str
    name: str
    sector: str  # id de familia profesional
    sector_label: str
    description: str = ""
    city: str
    province: str = ""
    comunidad: str = ""
    country: str
    country_code: str
    address: str | None = None  # None = no disponible en la fuente; el frontend lo indica
    website: str | None = None
    phone: str | None = None
    email: str | None = None
    accepts_cv_spontaneous: bool = True
    lat: float
    lng: float
    source: str


class CompanyResult(BaseModel):
    company: Company
    distance_km: float
    match: MatchResult
    offers: list[OfferWithMatch]
    has_active_offer: bool


class SearchResponse(BaseModel):
    center: dict  # {lat, lng}
    radius_km: float
    total: int
    truncated: bool = False
    results: list[CompanyResult]
