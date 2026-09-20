"""Geocodificación del mundo real con degradación elegante.

El usuario puede localizar su posición por texto (dirección, municipio o código
postal) o pinchando en el mapa. La geocodificación se hace SIEMPRE en el backend
(para no acoplar el frontend al proveedor y poder restringir el ámbito a Europa):

  - OpenStreetMap/Nominatim: proveedor por defecto, gratuito y sin clave.
  - Google Geocoding API: se activa automáticamente si existe GOOGLE_MAPS_API_KEY.

Ambos implementan la misma interfaz; las respuestas fuera de la lista blanca
europea se descartan (o devuelven 404 en modo reverse), cumpliendo el requisito
de ámbito exclusivamente español/europeo.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from abc import ABC, abstractmethod
from typing import Any

import httpx

from lib.geo import in_europe, is_europe_cc

logger = logging.getLogger(__name__)

UA = "EmpleoCercaDeTi/1.0 (proyecto academico FP)"  # solo ASCII: httpx rechaza cabeceras no-ASCII


class GeocodeHit(dict):
    pass


class GeocodeProvider(ABC):
    id: str
    name: str

    @abstractmethod
    async def search(self, q: str, cc: str, limit: int = 6) -> list[dict]: ...

    @abstractmethod
    async def reverse(self, lat: float, lng: float) -> dict | None: ...


class NominatimProvider(GeocodeProvider):
    id = "nominatim"
    name = "OpenStreetMap (Nominatim)"

    def __init__(self) -> None:
        self._lock = asyncio.Lock()
        self._last = 0.0
        self._cache: dict[str, list[dict]] = {}

    async def _throttle(self) -> None:
        async with self._lock:
            wait = 1.1 - (time.monotonic() - self._last)
            if wait > 0:
                await asyncio.sleep(wait)
            self._last = time.monotonic()

    def _clean(self, hits: list[dict]) -> list[dict]:
        out = []
        for h in hits:
            address = h.get("address") or {}
            cc = (address.get("country_code") or "").lower()
            if not is_europe_cc(cc):
                continue
            try:
                lat, lng = float(h["lat"]), float(h["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if not in_europe(lat, lng):
                continue
            out.append(
                {
                    "label": h.get("display_name", ""),
                    "lat": lat,
                    "lng": lng,
                    "cc": cc,
                    "country": address.get("country", ""),
                    "kind": h.get("type", ""),
                }
            )
        return out

    async def search(self, q: str, cc: str, limit: int = 6) -> list[dict]:
        key = f"{q}|{cc}|{limit}"
        if key in self._cache:
            return self._cache[key]
        await self._throttle()
        params: dict[str, Any] = {
            "format": "jsonv2",
            "limit": limit,
            "accept-language": "es",
            "countrycodes": cc.lower(),
            "addressdetails": 1,  # sin esto jsonv2 no devuelve el país y todo se filtraría
        }
        # Búsqueda estructurada para códigos postales (5 dígitos en España): la
        # consulta libre confunde un CP con números de portal de cualquier calle.
        if q.strip().isdigit() and len(q.strip()) == 5:
            params["postalcode"] = q.strip()
        else:
            params["q"] = q
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": UA}) as client:
            res = await client.get("https://nominatim.openstreetmap.org/search", params=params)
            res.raise_for_status()
            hits = res.json()
        cleaned = self._clean(hits)
        if len(self._cache) > 500:
            self._cache.clear()
        self._cache[key] = cleaned
        return cleaned

    async def reverse(self, lat: float, lng: float) -> dict | None:
        await self._throttle()
        params = {
            "lat": lat,
            "lon": lng,
            "format": "jsonv2",
            "accept-language": "es",
            "zoom": 14,
            "addressdetails": 1,
        }
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": UA}) as client:
            res = await client.get("https://nominatim.openstreetmap.org/reverse", params=params)
            res.raise_for_status()
            data = res.json()
        cleaned = self._clean([data])
        return cleaned[0] if cleaned else None


class GoogleGeocodeProvider(GeocodeProvider):
    """Google Geocoding API — activo solo si GOOGLE_MAPS_API_KEY está definida."""

    id = "google"
    name = "Google Geocoding API"

    def __init__(self, api_key: str) -> None:
        self._key = api_key

    async def search(self, q: str, cc: str, limit: int = 6) -> list[dict]:
        params = {"address": q, "key": self._key, "language": "es", "region": cc.upper()}
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
            res.raise_for_status()
            data = res.json()
        out = []
        for item in data.get("results", [])[:limit]:
            loc = item["geometry"]["location"]
            cc_hit = ""
            country = ""
            for comp in item.get("address_components", []):
                if "country" in comp.get("types", []):
                    cc_hit = comp["short_name"].lower()
                    country = comp["long_name"]
            if not is_europe_cc(cc_hit):
                continue
            out.append(
                {
                    "label": item.get("formatted_address", ""),
                    "lat": loc["lat"],
                    "lng": loc["lng"],
                    "cc": cc_hit,
                    "country": country,
                    "kind": item.get("types", [""])[0] if item.get("types") else "",
                }
            )
        return out

    async def reverse(self, lat: float, lng: float) -> dict | None:
        params = {"latlng": f"{lat},{lng}", "key": self._key, "language": "es"}
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get("https://maps.googleapis.com/maps/api/geocode/json", params=params)
            res.raise_for_status()
            data = res.json()
        for item in data.get("results", []):
            cc_hit = ""
            country = ""
            for comp in item.get("address_components", []):
                if "country" in comp.get("types", []):
                    cc_hit = comp["short_name"].lower()
                    country = comp["long_name"]
            if is_europe_cc(cc_hit):
                return {
                    "label": item.get("formatted_address", ""),
                    "lat": lat,
                    "lng": lng,
                    "cc": cc_hit,
                    "country": country,
                    "kind": "reverse",
                }
        return None


_singleton: GeocodeProvider | None = None


def get_geocoder() -> GeocodeProvider:
    """Instancia única: conserva la caché y el límite de 1 req/s de Nominatim.

    Crear un proveedor nuevo por petición perdería el throttle y Nominatim
    respondería 403/429 al segundo teclazo del autocompletado.
    """
    global _singleton
    if _singleton is None:
        key = os.environ.get("GOOGLE_MAPS_API_KEY", "").strip()
        _singleton = GoogleGeocodeProvider(key) if key else NominatimProvider()
    return _singleton
