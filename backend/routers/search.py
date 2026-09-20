"""Búsqueda de empresas y ofertas dentro del radio del usuario.

Agrega todas las fuentes activas (catálogo de demostración + cualquier API
externa configurada), filtra por distancia haversine, calcula el porcentaje de
coincidencia con el motor (lib/matching.py) y aplica los filtros de la interfaz.
Todo el cálculo es en memoria sobre los documentos ya descargados: una búsqueda
de radio amplio se resuelve en milisegundos.
"""

from fastapi import APIRouter, HTTPException, Query

from lib.geo import haversine_km, is_europe_cc
from lib.matching import score_company, score_offer
from lib.sources import active_providers
from lib.db import db
from models.company import Company, CompanyResult, SearchResponse
from models.offer import Offer, OfferWithMatch
from models.profile import UserProfile

router = APIRouter(tags=["búsqueda"])


async def _get_profile(client_id: str) -> UserProfile:
    doc = await db.profiles.find_one({"client_id": client_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="perfil_no_encontrado")
    return UserProfile(**doc)


def _company(doc: dict) -> Company:
    return Company(**{k: v for k, v in doc.items() if k in Company.model_fields})


def _offer(doc: dict) -> Offer:
    return Offer(**{k: v for k, v in doc.items() if k in Offer.model_fields})


@router.get("/search", response_model=SearchResponse)
async def search(
    client_id: str,
    lat: float = Query(..., ge=-90, le=90),
    lng: float = Query(..., ge=-180, le=180),
    radius_km: float = Query(50, ge=1, le=3000),
    sector: str | None = None,
    contract: str | None = None,  # indefinido | temporal | practicas | formativo
    jornada: str | None = None,  # completa | parcial | turnos
    min_match: int = Query(0, ge=0, le=100),
    only_active: bool = True,
    no_exp_only: bool = False,
    internships_only: bool = False,
    sort: str = Query("match", pattern="^(match|distancia)$"),
):
    profile = await _get_profile(client_id)
    profile_dict = profile.model_dump()
    offer_filter_active = bool(contract or jornada or no_exp_only or internships_only)

    # 1) Empresas de todas las fuentes activas (ámbito restringido a Europa).
    companies: list[Company] = []
    for provider in active_providers():
        try:
            for doc in await provider.list_companies():
                if not is_europe_cc(doc.get("country_code", "")):
                    continue
                companies.append(_company(doc))
        except Exception:
            continue  # una fuente caída no debe tumbar la búsqueda

    # 2) Filtro geográfico (haversine sobre el radio del usuario) y de sector.
    within: list[tuple[Company, float]] = []
    for company in companies:
        if sector and company.sector != sector:
            continue
        d = haversine_km(lat, lng, company.lat, company.lng)
        if d <= radius_km:
            within.append((company, d))

    # 3) Ofertas por empresa (de las mismas fuentes), ya filtradas por los controles.
    offers_by_company: dict[str, list[dict]] = {}
    for provider in active_providers():
        try:
            for doc in await provider.list_offers():
                offers_by_company.setdefault(doc.get("company_id", ""), []).append(doc)
        except Exception:
            continue

    results: list[CompanyResult] = []
    for company, distance in within:
        raw_offers = offers_by_company.get(company.id, [])
        selected: list[OfferWithMatch] = []
        for doc in raw_offers:
            offer = _offer(doc)
            if only_active and not offer.active:
                continue
            if contract and offer.contract_type != contract:
                continue
            if jornada and offer.jornada != jornada:
                continue
            if no_exp_only and not offer.accepts_no_experience:
                continue
            if internships_only and not offer.is_internship:
                continue
            outcome = score_offer(profile_dict, company.model_dump(), doc, distance, radius_km)
            selected.append(OfferWithMatch(**offer.model_dump(), match_pct=outcome["pct"], match=outcome))

        company_match = score_company(profile_dict, company.model_dump(), distance, radius_km)
        best_pct = max((o.match_pct for o in selected), default=company_match["pct"])
        if min_match and best_pct < min_match:
            continue
        # Con un filtro de oferta activo (contrato, jornada, prácticas, sin experiencia),
        # una empresa sin ninguna oferta que lo cumpla no es un resultado válido: solo
        # se listan empresas "sin oferta" cuando el usuario no ha filtrado por oferta.
        if not selected and (offer_filter_active or not company.accepts_cv_spontaneous):
            continue

        results.append(
            CompanyResult(
                company=company,
                distance_km=round(distance, 1),
                match=selected[0].match if selected and selected[0].match else company_match,
                offers=sorted(selected, key=lambda o: o.match_pct, reverse=True),
                has_active_offer=any(o.active for o in selected),
            )
        )

    # 4) Orden: afinidad (por defecto) o distancia; desempate por ofertas activas.
    results.sort(
        key=lambda r: (
            -max((o.match_pct for o in r.offers), default=r.match.pct),
            r.distance_km,
        )
        if sort == "match"
        else (r.distance_km, -max((o.match_pct for o in r.offers), default=r.match.pct))
    )

    return SearchResponse(
        center={"lat": lat, "lng": lng},
        radius_km=radius_km,
        total=len(results),
        truncated=len(results) >= 200,
        results=results[:200],
    )
