"""Ámbito geográfico: países europeos, divisiones de España y geocodificación real."""

import logging

from fastapi import APIRouter, HTTPException, Query

from lib.geo import EUROPE_COUNTRIES, SPAIN, is_europe_cc
from lib.geocode import get_geocoder

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/geo", tags=["geo"])


@router.get("/countries")
async def countries():
    """Lista blanca de países: solo España y Europa."""
    return [{"cc": cc, "nombre": nombre} for cc, nombre in EUROPE_COUNTRIES]


@router.get("/spain")
async def spain():
    """Comunidades autónomas y provincias (datos oficiales INE)."""
    return SPAIN


@router.get("/geocode")
async def geocode(
    q: str = Query(min_length=3, max_length=120),
    cc: str = Query("es", min_length=2, max_length=2),
):
    """Búsqueda de texto → coordenadas. Restringida al país indicado (europeo)."""
    if not is_europe_cc(cc):
        raise HTTPException(status_code=400, detail="El ámbito de búsqueda está limitado a España y Europa")
    geocoder = get_geocoder()
    try:
        hits = await geocoder.search(q, cc)
    except Exception as exc:
        logger.error("geocode(q=%r, cc=%s) falló: %s: %s", q, cc, type(exc).__name__, exc)
        raise HTTPException(status_code=502, detail="El servicio de geocodificación no está disponible ahora mismo") from exc
    return hits


@router.get("/reverse")
async def reverse(lat: float = Query(..., ge=-90, le=90), lng: float = Query(..., ge=-180, le=180)):
    """Coordenadas → lugar. Rechaza cualquier punto fuera de Europa."""
    geocoder = get_geocoder()
    try:
        hit = await geocoder.reverse(lat, lng)
    except Exception as exc:
        logger.error("reverse(%s,%s) falló: %s: %s", lat, lng, type(exc).__name__, exc)
        raise HTTPException(status_code=502, detail="El servicio de geocodificación no está disponible ahora mismo") from exc
    if not hit:
        raise HTTPException(status_code=404, detail="Ubicación fuera del ámbito de la aplicación (España y Europa)")
    return hit
