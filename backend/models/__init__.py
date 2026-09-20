"""Modelos Pydantic v2 compartidos (coincidencia y utilidades)."""

from .common import MatchFactor, MatchResult
from .company import Company, CompanyResult, SearchResponse
from .message import GeneratedMessage, MessageGenerateRequest
from .offer import Offer, OfferWithMatch
from .profile import CvInfo, Idioma, ProfileUpdate, UserProfile, UserLocation

__all__ = [
    "MatchFactor",
    "MatchResult",
    "Company",
    "CompanyResult",
    "SearchResponse",
    "GeneratedMessage",
    "MessageGenerateRequest",
    "Offer",
    "OfferWithMatch",
    "CvInfo",
    "Idioma",
    "ProfileUpdate",
    "UserProfile",
    "UserLocation",
]
