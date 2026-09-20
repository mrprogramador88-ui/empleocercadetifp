"""Modelos del motor de coincidencia."""

from pydantic import BaseModel, Field


class MatchFactor(BaseModel):
    factor: str
    label: str
    peso: int = Field(description="Peso del factor en el algoritmo (suma 100)")
    score: int = Field(ge=0, le=100)
    detalle: str


class MatchResult(BaseModel):
    pct: int = Field(ge=0, le=100)
    factores: list[MatchFactor]
    razones: list[str]
