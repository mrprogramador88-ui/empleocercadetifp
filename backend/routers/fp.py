"""Catálogo de la FP española: familias profesionales y títulos regulados."""

from fastapi import APIRouter

from lib.fp_catalog import FAMILIAS, TITULOS

router = APIRouter(prefix="/fp", tags=["fp"])


@router.get("/catalog")
async def catalog():
    return {"familias": FAMILIAS, "titulos": TITULOS}
