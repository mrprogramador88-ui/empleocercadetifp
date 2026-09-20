"""Geografía del ámbito de la aplicación: SOLO España y Europa.

- EUROPE_COUNTRIES: lista blanca de países europeos (código ISO 3166-1 alpha-2 en
  minúsculas, nombre en español). Todo geocodificado, empresa u oferta queda
  fuera de la aplicación si su país no está aquí.
- SPAIN: comunidades autónomas y provincias (datos oficiales INE).
- haversine(): distancia km entre dos puntos (usada por el motor de coincidencia
  y por el filtro de radio de búsqueda).
"""

from math import asin, cos, radians, sin, sqrt

# (cc, nombre) — países europeos admitidos. España primero: mercado principal.
EUROPE_COUNTRIES: list[tuple[str, str]] = [
    ("es", "España"),
    ("pt", "Portugal"),
    ("fr", "Francia"),
    ("de", "Alemania"),
    ("it", "Italia"),
    ("nl", "Países Bajos"),
    ("be", "Bélgica"),
    ("lu", "Luxemburgo"),
    ("ie", "Irlanda"),
    ("at", "Austria"),
    ("ch", "Suiza"),
    ("dk", "Dinamarca"),
    ("no", "Noruega"),
    ("se", "Suecia"),
    ("fi", "Finlandia"),
    ("is", "Islandia"),
    ("pl", "Polonia"),
    ("cz", "Chequia"),
    ("sk", "Eslovaquia"),
    ("hu", "Hungría"),
    ("ro", "Rumanía"),
    ("bg", "Bulgaria"),
    ("gr", "Grecia"),
    ("hr", "Croacia"),
    ("si", "Eslovenia"),
    ("ee", "Estonia"),
    ("lv", "Letonia"),
    ("lt", "Lituania"),
    ("mt", "Malta"),
    ("cy", "Chipre"),
    ("rs", "Serbia"),
    ("ba", "Bosnia y Herzegovina"),
    ("mk", "Macedonia del Norte"),
    ("al", "Albania"),
    ("me", "Montenegro"),
    ("md", "Moldavia"),
    ("ua", "Ucrania"),
    ("by", "Bielorrusia"),
    ("li", "Liechtenstein"),
]

EUROPE_CC: set[str] = {cc for cc, _ in EUROPE_COUNTRIES}

# Bounding box continental de Europa (+ archipiélagos españoles y atlánticos).
EUROPE_BBOX = {"lat_min": 27.0, "lat_max": 72.0, "lng_min": -32.0, "lng_max": 45.0}

SPAIN: list[dict] = [
    {"nombre": "Andalucía", "provincias": ["Almería", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Málaga", "Sevilla"]},
    {"nombre": "Aragón", "provincias": ["Huesca", "Teruel", "Zaragoza"]},
    {"nombre": "Asturias", "provincias": ["Asturias"]},
    {"nombre": "Illes Balears", "provincias": ["Illes Balears"]},
    {"nombre": "Canarias", "provincias": ["Las Palmas", "Santa Cruz de Tenerife"]},
    {"nombre": "Cantabria", "provincias": ["Cantabria"]},
    {"nombre": "Castilla-La Mancha", "provincias": ["Albacete", "Ciudad Real", "Cuenca", "Guadalajara", "Toledo"]},
    {"nombre": "Castilla y León", "provincias": ["Ávila", "Burgos", "León", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"]},
    {"nombre": "Cataluña", "provincias": ["Barcelona", "Girona", "Lleida", "Tarragona"]},
    {"nombre": "Comunidad Valenciana", "provincias": ["Alicante", "Castellón", "Valencia"]},
    {"nombre": "Extremadura", "provincias": ["Badajoz", "Cáceres"]},
    {"nombre": "Galicia", "provincias": ["A Coruña", "Lugo", "Ourense", "Pontevedra"]},
    {"nombre": "La Rioja", "provincias": ["La Rioja"]},
    {"nombre": "Comunidad de Madrid", "provincias": ["Madrid"]},
    {"nombre": "Región de Murcia", "provincias": ["Murcia"]},
    {"nombre": "Comunidad Foral de Navarra", "provincias": ["Navarra"]},
    {"nombre": "País Vasco", "provincias": ["Álava", "Guipúzcoa", "Vizcaya"]},
    {"nombre": "Ceuta", "provincias": ["Ceuta"]},
    {"nombre": "Melilla", "provincias": ["Melilla"]},
]


def is_europe_cc(cc: str | None) -> bool:
    return cc is not None and cc.lower() in EUROPE_CC


def in_europe(lat: float, lng: float) -> bool:
    return (
        EUROPE_BBOX["lat_min"] <= lat <= EUROPE_BBOX["lat_max"]
        and EUROPE_BBOX["lng_min"] <= lng <= EUROPE_BBOX["lng_max"]
    )


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia ortodrómica en km entre dos puntos geográficos."""
    r = 6371.0088
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * r * asin(sqrt(a))
