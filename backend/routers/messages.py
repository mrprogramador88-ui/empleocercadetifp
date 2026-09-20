"""Generador de mensajes de candidatura con IA (Claude).

Construye el contexto a partir del perfil real del usuario y de los datos reales
que existan de la empresa/oferta (nada inventado), pide a Claude un asunto y un
cuerpo, y si la IA no está disponible aplica una plantilla local determinista
etiquetada como tal (`generado_por="plantilla"`).
"""

from fastapi import APIRouter, HTTPException

from lib.db import db
from lib.llm import LlmUnavailable, generate_text
from models.message import (
    MESSAGE_KIND_LABELS,
    GeneratedMessage,
    MessageGenerateRequest,
)

router = APIRouter(tags=["mensajes"])

TIPO_GUIA: dict[str, str] = {
    "cv_email": "El objetivo es enviar el CV por correo electrónico y solicitar ser considerado en futuros procesos.",
    "espontanea": "No hay oferta publicada: es una autocandidatura para trabajar en la empresa en puestos afines a la formación.",
    "practicas": "Se solicita realizar las prácticas de Formación Profesional (FCT / Dual) o un contrato de formación en la empresa.",
    "recien_titulado": "El candidato se presenta como recién titulado, sin experiencia laboral previa, destacando formación y actitud.",
    "responder_oferta": "El mensaje responde a una oferta concreta publicada por la empresa: referencia al puesto y a los requisitos.",
}


async def _load_context(req: MessageGenerateRequest, client_id: str) -> tuple[dict, dict, dict | None]:
    profile_doc = await db.profiles.find_one({"client_id": client_id}, {"_id": 0})
    if not profile_doc:
        raise HTTPException(status_code=404, detail="perfil_no_encontrado")
    company_doc = await db.companies.find_one({"id": req.company_id}, {"_id": 0})
    if not company_doc:
        raise HTTPException(status_code=404, detail="empresa_no_encontrada")
    offer_doc = None
    if req.offer_id:
        offer_doc = await db.offers.find_one({"id": req.offer_id}, {"_id": 0})
    return profile_doc, company_doc, offer_doc


def _build_prompt(req: MessageGenerateRequest, profile: dict, company: dict, offer: dict | None) -> str:
    idiomas = ", ".join(f"{i.get('nombre')} ({i.get('nivel')})" for i in profile.get("idiomas", [])) or "no indicados"
    offer_txt = ""
    if offer:
        offer_txt = (
            f"- Oferta: {offer.get('title')} | Contrato: {offer.get('contract_type')} | Jornada: {offer.get('jornada')}\n"
            f"- Requisitos de la oferta: {', '.join(offer.get('skills', [])) or 'no detallados'}\n"
        )
    else:
        offer_txt = "- No hay oferta publicada: el mensaje es una candidatura general a la empresa.\n"

    notas = (req.notas or "").strip()
    return (
        f"Redacta un mensaje de candidatura (tipo: {MESSAGE_KIND_LABELS[req.tipo]}).\n"
        f"Objetivo del mensaje: {TIPO_GUIA[req.tipo]}\n\n"
        "DATOS DEL CANDIDATO (usar solo estos datos, no inventar ninguno):\n"
        f"- Nombre: {profile.get('nombre') or 'el candidato'}\n"
        f"- Formación: {profile.get('grado') or ''} {profile.get('titulo_nombre') or ''} — "
        f"{profile.get('familia_nombre') or ''}\n"
        f"- Experiencia: {profile.get('experiencia_anos', 0)} años\n"
        f"- Habilidades: {', '.join(profile.get('skills', [])) or 'no indicadas'}\n"
        f"- Certificaciones: {', '.join(profile.get('certificaciones', [])) or 'ninguna indicada'}\n"
        f"- Carnets: {', '.join(profile.get('carnets', [])) or 'ninguno indicado'}\n"
        f"- Idiomas: {idiomas}\n"
        f"- Disponibilidad: {profile.get('disponibilidad') or 'no indicada'}\n"
        f"- Email de contacto del candidato: {profile.get('email') or 'no indicado'}\n\n"
        "DATOS DE LA EMPRESA (usar solo estos datos, no inventar ninguno):\n"
        f"- Nombre: {company.get('name')} | Sector: {company.get('sector_label')} | "
        f"Localidad: {company.get('city')} ({company.get('country')})\n"
        f"- Actividad declarada: {company.get('description') or 'no disponible'}\n"
        f"{offer_txt}\n"
        + (f"Notas adicionales del candidato: {notas}\n" if notas else "")
        + "\nDevuelve exactamente: primera línea 'ASUNTO: <asunto breve>' y a continuación el cuerpo."
    )


def _template(req: MessageGenerateRequest, profile: dict, company: dict, offer: dict | None) -> GeneratedMessage:
    nombre = profile.get("nombre") or "candidato/a"
    titulo = profile.get("titulo_nombre") or "Formación Profesional"
    skills = ", ".join(profile.get("skills", [])[:4]) or "mis habilidades técnicas"
    puesto = offer.get("title", "puestos afines a mi formación") if offer else "puestos afines a mi formación"
    cuerpo = (
        f"Muy señores/as:\n\n"
        f"Mi nombre es {nombre} y acabo de completar el {profile.get('grado') or 'ciclo formativo'} de {titulo} "
        f"({profile.get('familia_nombre') or ''}). Les escribo"
        + (f" en relación con la oferta de {puesto}" if offer else " para presentarles mi candidatura de forma espontánea")
        + f". Me interesa especialmente {company.get('name')} por su actividad en {company.get('sector_label')}.\n\n"
        f"Durante mi formación he trabajado {skills}"
        + (f", y cuento con {profile.get('experiencia_anos')} años de experiencia" if profile.get("experiencia_anos") else ", con muchas ganas de empezar")
        + f". {profile.get('disponibilidad') or 'Estoy disponible para incorporarme de inmediato'}.\n\n"
        "Adjunto mi currículum y quedo a su disposición para una entrevista.\n\n"
        "Un cordial saludo."
    )
    return GeneratedMessage(
        asunto=("Candidatura: " + puesto if offer else "Candidatura espontánea — " + titulo),
        cuerpo=cuerpo,
        tipo=req.tipo,
        tipo_label=MESSAGE_KIND_LABELS[req.tipo],
        generado_por="plantilla",
        empresa_nombre=company.get("name", ""),
    )


@router.post("/messages/generate", response_model=GeneratedMessage)
async def generate_message(req: MessageGenerateRequest, client_id: str):
    profile, company, offer = await _load_context(req, client_id)

    try:
        raw = await generate_text(_build_prompt(req, profile, company, offer))
        first, _, rest = raw.partition("\n")
        asunto = first.replace("ASUNTO:", "").strip() or "Candidatura"
        cuerpo = rest.strip() or raw.strip()
        return GeneratedMessage(
            asunto=asunto,
            cuerpo=cuerpo,
            tipo=req.tipo,
            tipo_label=MESSAGE_KIND_LABELS[req.tipo],
            generado_por="ia",
            empresa_nombre=company.get("name", ""),
        )
    except LlmUnavailable:
        return _template(req, profile, company, offer)
