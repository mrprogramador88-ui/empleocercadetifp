import { SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FpFamilia, UserProfile } from "@/lib/api";

export interface FilterState {
  radius: number;
  sector: string; // id de familia o ""
  contract: string; // indefinido | temporal | practicas | formativo | ""
  jornada: string; // completa | parcial | turnos | ""
  minMatch: number;
  onlyActive: boolean;
  noExpOnly: boolean;
  internshipsOnly: boolean;
  sort: "match" | "distancia";
}

export const DEFAULT_FILTERS: FilterState = {
  radius: 50,
  sector: "",
  contract: "",
  jornada: "",
  minMatch: 0,
  onlyActive: true,
  noExpOnly: false,
  internshipsOnly: false,
  sort: "match",
};

const CONTRACT_OPTIONS = [
  { value: "indefinido", label: "Indefinido" },
  { value: "temporal", label: "Temporal" },
  { value: "practicas", label: "Prácticas / FCT-Dual" },
  { value: "formativo", label: "Formativo" },
];

const JORNADA_OPTIONS = [
  { value: "completa", label: "Completa" },
  { value: "parcial", label: "Media jornada" },
  { value: "turnos", label: "Turnos" },
];

export default function SearchFilters({
  filters,
  onChange,
  familias,
  profile,
  resultCount,
  activeOfferCount,
}: {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  familias: FpFamilia[];
  profile: UserProfile | null;
  resultCount: number;
  activeOfferCount: number;
}) {
  const loc = profile?.location;

  return (
    <div className="space-y-3 border-b border-slate-200 bg-white p-4" data-testid="search-filters">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-500">
          <SlidersHorizontal className="size-3.5" aria-hidden />
          Filtros
        </div>
        {loc && (
          <Badge variant="secondary" data-testid="filter-location-chip" className="bg-blue-50 text-blue-800 hover:bg-blue-50">
            {loc.municipio || loc.label.split(",")[0]} · {loc.provincia || loc.pais}
          </Badge>
        )}
        <span className="ml-auto text-xs text-slate-500" data-testid="filter-counts">
          {resultCount} empresas · {activeOfferCount} ofertas activas
        </span>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="filter-radius" className="text-xs text-slate-600">
            Radio de búsqueda
          </Label>
          <span className="font-mono text-xs font-semibold text-blue-700" data-testid="radius-value">
            {filters.radius} km
          </span>
        </div>
        <input
          id="filter-radius"
          data-testid="radius-slider"
          type="range"
          min={5}
          max={300}
          step={5}
          value={filters.radius}
          onChange={(e) => onChange({ radius: Number(e.target.value) })}
          className="mt-1 w-full cursor-pointer accent-blue-600"
          aria-label="Radio de búsqueda en kilómetros"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-xs text-slate-600">Sector profesional</Label>
          <Select value={filters.sector} onValueChange={(v: string) => onChange({ sector: v })}>
            <SelectTrigger size="sm" data-testid="filter-sector" className="mt-1 w-full">
              <SelectValue>{filters.sector ? familias.find((f) => f.id === filters.sector)?.nombre ?? filters.sector : "Todos los sectores"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos los sectores</SelectItem>
              {familias.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-slate-600">Contrato</Label>
          <Select value={filters.contract} onValueChange={(v: string) => onChange({ contract: v })}>
            <SelectTrigger size="sm" data-testid="filter-contract" className="mt-1 w-full">
              <SelectValue>{filters.contract ? CONTRACT_OPTIONS.find((o) => o.value === filters.contract)?.label : "Todos"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              {CONTRACT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs text-slate-600">Jornada</Label>
          <Select value={filters.jornada} onValueChange={(v: string) => onChange({ jornada: v })}>
            <SelectTrigger size="sm" data-testid="filter-jornada" className="mt-1 w-full">
              <SelectValue>{filters.jornada ? JORNADA_OPTIONS.find((o) => o.value === filters.jornada)?.label : "Todas"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              {JORNADA_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="filter-min-match" className="text-xs text-slate-600">
              Coincidencia mínima con tu perfil
            </Label>
            <span className="font-mono text-xs font-semibold text-blue-700" data-testid="min-match-value">
              {filters.minMatch}%
            </span>
          </div>
          <input
            id="filter-min-match"
            data-testid="min-match-slider"
            type="range"
            min={0}
            max={100}
            step={5}
            value={filters.minMatch}
            onChange={(e) => onChange({ minMatch: Number(e.target.value) })}
            className="mt-1 w-full cursor-pointer accent-blue-600"
            aria-label="Coincidencia mínima con tu perfil"
          />
        </div>

        <div>
          <Label className="text-xs text-slate-600">Ordenar por</Label>
          <Select value={filters.sort} onValueChange={(v: string) => onChange({ sort: v as FilterState["sort"] })}>
            <SelectTrigger size="sm" data-testid="filter-sort" className="mt-1 w-full">
              <SelectValue>{filters.sort === "match" ? "Coincidencia" : "Distancia"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="match">Coincidencia</SelectItem>
              <SelectItem value="distancia">Distancia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox
            data-testid="filter-only-active"
            checked={filters.onlyActive}
            onCheckedChange={(v) => onChange({ onlyActive: Boolean(v) })}
          />
          Solo ofertas activas
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox
            data-testid="filter-no-experience"
            checked={filters.noExpOnly}
            onCheckedChange={(v) => onChange({ noExpOnly: Boolean(v) })}
          />
          Aceptan sin experiencia
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <Checkbox
            data-testid="filter-internships"
            checked={filters.internshipsOnly}
            onCheckedChange={(v) => onChange({ internshipsOnly: Boolean(v) })}
          />
          Solo prácticas
        </label>
      </div>
    </div>
  );
}
