"""Interfaz común de fuentes de empresas y ofertas.

Arquitectura preparada para enchufar APIs externas reales (Adzuna, InfoJobs,
Tecnoempleo…): cada fuente implementa OfferProvider y se registra en el
registro de fuentes (`active_providers`/`describe_sources` en `__init__.py`).
El endpoint de búsqueda agrega resultados de todas las fuentes activas y
etiqueta cada oferta con su origen (`source`), como exige el enunciado.
"""

from __future__ import annotations

from abc import ABC, abstractmethod


class OfferProvider(ABC):
    id: str
    nombre: str
    tipo: str
    descripcion: str
    requiere: list[str]

    @property
    def enabled(self) -> bool:
        return True

    @abstractmethod
    async def list_companies(self) -> list[dict]: ...

    @abstractmethod
    async def list_offers(self) -> list[dict]: ...
