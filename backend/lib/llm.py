"""Generación de texto con la clave universal de LLM (Claude, vía Anthropic).

El generador de mensajes usa `claude-sonnet-4-6` a través de la biblioteca
emergentintegrations, ya instalada en el venv del backend. La clave se lee de
EMERGENT_LLM_KEY (backend/.env) y nunca sale del backend. Si la clave no existe
o el proveedor falla, se lanza LlmUnavailable y el router de mensajes aplica su
plantilla local determinista avisando al usuario.
"""

from __future__ import annotations

import logging
import os
import uuid

logger = logging.getLogger(__name__)

MODEL_PROVIDER = "anthropic"
MODEL_NAME = "claude-sonnet-4-6"

SYSTEM_PROMPT = (
    "Eres un orientador profesional español experto en Formación Profesional (Grado Medio y "
    "Grado Superior) y en procesos de selección en España. Escribes candidaturas en español de "
    "España, con tono profesional, cercano y conciso (máximo 180 palabras). Nunca inventas datos "
    "de contacto, nombres de personas ni información de la empresa que no aparezca en el contexto "
    "proporcionado. Si el candidato no tiene experiencia, vendes su formación, sus prácticas y sus "
    "habilidades. Formato de salida obligatorio: la primera línea empieza por 'ASUNTO:' seguido del "
    "asunto del correo; después una línea en blanco y el cuerpo del mensaje. Sin despedidas "
    "genéricas de más de dos líneas, sin firmar con nombre inventado: usa los datos del candidato."
)


class LlmUnavailable(Exception):
    pass


async def generate_text(user_prompt: str) -> str:
    """Genera un texto con Claude (streaming acumulado). Lanza LlmUnavailable si no hay clave."""
    api_key = os.environ.get("EMERGENT_LLM_KEY", "").strip()
    if not api_key:
        raise LlmUnavailable("EMERGENT_LLM_KEY no configurada")

    try:
        from emergentintegrations.llm.chat import LlmChat, StreamDone, TextDelta, UserMessage
    except ImportError as exc:  # pragma: no cover
        raise LlmUnavailable("emergentintegrations no disponible") from exc

    chat = (
        LlmChat(
            api_key=api_key,
            session_id=f"empleo-cerca-de-ti-{uuid.uuid4()}",
            system_message=SYSTEM_PROMPT,
        )
        .with_model(MODEL_PROVIDER, MODEL_NAME)
    )

    chunks: list[str] = []
    try:
        async for event in chat.stream_message(UserMessage(text=user_prompt)):
            if isinstance(event, TextDelta):
                chunks.append(event.content)
            elif isinstance(event, StreamDone):
                break
    except Exception as exc:
        logger.error("LLM stream falló: %s", exc)
        raise LlmUnavailable(str(exc)) from exc

    text = "".join(chunks).strip()
    if not text:
        raise LlmUnavailable("respuesta vacía del modelo")
    return text
