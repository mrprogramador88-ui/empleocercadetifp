"""Motor de coincidencia perfil FP ↔ empresa/oferta.

Algoritmo ponderado (documentado para su defensa académica), sobre cinco factores:

  1. Título/ciclo (35 %)      — sector de la empresa vs. título del usuario y sus
                                familias profesionales relacionadas.
  2. Familia y especialidad (25 %) — solapamiento de las áreas profesionales del
                                título con el puesto, la descripción y el sector.
  3. Habilidades y requisitos (20 %) — solapamiento de habilidades del usuario con
                                los requisitos de la oferta.
  4. Proximidad geográfica (15 %) — caída lineal dentro del radio de búsqueda.
  5. Carnets, idiomas y experiencia (5 %) — encaje con los requisitos declarados.

Cada factor devuelve 0-100 y el porcentaje final es la media ponderada, con
pequeños bonus por alineación (primer empleo, prácticas FCT/Dual). Se devuelven
el desglose por factor y las razones en lenguaje natural para que el resultado
sea explicable (transparencia del motor).
"""

from __future__ import annotations

from dataclasses import dataclass

from lib.fp_catalog import FAMILIA_RELATIONS, normalize, titulo_by_id

WEIGHTS: dict[str, int] = {
    "titulo": 35,
    "especialidad": 25,
    "habilidades": 20,
    "proximidad": 15,
    "requisitos": 5,
}

FACTOR_LABELS: dict[str, str] = {
    "titulo": "Título y ciclo formativo",
    "especialidad": "Familia y especialidad",
    "habilidades": "Habilidades y requisitos de la oferta",
    "proximidad": "Proximidad geográfica",
    "requisitos": "Carnets, idiomas y experiencia",
}


@dataclass
class FactorScore:
    factor: str
    score: float
    detalle: str


def _norm_set(values: list[str]) -> set[str]:
    return {normalize(v.strip()) for v in values if v and v.strip()}


def sector_affinity(titulo_id: str, company_sector: str) -> tuple[float, str]:
    """Afinidad título ↔ sector de la empresa (0-100)."""
    titulo = titulo_by_id(titulo_id)
    if not titulo:
        return 40.0, "Sin título seleccionado: afinidad neutra"
    if company_sector == titulo["familia"]:
        return 100.0, "El sector de la empresa es el de tu ciclo formativo"
    if company_sector in titulo.get("related", []):
        return 78.0, "Sector profesional relacionado con tu ciclo formativo"
    if company_sector in FAMILIA_RELATIONS.get(titulo["familia"], []):
        return 55.0, "Sector vecino dentro del mapa de familias profesionales"
    return 25.0, "Sector distinto a tu formación, aunque con puestos de acceso"


def keyword_affinity(user_areas: list[str], texts: list[str]) -> float:
    """Proporción de áreas del usuario que aparecen en los textos (0-100)."""
    if not user_areas:
        return 50.0
    corpus = normalize(" · ".join(texts))
    hits = sum(1 for area in user_areas if normalize(area) in corpus)
    if hits == 0:
        return 35.0
    return min(100.0, 50.0 + 50.0 * hits / len(user_areas) + (15 if hits >= 2 else 0))


def skills_affinity(user_skills: list[str], offer_skills: list[str]) -> tuple[float, list[str]]:
    """Solapamiento usuario ↔ oferta (media de cobertura en ambas direcciones)."""
    us, os_ = _norm_set(user_skills), _norm_set(offer_skills)
    if not os_:
        return 50.0, []
    if not us:
        return 45.0, []
    matched = sorted(os_ & us)
    coverage = 0.7 * (len(matched) / len(os_)) + 0.3 * (len(matched) / len(us))
    return round(100 * min(1.0, coverage * 1.35), 1), matched


def proximity_affinity(distance_km: float, radius_km: float) -> float:
    """100 % en el primer cuarto del radio; cae linealmente hasta 20 % en el borde."""
    if distance_km <= radius_km * 0.25:
        return 100.0
    frac = (distance_km - radius_km * 0.25) / (radius_km * 0.75)
    return max(20.0, 100.0 - 80.0 * min(1.0, frac))


def experience_fit(user_years: float, min_years: float, accepts_no_exp: bool, first_job: bool) -> tuple[float, str]:
    if min_years <= 0 or (min_years > 0 and accepts_no_exp):
        return 100.0, "Acepta candidatos sin experiencia"
    if user_years >= min_years:
        return 100.0, f"Cumple la experiencia requerida ({int(min_years)} años)"
    gap = min_years - user_years
    return max(30.0, 100.0 - 35.0 * gap), f"Pide {int(min_years)} años de experiencia (tú tienes {user_years:g})"


