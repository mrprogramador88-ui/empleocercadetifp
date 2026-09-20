// Typed fetch layer over the FastAPI backend. Base is the relative "/api" prefix so the
// same code works in dev (Vite proxies /api → :8001) and behind a single origin in prod.
const BASE = "/api";

// ---------------------------------------------------------------------------
// Tipos que reflejan los modelos Pydantic del backend (se mantienen a mano y en
// la misma edición que su modelo correspondiente — nada infiere la frontera).
// ---------------------------------------------------------------------------

export interface MatchFactor {
  factor: string;
  label: string;
  peso: number;
  score: number;
  detalle: string;
}

export interface MatchResult {
  pct: number;
  factores: MatchFactor[];
  razones: string[];
}

export interface Idioma {
  nombre: string;
  nivel: string;
}

export interface UserLocation {
  label: string;
  pais: string;
  pais_cc: string;
  comunidad: string;
  provincia: string;
  municipio: string;
  cp: string;
  lat: number;
  lng: number;
}

export interface CvInfo {
  filename: string;
  original_name: string;
  size_kb: number;
  uploaded_at: string;
}

export interface UserProfile {
  id: string;
  client_id: string;
  nombre: string;
  email: string;
  telefono: string;
  grado: string; // "GM" | "GS"
  familia_id: string;
  familia_nombre: string;
  titulo_id: string;
  titulo_nombre: string;
  experiencia_anos: number;
  skills: string[];
  certificaciones: string[];
  carnets: string[];
  idiomas: Idioma[];
  disponibilidad: string;
  busca: string[];
  max_distance_km: number;
  location: UserLocation | null;
  cv: CvInfo | null;
  updated_at: string;
}

export interface GeocodeHit {
  label: string;
  lat: number;
  lng: number;
  cc: string;
  country: string;
  kind: string;
}

export interface FpFamilia {
  id: string;
  nombre: string;
}

export interface FpTitulo {
  id: string;
  nombre: string;
  grado: string;
  familia: string;
  areas: string[];
  skills: string[];
}

export interface FpCatalog {
  familias: FpFamilia[];
  titulos: FpTitulo[];
}

export interface Company {
  id: string;
  name: string;
  sector: string;
  sector_label: string;
  description: string;
  city: string;
  province: string;
  comunidad: string;
  country: string;
  country_code: string;
  address: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  accepts_cv_spontaneous: boolean;
  lat: number;
  lng: number;
  source: string;
}

export interface Offer {
  id: string;
  company_id: string;
  title: string;
  description: string;
  contract_type: string;
  jornada: string;
  skills: string[];
  min_experience_years: number;
  accepts_no_experience: boolean;
  is_internship: boolean;
  first_job_friendly: boolean;
  active: boolean;
  published_at: string;
  source: string;
  source_url: string | null;
  salary: string | null;
}

export interface OfferWithMatch extends Offer {
  match_pct: number;
  match: MatchResult | null;
}

export interface CompanyResult {
  company: Company;
  distance_km: number;
  match: MatchResult;
  offers: OfferWithMatch[];
  has_active_offer: boolean;
}

export interface SearchResponse {
  center: { lat: number; lng: number };
  radius_km: number;
  total: number;
  truncated: boolean;
  results: CompanyResult[];
}

export interface AppConfig {
  app_name: string;
  ambito: string;
  maps_provider: "google" | "osm";
  maps_api_key: string | null;
  geocoder: string;
  ai_enabled: boolean;
}

export interface DataSource {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  requiere: string[];
  descripcion: string;
}

export type MessageKind = "cv_email" | "espontanea" | "practicas" | "recien_titulado" | "responder_oferta";

export interface GeneratedMessage {
  asunto: string;
  cuerpo: string;
  tipo: MessageKind;
  tipo_label: string;
  generado_por: "ia" | "plantilla";
  empresa_nombre: string;
}

// Fields are declared, not constructor parameter properties: tsconfig sets
// erasableSyntaxOnly, which rejects `constructor(readonly status: number)`.
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`request failed with ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

type JsonBody = unknown;

async function request<T>(method: string, path: string, body?: JsonBody): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // FastAPI reports request-validation failures as 422 with a {detail: [...]} body.
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// The response type is yours to declare: nothing infers across the Python boundary, so a
// TS interface here mirrors the endpoint's Pydantic model by hand — keep the two in sync.
export const apiGet = <T>(path: string) => request<T>("GET", path);
export const apiPost = <T>(path: string, body?: JsonBody) => request<T>("POST", path, body ?? null);
export const apiPut = <T>(path: string, body?: JsonBody) => request<T>("PUT", path, body ?? null);
export const apiPatch = <T>(path: string, body?: JsonBody) =>
  request<T>("PATCH", path, body ?? null);
export const apiDelete = <T>(path: string) => request<T>("DELETE", path);

/** Sube el CV (multipart) al backend. */
export async function apiUploadCv(clientId: string, file: File): Promise<CvInfo> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/profile/cv?client_id=${encodeURIComponent(clientId)}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }
  return (await res.json()) as CvInfo;
}
