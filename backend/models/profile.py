"""Modelos del perfil de usuario FP."""

from datetime import datetime, timezone

from pydantic import BaseModel, Field

from lib.fp_catalog import FAMILIAS_BY_ID, TITULOS_BY_ID

import uuid


class Idioma(BaseModel):
    nombre: str
    nivel: str  # A1..C2 | nativo


class CvInfo(BaseModel):
    filename: str
    original_name: str
    size_kb: int
    uploaded_at: datetime


class UserLocation(BaseModel):
    label: str
    pais: str
    pais_cc: str
    comunidad: str = ""
    provincia: str = ""
    municipio: str = ""
    cp: str = ""
    lat: float
    lng: float


class UserProfile(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    client_id: str
    nombre: str = ""
    email: str = ""
    telefono: str = ""
    grado: str = ""  # GM | GS
    familia_id: str = ""
    familia_nombre: str = ""
    titulo_id: str = ""
    titulo_nombre: str = ""
    experiencia_anos: float = 0
    skills: list[str] = []
    certificaciones: list[str] = []
    carnets: list[str] = []
    idiomas: list[Idioma] = []
    disponibilidad: str = ""
    busca: list[str] = []  # primer_empleo | practicas | indefinido | temporal
    max_distance_km: int = 50
    location: UserLocation | None = None
    cv: CvInfo | None = None
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProfileUpdate(BaseModel):
    nombre: str | None = None
    email: str | None = None
    telefono: str | None = None
    grado: str | None = None
    familia_id: str | None = None
    titulo_id: str | None = None
    titulo_nombre: str | None = None
    experiencia_anos: float | None = None
    skills: list[str] | None = None
    certificaciones: list[str] | None = None
    carnets: list[str] | None = None
    idiomas: list[Idioma] | None = None
    disponibilidad: str | None = None
    busca: list[str] | None = None
    max_distance_km: int | None = Field(default=None, ge=2, le=3000)
    location: UserLocation | None = None


def apply_update(profile: UserProfile, update: ProfileUpdate) -> UserProfile:
    """Aplica el PATCH sobre el perfil y normaliza los campos derivados del catálogo FP."""
    data = update.model_dump(exclude_unset=True)

    # El catálogo oficial manda cuando se elige un título del desplegable (titulo_id no vacío).
    # Si el usuario escribe el título a mano (título no listado), se respeta su texto.
    new_titulo = data.get("titulo_id")
    if new_titulo:
        titulo = TITULOS_BY_ID.get(new_titulo)
        if titulo:
            data["titulo_nombre"] = titulo["nombre"]
            data["familia_id"] = titulo["familia"]
            data["familia_nombre"] = FAMILIAS_BY_ID[titulo["familia"]]["nombre"]
    elif data.get("familia_id"):
        familia = FAMILIAS_BY_ID.get(data["familia_id"])
        if familia:
            data["familia_nombre"] = familia["nombre"]

    for key, value in data.items():
        setattr(profile, key, value)

    profile.updated_at = datetime.now(timezone.utc)
    return profile
