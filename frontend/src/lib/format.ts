// Utilidades de formato compartidas (etiquetas espejo de los modelos Pydantic).
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale";

export const CONTRACT_LABELS: Record<string, string> = {
  indefinido: "Indefinido",
  temporal: "Temporal",
  practicas: "Prácticas / FCT-Dual",
  formativo: "Contrato formativo",
};

export const JORNADA_LABELS: Record<string, string> = {
  completa: "Jornada completa",
  parcial: "Media jornada",
  turnos: "Turnos",
};

export const DISPONIBILIDAD_LABELS: Record<string, string> = {
  inmediata: "Incorporación inmediata",
  "2_semanas": "En 2 semanas",
  "1_mes": "En 1 mes",
  "3_meses": "En 3 meses",
  fin_de_curso: "Al finalizar el curso",
};

export const BUSCA_LABELS: Record<string, string> = {
  primer_empleo: "Primer empleo",
  practicas: "Prácticas FCT / Dual",
  indefinido: "Contrato indefinido",
  temporal: "Contrato temporal",
};

export const NIVEL_IDIOMA = ["A1", "A2", "B1", "B2", "C1", "C2", "nativo"];

export type MatchTier = "alta" | "media" | "general";

export function matchTier(pct: number): MatchTier {
  if (pct >= 85) return "alta";
  if (pct >= 65) return "media";
  return "general";
}

export const TIER_COLORS: Record<MatchTier, { bg: string; fg: string; label: string }> = {
  alta: { bg: "#DCFCE7", fg: "#166534", label: "Alta afinidad" },
  media: { bg: "#FEF3C7", fg: "#92400E", label: "Buena afinidad" },
  general: { bg: "#E2E8F0", fg: "#475569", label: "Afinidad general" },
};

export function fmtDistance(km: number): string {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  return `${km.toFixed(1).replace(".", ",")} km`;
}

export function tiempoRelativo(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: es });
}

export function mailtoHref(email: string, asunto: string, cuerpo: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
}
