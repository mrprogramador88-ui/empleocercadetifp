"""Conector de ejemplo para una fuente externa real: Adzuna (API gratuita).

Implementa la misma interfaz que la fuente de demostración, de modo que agregar
una nueva fuente al motor de búsqueda consista en: 1) crear una clase
OfferProvider, 2) registrarla en `describe_sources`/`active_providers`. Solo se
activa si existen ADZUNA_APP_ID y ADZUNA_APP_KEY en backend/.env; sin claves no
se ejecuta ninguna llamada (sin datos simulados en su lugar).
"""

from __future__ import annotations

import logging
import os
import uuid
from datetime import datetime, timezone

import httpx

from .base import OfferProvider

logger = logging.getLogger(__name__)

COUNTRY_BASE = {"es": "https://api.adzuna.com/v1/api/jobs/es"}


class AdzunaProvider(OfferProvider):
    id = "adzuna"
    nombre = "Adzuna (API externa de ofertas)"
    tipo = "api_externa"
    descripcion = (
        "Agregador real de ofertas de empleo con cobertura europea. Al activarlo, sus ofertas se "
        "agregan a los resultados etiquetadas con su origen y enlace original."
    )
    requiere = ["ADZUNA_APP_ID", "ADZUNA_APP_KEY"]

    @property
    def enabled(self) -> bool:
        return bool(
            os.environ.get("ADZUNA_APP_ID", "").strip()
            and os.environ.get("ADZUNA_APP_KEY", "").strip()
        )

    async def list_companies(self) -> list[dict]:
        # Adzuna no expone un directorio de empresas; las empresas llegan embebidas en las ofertas.
        return []

    async def list_offers(self) -> list[dict]:
        app_id = os.environ["ADZUNA_APP_ID"]
        app_key = os.environ["ADZUNA_APP_KEY"]
        offers: list[dict] = []
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                res = await client.get(
                    "https://api.adzuna.com/v1/api/jobs/es/search/1",
                    params={
                        "app_id": app_id,
                        "app_key": app_key,
                        "results_per_page": 30,
                        "what": "formacion profesional",
                        "content-type": "application/json",
                    },
                )
                res.raise_for_status()
                data = res.json()
            for item in data.get("results", []):
                offers.append(
                    {
                        "id": str(uuid.uuid4()),
                        "company_id": "",
                        "title": item.get("title", "Oferta"),
                        "description": (item.get("description") or "")[:600],
                        "contract_type": "indefinido",
                        "jornada": "completa",
                        "skills": [],
                        "min_experience_years": 0,
                        "accepts_no_experience": True,
                        "is_internship": "prácticas" in (item.get("title") or "").lower(),
                        "first_job_friendly": True,
                        "active": True,
                        "published_at": item.get("created") or datetime.now(timezone.utc).isoformat(),
                        "source": "adzuna",
                        "source_url": item.get("redirect_url"),
                        "salary": None,
                        "_company_name": item.get("company", {}).get("display_name", "Empresa"),
                        "_city": item.get("location", {}).get("display_name", ""),
                        "_lat": (item.get("latitude") or 0.0),
                        "_lng": (item.get("longitude") or 0.0),
                    }
                )
        except Exception as exc:
            logger.error("AdzunaProvider: %s", exc)
            return []
        return offers
