"""Registro de fuentes de empresas y ofertas.

Añadir una fuente nueva = crear una clase `OfferProvider` en este paquete y
registrarla en `PROVIDERS`. Nada más cambia en el motor de búsqueda.
"""

from .adzuna import AdzunaProvider
from .base import OfferProvider
from .demo import DemoProvider

__all__ = ["OfferProvider", "describe_sources", "active_providers"]


def _providers() -> list[OfferProvider]:
    return [DemoProvider(), AdzunaProvider()]


def describe_sources() -> list[dict]:
    return [
        {
            "id": p.id,
            "nombre": p.nombre,
            "tipo": p.tipo,
            "estado": "activo" if p.enabled else "inactivo",
            "requiere": p.requiere,
            "descripcion": p.descripcion,
        }
        for p in _providers()
    ]


def active_providers() -> list[OfferProvider]:
    return [p for p in _providers() if p.enabled]
