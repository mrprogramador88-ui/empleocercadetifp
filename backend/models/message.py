"""Modelos del generador de mensajes con IA."""

from typing import Literal

from pydantic import BaseModel, Field

MessageKind = Literal["cv_email", "espontanea", "practicas", "recien_titulado", "responder_oferta"]

MESSAGE_KIND_LABELS: dict[str, str] = {
    "cv_email": "Envío del CV por correo",
    "espontanea": "Candidatura espontánea (sin oferta publicada)",
    "practicas": "Solicitud de prácticas (FCT / Dual)",
    "recien_titulado": "Presentación como recién titulado",
    "responder_oferta": "Respuesta a una oferta concreta",
}


class MessageGenerateRequest(BaseModel):
    tipo: MessageKind
    company_id: str
    offer_id: str | None = None
    notas: str | None = Field(default=None, max_length=500)


class GeneratedMessage(BaseModel):
    asunto: str
    cuerpo: str
    tipo: MessageKind
    tipo_label: str
    generado_por: Literal["ia", "plantilla"]
    empresa_nombre: str
