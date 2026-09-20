"""Perfil del usuario FP: consulta, guardado y subida del CV en PDF.

Sin login: cada navegador genera un client_id anónimo (localStorage) que se pasa
como parámetro y queda asociado al perfil en MongoDB. No hay contraseñas ni
tokens; el perfil es el único dato persistente del usuario.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile

from lib.db import db
from models.profile import CvInfo, ProfileUpdate, UserProfile, apply_update

router = APIRouter(tags=["perfil"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
MAX_CV_BYTES = 5 * 1024 * 1024  # 5 MB


async def _get_profile(client_id: str) -> UserProfile | None:
    doc = await db.profiles.find_one({"client_id": client_id}, {"_id": 0})
    return UserProfile(**doc) if doc else None


@router.get("/profile")
async def get_profile(client_id: str):
    profile = await _get_profile(client_id)
    if not profile:
        raise HTTPException(status_code=404, detail="perfil_no_encontrado")
    return profile


@router.put("/profile", response_model=UserProfile)
async def save_profile(client_id: str, update: ProfileUpdate):
    if not client_id:
        raise HTTPException(status_code=422, detail="client_id requerido")
    existing = await _get_profile(client_id)
    if existing:
        profile = apply_update(existing, update)
    else:
        data = update.model_dump(exclude_unset=True)
        data.setdefault("titulo_id", "")
        profile = UserProfile(client_id=client_id, **data)
        profile = apply_update(profile, update)  # normaliza nombre de familia/título

    await db.profiles.update_one(
        {"client_id": client_id},
        {"$set": profile.model_dump(), "$setOnInsert": {"_created_at": profile.updated_at}},
        upsert=True,
    )
    return profile


@router.post("/profile/cv", response_model=CvInfo)
async def upload_cv(client_id: str, file: UploadFile = File(...)):
    if not client_id:
        raise HTTPException(status_code=422, detail="client_id requerido")
    profile = await _get_profile(client_id)
    if not profile:
        raise HTTPException(status_code=404, detail="perfil_no_encontrado")

    name = file.filename or "cv.pdf"
    if not name.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="El CV debe ser un archivo PDF")
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=422, detail="El archivo está vacío")
    if len(content) > MAX_CV_BYTES:
        raise HTTPException(status_code=422, detail="El CV no puede superar 5 MB")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{client_id}_{uuid.uuid4().hex[:8]}.pdf"
    (UPLOAD_DIR / filename).write_bytes(content)

    cv = CvInfo(
        filename=filename,
        original_name=name,
        size_kb=len(content) // 1024,
        uploaded_at=datetime.now(timezone.utc),
    )
    await db.profiles.update_one(
        {"client_id": client_id},
        {"$set": {"cv": cv.model_dump(), "updated_at": cv.uploaded_at}},
    )
    return cv
