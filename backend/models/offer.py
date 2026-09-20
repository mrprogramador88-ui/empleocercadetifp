"""Modelos de ofertas de empleo."""

from datetime import datetime

from pydantic import BaseModel

from .common import MatchResult


class Offer(BaseModel):
    id: str
    company_id: str
    title: str
    description: str = ""
    contract_type: str  # indefinido | temporal | practicas | formativo
    jornada: str  # completa | parcial | turnos
    skills: list[str] = []
    min_experience_years: float = 0
    accepts_no_experience: bool = True
    is_internship: bool = False
    first_job_friendly: bool = False
    active: bool = True
    published_at: datetime
    source: str
    source_url: str | None = None
    salary: str | None = None


class OfferWithMatch(Offer):
    match_pct: int
    match: MatchResult | None = None


CONTRACT_LABELS: dict[str, str] = {
    "indefinido": "Contrato indefinido",
    "temporal": "Contrato temporal",
    "practicas": "Prácticas / FCT-Dual",
    "formativo": "Contrato formativo",
}

JORNADA_LABELS: dict[str, str] = {
    "completa": "Jornada completa",
    "parcial": "Media jornada",
    "turnos": "Turnos",
}