def _weighted(scores: list[FactorScore], extra_pct: float, razones: list[str]) -> dict:
    """Devuelve un dict con la forma exacta del modelo Pydantic MatchResult."""
    total_weight = sum(WEIGHTS[s.factor] for s in scores)
    raw = sum(WEIGHTS[s.factor] * s.score for s in scores) / total_weight
    pct = int(round(min(100.0, raw + extra_pct)))
    factores = [
        {
            "factor": s.factor,
            "label": FACTOR_LABELS[s.factor],
            "peso": WEIGHTS[s.factor],
            "score": int(round(s.score)),
            "detalle": s.detalle,
        }
        for s in scores
    ]
    return {"pct": pct, "factores": factores, "razones": razones}


def score_offer(profile: dict, company: dict, offer: dict, distance_km: float, radius_km: float) -> dict:
    titulo_id = profile.get("titulo_id", "")
    titulo = titulo_by_id(titulo_id)
    areas = titulo.get("areas", []) if titulo else []

    s1, d1 = sector_affinity(titulo_id, company.get("sector", ""))
    s2 = keyword_affinity(areas, [offer.get("title", ""), offer.get("description", ""), company.get("sector_label", "")])
    s3, matched = skills_affinity(profile.get("skills", []), offer.get("skills", []))
    s4 = proximity_affinity(distance_km, radius_km)
    s5, d5 = experience_fit(
        float(profile.get("experiencia_anos", 0)),
        float(offer.get("min_experience_years", 0)),
        offer.get("accepts_no_experience", False),
        offer.get("first_job_friendly", False),
    )

    extra = 0.0
    razones = [
        f"Oferta de «{offer.get('title', '')}» a {distance_km:.0f} km de tu ubicación",
        d1,
    ]
    if matched:
        razones.append("Encajan tus habilidades: " + ", ".join(matched[:4]))
    if offer.get("is_internship"):
        extra += 4.0
        razones.append("Oferta de prácticas (FCT/Dual) compatible con tu formación")
    if offer.get("first_job_friendly") and float(profile.get("experiencia_anos", 0)) == 0:
        extra += 3.0
        razones.append("Pensada para el primer empleo o recién titulados")
    if offer.get("contract_type") == "indefinido":
        razones.append("Contrato indefinido")
    if titulo:
        razones.append(f"Tu título de {titulo['nombre']} encaja con el sector de {company.get('sector_label', '')}")

    scores = [
        FactorScore("titulo", s1, d1),
        FactorScore("especialidad", s2, "Áreas de tu título frente al puesto y la empresa"),
        FactorScore("habilidades", s3, ", ".join(matched) if matched else "Sin solapamiento directo de habilidades"),
        FactorScore("proximidad", s4, f"{distance_km:.0f} km dentro de un radio de {radius_km} km"),
        FactorScore("requisitos", s5, d5),
    ]
    return _weighted(scores, extra, razones)


def score_company(profile: dict, company: dict, distance_km: float, radius_km: float) -> dict:
    """Afinidad con la empresa cuando no hay oferta activa asociada."""
    titulo_id = profile.get("titulo_id", "")
    titulo = titulo_by_id(titulo_id)
    areas = titulo.get("areas", []) if titulo else []

    s1, d1 = sector_affinity(titulo_id, company.get("sector", ""))
    s2 = keyword_affinity(areas, [company.get("description", ""), company.get("sector_label", "")])
    s3 = 50.0 if profile.get("skills") else 45.0
    s4 = proximity_affinity(distance_km, radius_km)
    s5 = 100.0 if company.get("accepts_cv_spontaneous", True) else 50.0

    razones = [
        f"Empresa a {distance_km:.0f} km de tu ubicación",
        d1,
        "Acepta candidaturas espontáneas: envía tu CV aunque no haya oferta publicada",
    ]
    scores = [
        FactorScore("titulo", s1, d1),
        FactorScore("especialidad", s2, "Actividad de la empresa frente a tus áreas profesionales"),
        FactorScore("habilidades", s3, "Sin oferta activa: se valora la receptividad de la empresa"),
        FactorScore("proximidad", s4, f"{distance_km:.0f} km dentro de un radio de {radius_km} km"),
        FactorScore("requisitos", s5, "Empresa receptora de candidaturas espontáneas"),
    ]
    return _weighted(scores, 0.0, razones)
