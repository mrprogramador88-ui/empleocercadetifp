import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2, MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import LocalityAutocomplete from "@/components/LocalityAutocomplete";
import { apiGet, apiPut, apiUploadCv, type FpCatalog, type GeocodeHit, type Idioma, type UserProfile } from "@/lib/api";
import { BUSCA_LABELS, DISPONIBILIDAD_LABELS, NIVEL_IDIOMA } from "@/lib/format";
import { getClientId } from "@/lib/client";

const IDIOMA_SUGERIDOS = ["Inglés", "Francés", "Alemán", "Italiano", "Español"];

const CARNET_SUGERIDOS = ["B", "BTP", "C", "C+E", "D", "CAP", "TPC", "Carné de instalador"];

const CERT_SUGERIDOS = [
  "Ofimática (Microsoft Office)",
  "Cisco CCNA",
  "Python básico",
  "Soldadura TIG",
  "Manipulador de alimentos",
  "Prevención de riesgos (20 h)",
];

const BUSCA_OPTIONS = ["primer_empleo", "practicas", "indefinido", "temporal"];

interface WizardForm {
  nombre: string;
  email: string;
  telefono: string;
  grado: "GM" | "GS" | "";
  familia_id: string;
  titulo_id: string;
  titulo_manual: string;
  experiencia_anos: number;
  skills: string[];
  certificaciones: string[];
  carnets: string[];
  idiomas: Idioma[];
  disponibilidad: string;
  busca: string[];
  max_distance_km: number;
  locLabel: string;
  locPais: string;
  locPaisCc: string;
  locComunidad: string;
  locProvincia: string;
  locMunicipio: string;
  locCp: string;
  locLat: number | null;
  locLng: number | null;
}

const EMPTY_FORM: WizardForm = {
  nombre: "",
  email: "",
  telefono: "",
  grado: "",
  familia_id: "",
  titulo_id: "",
  titulo_manual: "",
  experiencia_anos: 0,
  skills: [],
  certificaciones: [],
  carnets: [],
  idiomas: [],
  disponibilidad: "",
  busca: [],
  max_distance_km: 50,
  locLabel: "",
  locPais: "España",
  locPaisCc: "es",
  locComunidad: "",
  locProvincia: "",
  locMunicipio: "",
  locCp: "",
  locLat: null,
  locLng: null,
};

const STEPS = ["Estudios FP", "Ubicación y radio", "Preferencias y CV"];

