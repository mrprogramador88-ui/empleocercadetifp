"""Fuente de demostración (catálogo académico sembrado en Mongo).

Cumple el requisito del proyecto de NO inventar datos disfrazándolos de reales:
todas las empresas y ofertas de esta fuente están etiquetadas con
`source="catalogo_demo"` y los datos de contacto que exigiría una fuente real
(teléfono, email, web, enlace a la oferta) se dejan a None. El frontend muestra
esta condición de forma explícita en la interfaz.
"""

from __future__ import annotations

from lib.db import db

from .base import OfferProvider


class DemoProvider(OfferProvider):
    id = "catalogo_demo"
    nombre = "Catálogo de demostración académico"
    tipo = "interno"
    descripcion = (
        "Empresas y ofertas de ejemplo, geolocalizadas en municipios reales de España y Europa, "
        "para validar el motor de coincidencia. No incluye teléfonos, correos ni enlaces inventados: "
        "esos campos se completan al conectar una fuente de datos real."
    )
    requiere: list[str] = []

    async def list_companies(self) -> list[dict]:
        return await db.companies.find({}, {"_id": 0}).to_list(1000)

    async def list_offers(self) -> list[dict]:
        return await db.offers.find({}, {"_id": 0}).to_list(2000)
