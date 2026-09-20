"""Metadatos de la aplicación: configuración efectiva y fuentes de datos."""

import os

from fastapi import APIRouter

from lib.geocode import get_geocoder
from lib.sources import describe_sources

router = APIRouter(tags=["meta"])


@router.get("/config")
async def config():
    maps_key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
    ai_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    return {
        "app_name": "Empleo Cerca de Ti",
        "ambito": "España y Europa",
        "maps_provider": "google" if maps_key else "osm",
        "maps_api_key": maps_key or None,  # clave de Maps JS: pública por diseño, restringida por referente HTTP
        "geocoder": get_geocoder().id,
        "ai_enabled": bool(ai_key),
    }


@router.get("/sources")
async def sources():
    return describe_sources()