export default function ProfileWizard({
  open,
  canClose,
  onClose,
  profile,
  catalog,
  catalogError,
}: {
  open: boolean;
  canClose: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  catalog: FpCatalog | undefined;
  catalogError: boolean;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [manualTitulo, setManualTitulo] = useState(false);

  const countriesQ = useQuery({
    queryKey: ["countries"],
    queryFn: () => apiGet<{ cc: string; nombre: string }[]>("/geo/countries"),
    staleTime: Infinity,
  });

  // Hidrata el formulario al abrir con el perfil existente.
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setCvFile(null);
    setManualTitulo(false);
    if (profile) {
      setForm({
        nombre: profile.nombre,
        email: profile.email,
        telefono: profile.telefono,
        grado: (profile.grado as "GM" | "GS") ?? "",
        familia_id: profile.familia_id,
        titulo_id: profile.titulo_id,
        titulo_manual: profile.titulo_id ? "" : profile.titulo_nombre,
        experiencia_anos: profile.experiencia_anos,
        skills: profile.skills,
        certificaciones: profile.certificaciones,
        carnets: profile.carnets,
        idiomas: profile.idiomas,
        disponibilidad: profile.disponibilidad,
        busca: profile.busca,
        max_distance_km: profile.max_distance_km,
        locLabel: profile.location?.label ?? "",
        locPais: profile.location?.pais ?? "España",
        locPaisCc: profile.location?.pais_cc ?? "es",
        locComunidad: profile.location?.comunidad ?? "",
        locProvincia: profile.location?.provincia ?? "",
        locMunicipio: profile.location?.municipio ?? "",
        locCp: profile.location?.cp ?? "",
        locLat: profile.location?.lat ?? null,
        locLng: profile.location?.lng ?? null,
      });
      setManualTitulo(!profile.titulo_id && !!profile.titulo_nombre);
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, profile]);

  if (!open) return null;

  const patch = (p: Partial<WizardForm>) => setForm((f) => ({ ...f, ...p }));
  const titulos = (catalog?.titulos ?? []).filter(
    (t) => t.familia === form.familia_id && (!form.grado || t.grado === form.grado)
  );
  const tituloElegido = catalog?.titulos.find((t) => t.id === form.titulo_id);

  const step0Valid = !!form.grado && (!!form.titulo_id || form.titulo_manual.trim().length > 0);
  const step1Valid = form.locLat !== null && form.locLng !== null && !!form.locPaisCc;
  const step2Valid = form.nombre.trim().length > 0;

  const save = async () => {
    if (!step2Valid) {
      toast.error("Indica al menos tu nombre para personalizar los mensajes.");
      return;
    }
    setSaving(true);
    try {
      await apiPut(`/profile?client_id=${encodeURIComponent(getClientId())}`, {
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        grado: form.grado,
        familia_id: form.familia_id,
        titulo_id: form.titulo_id,
        ...(form.titulo_manual.trim() && !form.titulo_id ? { titulo_nombre: form.titulo_manual.trim() } : {}),
        experiencia_anos: form.experiencia_anos,
        skills: form.skills,
        certificaciones: form.certificaciones,
        carnets: form.carnets,
        idiomas: form.idiomas,
        disponibilidad: form.disponibilidad,
        busca: form.busca,
        max_distance_km: form.max_distance_km,
        ...(form.locLat !== null && form.locLng !== null
          ? {
              location: {
                label: form.locLabel || `${form.locMunicipio}, ${form.locProvincia}`,
                pais: form.locPais,
                pais_cc: form.locPaisCc,
                comunidad: form.locComunidad,
                provincia: form.locProvincia,
                municipio: form.locMunicipio,
                cp: form.locCp,
                lat: form.locLat,
                lng: form.locLng,
              },
            }
          : {}),
      });

      if (cvFile) {
        try {
          await apiUploadCv(getClientId(), cvFile);
          toast.success("CV cargado con éxito");
        } catch {
          toast.error("El perfil se guardó, pero no se pudo subir el CV. Inténtalo en «Mi perfil FP».");
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil guardado. Buscando empresas cerca de ti…");
      onClose();
    } catch {
      toast.error("No se pudo guardar el perfil. Comprueba tu conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-50" data-testid="profile-wizard">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 md:py-10">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-700">Asistente de perfil FP</p>
            <h2 className="font-heading text-2xl font-semibold tracking-tight text-slate-900">
              ¿Qué has estudiado y dónde estás?
            </h2>
          </div>
          {canClose && (
            <Button variant="ghost" size="icon" data-testid="wizard-close-button" onClick={onClose} aria-label="Cerrar asistente">
              <X className="size-5" aria-hidden />
            </Button>
          )}
        </div>

        {/* Indicador de pasos */}
        <ol className="mt-5 flex items-center gap-2" data-testid="wizard-step-indicator">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${
                  i < step
                    ? "bg-emerald-100 text-emerald-700"
                    : i === step
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < step ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <span className={`hidden text-xs sm:block ${i === step ? "font-medium text-slate-800" : "text-slate-500"}`}>
                {label}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-slate-200" aria-hidden />}
            </li>
          ))}
        </ol>

        <div className="mt-6 flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs md:p-6" data-testid={`wizard-step-${step}`}>
          {/* ------------------------------------------------ Paso 1: estudios */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Tipo de grado</Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(["GS", "GM"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      data-testid={`wizard-grado-${g.toLowerCase()}`}
                      onClick={() => patch({ grado: g, titulo_id: "" })}
                      className={`rounded-xl border p-3 text-left transition-colors ${
                        form.grado === g ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:border-blue-300"
                      }`}
                    >
                      <span className="block font-heading text-sm font-semibold text-slate-900">
                        {g === "GS" ? "Grado Superior" : "Grado Medio"}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {g === "GS" ? "Técnico superior (2 000 h)" : "Técnico (2 000 h)"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {catalogError ? (
                <div className="space-y-2" data-testid="wizard-catalog-fallback">
                  <div>
                    <Label htmlFor="wizard-familia-manual" className="text-sm">
                      Familia profesional
                    </Label>
                    <Input
                      id="wizard-familia-manual"
                      data-testid="wizard-familia-manual-input"
                      value={form.familia_id}
                      onChange={(e) => patch({ familia_id: e.target.value })}
                      placeholder="Ej.: Electricidad y Electrónica"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="wizard-titulo-manual" className="text-sm">
                      Título obtenido
                    </Label>
                    <Input
                      id="wizard-titulo-manual"
                      data-testid="wizard-titulo-manual-input"
                      value={form.titulo_manual}
                      onChange={(e) => patch({ titulo_manual: e.target.value, titulo_id: "" })}
                      placeholder="Ej.: Sistemas Electrotécnicos y Automatizados"
                      className="mt-1"
                    />
                  </div>
                  <p className="text-xs text-slate-500">El catálogo de títulos no está disponible ahora mismo; escribe tu formación manualmente.</p>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-sm">Familia profesional</Label>
                    <Select value={form.familia_id} onValueChange={(v: string) => patch({ familia_id: v, titulo_id: "" })}>
                      <SelectTrigger data-testid="wizard-familia-select" className="mt-1 w-full">
                        <SelectValue>
                          {form.familia_id
                            ? catalog?.familias.find((f) => f.id === form.familia_id)?.nombre
                            : "Elige una familia profesional"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {catalog?.familias.map((f) => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!manualTitulo && (
                    <div>
                      <Label className="text-sm">Ciclo formativo (título)</Label>
                      {titulos.length > 0 ? (
                        <Select value={form.titulo_id} onValueChange={(v: string) => patch({ titulo_id: v })}>
                          <SelectTrigger data-testid="wizard-titulo-select" className="mt-1 w-full">
                            <SelectValue>
                              {form.titulo_id
                                ? catalog?.titulos.find((t) => t.id === form.titulo_id)?.nombre
                                : "Elige tu ciclo formativo"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {titulos.map((t) => (
                              <SelectItem key={t.id} value={t.id}>
                                {t.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="mt-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                          {form.familia_id
                            ? "Esta familia no tiene títulos listados: escríbelo manualmente."
                            : "Elige primero una familia profesional."}
                        </p>
                      )}
                      <button
                        type="button"
                        className="mt-1 text-xs text-blue-700 underline"
                        data-testid="wizard-titulo-manual-toggle"
                        onClick={() => setManualTitulo(true)}
                      >
                        Escribir el título manualmente
                      </button>
                    </div>
                  )}
                  {manualTitulo && (
                    <div>
                      <Label htmlFor="wizard-titulo-manual" className="text-sm">
                        Título obtenido
                      </Label>
                      <Input
                        id="wizard-titulo-manual"
                        data-testid="wizard-titulo-manual-input"
                        value={form.titulo_manual}
                        onChange={(e) => patch({ titulo_manual: e.target.value, titulo_id: "" })}
                        placeholder="Ej.: Sistemas Electrotécnicos y Automatizados"
                        className="mt-1"
                      />
                      <button
                        type="button"
                        className="mt-1 text-xs text-blue-700 underline"
                        onClick={() => setManualTitulo(false)}
                      >
                        Volver al listado de títulos
                      </button>
                    </div>
                  )}
                </>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="wizard-experiencia" className="text-sm">
                    Experiencia profesional
                  </Label>
                  <span className="font-mono text-sm font-semibold text-blue-700" data-testid="wizard-experiencia-value">
                    {form.experiencia_anos === 0 ? "Sin experiencia" : `${form.experiencia_anos} años`}
                  </span>
                </div>
                <input
                  id="wizard-experiencia"
                  data-testid="wizard-experiencia-slider"
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={form.experiencia_anos}
                  onChange={(e) => patch({ experiencia_anos: Number(e.target.value) })}
                  className="mt-1 w-full cursor-pointer accent-blue-600"
                />
              </div>

              {tituloElegido && (
                <p className="rounded-lg bg-indigo-50 p-2.5 text-xs leading-relaxed text-indigo-900" data-testid="wizard-titulo-areas">
                  <strong>Áreas profesionales detectadas:</strong> {tituloElegido.areas.slice(0, 6).join(", ")}…
                  <br />
                  Las usaremos para emparejar tu perfil con empresas y ofertas.
                </p>
              )}

              <ChipGroup
                label="Habilidades (técnicas y blandas)"
                testid="wizard-skills"
                suggestions={tituloElegido?.skills ?? []}
                selected={form.skills}
                onToggle={(s) => patch({ skills: toggle(form.skills, s) })}
                onAdd={(s) => patch({ skills: addUnique(form.skills, s) })}
                placeholder="Ej.: PLC, soldadura TIG, atención al cliente…"
              />
            </div>
          )}

          {/* ---------------------------------------------- Paso 2: ubicación */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label className="text-sm">País</Label>
                  <Select
                    value={form.locPaisCc}
                    onValueChange={(v: string) => {
                      const nombre = countriesQ.data?.find((c) => c.cc === v)?.nombre ?? "";
                      patch({ locPaisCc: v, locPais: nombre, locComunidad: "", locProvincia: "", locMunicipio: "", locLabel: "", locLat: null, locLng: null });
                    }}
                  >
                    <SelectTrigger data-testid="wizard-country-select" className="mt-1 w-full">
                      <SelectValue>{form.locPais}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(countriesQ.data ?? [{ cc: "es", nombre: "España" }]).map((c) => (
                        <SelectItem key={c.cc} value={c.cc}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-[11px] text-slate-400">Solo España y Europa: la app descarta el resto.</p>
                </div>

                {form.locPaisCc === "es" && (
                  <>
                    <div>
                      <Label className="text-sm">Comunidad autónoma</Label>
                      <Select value={form.locComunidad} onValueChange={(v: string) => patch({ locComunidad: v, locProvincia: "" })}>
                        <SelectTrigger data-testid="wizard-comunidad-select" className="mt-1 w-full">
                          <SelectValue>{form.locComunidad || "Elige una comunidad"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {SPAIN_CCAA.map((c) => (
                            <SelectItem key={c.nombre} value={c.nombre}>
                              {c.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-sm">Provincia</Label>
                      <Select value={form.locProvincia} onValueChange={(v: string) => patch({ locProvincia: v })}>
                        <SelectTrigger data-testid="wizard-provincia-select" className="mt-1 w-full">
                          <SelectValue>{form.locProvincia || "Elige una provincia"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {(SPAIN_CCAA.find((c) => c.nombre === form.locComunidad)?.provincias ?? []).map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <div className={form.locPaisCc === "es" ? "grid grid-cols-1 gap-3 sm:grid-cols-3" : ""}>
                <div className={form.locPaisCc === "es" ? "sm:col-span-2" : ""}>
                  <Label className="text-sm">Dirección, municipio o código postal</Label>
                  <div className="mt-1">
                    <LocalityAutocomplete
                      cc={form.locPaisCc}
                      testid="wizard-locality-input"
                      value={form.locMunicipio || form.locLabel.split(",")[0]}
                      placeholder="Ej.: Abenójar, 28001, Calle Mayor 3…"
                      onSelect={(hit: GeocodeHit) => {
                        const parts = hit.label.split(",");
                        patch({
                          locLabel: hit.label,
                          locLat: hit.lat,
                          locLng: hit.lng,
                          locMunicipio: hit.kind === "city" || hit.kind === "town" || hit.kind === "municipality" ? parts[0].trim() : parts[0].trim(),
                          locPais: hit.country || form.locPais,
                        });
                      }}
                    />
                  </div>
                </div>
                {form.locPaisCc === "es" && (
                  <div>
                    <Label htmlFor="wizard-cp" className="text-sm">
                      Código postal
                    </Label>
                    <Input
                      id="wizard-cp"
                      data-testid="wizard-cp-input"
                      value={form.locCp}
                      onChange={(e) => patch({ locCp: e.target.value.replace(/\D/g, "").slice(0, 5) })}
                      placeholder="13000"
                      inputMode="numeric"
                      className="mt-1"
                    />
                  </div>
                )}
              </div>

              <PinPickerMap
                lat={form.locLat}
                lng={form.locLng}
                radiusKm={form.max_distance_km}
                onPick={(lat, lng) => {
                  patch({ locLat: lat, locLng: lng, locLabel: "" });
                  // Geocodificación inversa para etiquetar la chincheta (falla en silencio).
                  apiGet<GeocodeHit>(`/geo/reverse?lat=${lat}&lng=${lng}`)
                    .then((hit) =>
                      patch({
                        locLabel: hit.label,
                        locMunicipio: hit.label.split(",")[0].trim(),
                        locPais: hit.country || form.locPais,
                        locPaisCc: hit.cc || form.locPaisCc,
                      })
                    )
                    .catch(() => undefined);
                }}
              />
              {form.locLat !== null && (
                <p className="text-[11px] text-slate-500" data-testid="pin-picker-hint">
                  Chincheta fijada. Muévela o pulsa sobre el mapa para ajustar la posición exacta
                  {form.locLabel ? ` — ${form.locLabel}` : "."}
                </p>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="wizard-radius" className="text-sm">
                    Radio de búsqueda máximo
                  </Label>
                  <span className="font-mono text-sm font-semibold text-blue-700" data-testid="wizard-radius-value">
                    {form.max_distance_km} km
                  </span>
                </div>
                <input
                  id="wizard-radius"
                  data-testid="wizard-radius-slider"
                  type="range"
                  min={5}
                  max={300}
                  step={5}
                  value={form.max_distance_km}
                  onChange={(e) => patch({ max_distance_km: Number(e.target.value) })}
                  className="mt-1 w-full cursor-pointer accent-blue-600"
                />
              </div>
            </div>
          )}

          {/* ----------------------------------------- Paso 3: preferencias */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="wizard-nombre" className="text-sm">
                    Nombre y apellidos
                  </Label>
                  <Input
                    id="wizard-nombre"
                    data-testid="wizard-nombre-input"
                    value={form.nombre}
                    onChange={(e) => patch({ nombre: e.target.value })}
                    placeholder="Ej.: Marta Ruiz"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="wizard-email" className="text-sm">
                    Email de contacto
                  </Label>
                  <Input
                    id="wizard-email"
                    data-testid="wizard-email-input"
                    type="email"
                    value={form.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    placeholder="marta.ruiz@ejemplo.es"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="wizard-telefono" className="text-sm">
                    Teléfono (opcional)
                  </Label>
                  <Input
                    id="wizard-telefono"
                    data-testid="wizard-telefono-input"
                    value={form.telefono}
                    onChange={(e) => patch({ telefono: e.target.value })}
                    placeholder="600 000 000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Disponibilidad de incorporación</Label>
                  <Select value={form.disponibilidad} onValueChange={(v: string) => patch({ disponibilidad: v })}>
                    <SelectTrigger data-testid="wizard-disponibilidad-select" className="mt-1 w-full">
                      <SelectValue>
                        {form.disponibilidad
                          ? DISPONIBILIDAD_LABELS[form.disponibilidad] ?? form.disponibilidad
                          : "Elige tu disponibilidad"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(DISPONIBILIDAD_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-sm">Qué buscas</Label>
                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-2">
                  {BUSCA_OPTIONS.map((b) => (
                    <label key={b} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        data-testid={`wizard-busca-${b}`}
                        checked={form.busca.includes(b)}
                        onChange={() => patch({ busca: toggle(form.busca, b) })}
                        className="size-4 accent-blue-600"
                      />
                      {BUSCA_LABELS[b]}
                    </label>
                  ))}
                </div>
              </div>

              <ChipGroup
                label="Certificaciones"
                testid="wizard-certificaciones"
                suggestions={CERT_SUGERIDOS}
                selected={form.certificaciones}
                onToggle={(s) => patch({ certificaciones: toggle(form.certificaciones, s) })}
                onAdd={(s) => patch({ certificaciones: addUnique(form.certificaciones, s) })}
                placeholder="Ej.: Cisco CCNA, manipulador de alimentos…"
              />

              <ChipGroup
                label="Carnets profesionales y de conducir"
                testid="wizard-carnets"
                suggestions={CARNET_SUGERIDOS}
                selected={form.carnets}
                onToggle={(s) => patch({ carnets: toggle(form.carnets, s) })}
                onAdd={(s) => patch({ carnets: addUnique(form.carnets, s) })}
                placeholder="Ej.: B, BTP, TPC…"
              />

              <IdiomasEditor
                idiomas={form.idiomas}
                onChange={(idiomas) => patch({ idiomas })}
              />

              <div>
                <Label className="text-sm">Currículum en PDF</Label>
                <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-dashed border-slate-300 p-3" data-testid="wizard-cv-dropzone">
                  <FileText className="size-5 text-blue-700" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700" data-testid="wizard-cv-name">
                      {cvFile ? cvFile.name : profile?.cv ? profile.cv.original_name : "Ningún CV cargado"}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {cvFile
                        ? `${Math.round(cvFile.size / 1024)} KB — se subirá al guardar`
                        : profile?.cv
                          ? `${profile.cv.size_kb} KB — ya guardado`
                          : "PDF, máx. 5 MB (opcional)"}
                    </p>
                  </div>
                  <label className="shrink-0">
                    <input
                      type="file"
                      accept="application/pdf"
                      data-testid="wizard-cv-input"
                      className="sr-only"
                      onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                    />
                    <span className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Elegir PDF
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Navegación */}
        <div className="sticky bottom-0 mt-4 flex items-center gap-2 bg-slate-50/95 py-3 backdrop-blur">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} data-testid="wizard-back-button">
            <ArrowLeft className="size-4" aria-hidden />
            Atrás
          </Button>
          <p className="ml-1 hidden text-xs text-slate-500 sm:block">
            Paso {step + 1} de {STEPS.length}
          </p>
          <div className="ml-auto flex items-center gap-2">
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={(step === 0 && !step0Valid) || (step === 1 && !step1Valid)}
                data-testid="wizard-next-button"
              >
                Siguiente
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={save} disabled={saving || !step2Valid} data-testid="wizard-save-button">
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Guardar y buscar empleo
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- helpers ---

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function addUnique(list: string[], v: string): string[] {
  return list.includes(v) ? list : [...list, v];
}

// Datos oficiales de comunidades autónomas/provincias (espejo del backend).
const SPAIN_CCAA: { nombre: string; provincias: string[] }[] = [
  { nombre: "Andalucía", provincias: ["Almería", "Cádiz", "Córdoba", "Granada", "Huelva", "Jaén", "Málaga", "Sevilla"] },
  { nombre: "Aragón", provincias: ["Huesca", "Teruel", "Zaragoza"] },
  { nombre: "Asturias", provincias: ["Asturias"] },
  { nombre: "Illes Balears", provincias: ["Illes Balears"] },
  { nombre: "Canarias", provincias: ["Las Palmas", "Santa Cruz de Tenerife"] },
  { nombre: "Cantabria", provincias: ["Cantabria"] },
  { nombre: "Castilla-La Mancha", provincias: ["Albacete", "Ciudad Real", "Cuenca", "Guadalajara", "Toledo"] },
  { nombre: "Castilla y León", provincias: ["Ávila", "Burgos", "León", "Palencia", "Salamanca", "Segovia", "Soria", "Valladolid", "Zamora"] },
  { nombre: "Cataluña", provincias: ["Barcelona", "Girona", "Lleida", "Tarragona"] },
  { nombre: "Comunidad Valenciana", provincias: ["Alicante", "Castellón", "Valencia"] },
  { nombre: "Extremadura", provincias: ["Badajoz", "Cáceres"] },
  { nombre: "Galicia", provincias: ["A Coruña", "Lugo", "Ourense", "Pontevedra"] },
  { nombre: "La Rioja", provincias: ["La Rioja"] },
  { nombre: "Comunidad de Madrid", provincias: ["Madrid"] },
  { nombre: "Región de Murcia", provincias: ["Murcia"] },
  { nombre: "Comunidad Foral de Navarra", provincias: ["Navarra"] },
  { nombre: "País Vasco", provincias: ["Álava", "Guipúzcoa", "Vizcaya"] },
  { nombre: "Ceuta", provincias: ["Ceuta"] },
  { nombre: "Melilla", provincias: ["Melilla"] },
];

function ChipGroup({
  label,
  testid,
  suggestions,
  selected,
  onToggle,
  onAdd,
  placeholder,
}: {
  label: string;
  testid: string;
  suggestions: string[];
  selected: string[];
  onToggle: (v: string) => void;
  onAdd: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5" data-testid={`${testid}-selected`}>
          {selected.map((s) => (
            <Badge key={s} className="gap-1 bg-blue-600 text-white hover:bg-blue-600" data-testid={`${testid}-chip`}>
              {s}
              <button type="button" onClick={() => onToggle(s)} aria-label={`Quitar ${s}`} data-testid={`${testid}-chip-remove`}>
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="mt-1.5 flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && draft.trim()) {
              e.preventDefault();
              onAdd(draft.trim());
              setDraft("");
            }
          }}
          placeholder={placeholder}
          data-testid={`${testid}-input`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            if (draft.trim()) {
              onAdd(draft.trim());
              setDraft("");
            }
          }}
          data-testid={`${testid}-add-button`}
        >
          Añadir
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions
            .filter((s) => !selected.includes(s))
            .slice(0, 8)
            .map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 transition-colors hover:border-blue-400 hover:text-blue-700"
                onClick={() => onToggle(s)}
                data-testid={`${testid}-suggestion`}
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function IdiomasEditor({ idiomas, onChange }: { idiomas: Idioma[]; onChange: (v: Idioma[]) => void }) {
  return (
    <div>
      <Label className="text-sm">Idiomas</Label>
      <div className="mt-1.5 space-y-2" data-testid="wizard-idiomas-editor">
        {idiomas.map((idioma, i) => (
          <div key={i} className="flex items-center gap-2">
            <Select
              value={idioma.nombre}
              onValueChange={(v: string) => onChange(idiomas.map((x, j) => (j === i ? { ...x, nombre: v } : x)))}
            >
              <SelectTrigger size="sm" data-testid={`wizard-idioma-nombre-${i}`} className="w-40">
                <SelectValue>{idioma.nombre}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {IDIOMA_SUGERIDOS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={idioma.nivel}
              onValueChange={(v: string) => onChange(idiomas.map((x, j) => (j === i ? { ...x, nivel: v } : x)))}
            >
              <SelectTrigger size="sm" data-testid={`wizard-idioma-nivel-${i}`} className="w-32">
                <SelectValue>{idioma.nivel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {NIVEL_IDIOMA.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Quitar ${idioma.nombre}`}
              data-testid={`wizard-idioma-remove-${i}`}
              onClick={() => onChange(idiomas.filter((_, j) => j !== i))}
            >
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="wizard-idioma-add"
          onClick={() => onChange([...idiomas, { nombre: "Inglés", nivel: "B1" }])}
        >
          Añadir idioma
        </Button>
      </div>
    </div>
  );
}

function PinPickerMap({
  lat,
  lng,
  radiusKm,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  onPick: (lat: number, lng: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, { center: [lat ?? 40.4168, lng ?? -3.7038], zoom: lat === null ? 5 : 11 });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => pickRef.current(e.latlng.lat, e.latlng.lng));
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === null || lng === null) return;
    const pos: L.LatLngExpression = [lat, lng];
    if (!markerRef.current) {
      markerRef.current = L.marker(pos, {
        draggable: true,
        icon: L.divIcon({
          className: "",
          html: '<div class="user-pin"><span class="user-pin-dot"></span></div>',
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      })
        .addTo(map)
        .bindTooltip("Tu ubicación — arrastra para ajustar", { direction: "top" });
      markerRef.current.on("dragend", () => {
        const p = markerRef.current!.getLatLng();
        pickRef.current(p.lat, p.lng);
      });
      circleRef.current = L.circle(pos, {
        radius: radiusKm * 1000,
        color: "#2563EB",
        weight: 1.5,
        fillColor: "#2563EB",
        fillOpacity: 0.08,
      }).addTo(map);
      map.setView(pos, 11);
    } else {
      markerRef.current.setLatLng(pos);
      circleRef.current?.setLatLng(pos);
      circleRef.current?.setRadius(radiusKm * 1000);
    }
  }, [lat, lng, radiusKm]);

  return <div ref={ref} className="h-64 w-full rounded-lg border border-slate-200" data-testid="pin-picker-map" />;
}
