import { Database, GraduationCap, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { DataSource, UserProfile } from "@/lib/api";

/** Porcentaje de perfil completado (para el badge del header y el asistente). */
export function profileCompleteness(p: UserProfile | null): number {
  if (!p) return 0;
  const checks = [
    !!p.nombre,
    !!p.grado,
    !!p.familia_id || !!p.titulo_nombre,
    !!p.titulo_id || !!p.titulo_nombre,
    p.skills.length > 0,
    !!p.location,
    p.max_distance_km > 0,
    p.idiomas.length > 0,
    p.carnets.length > 0 || p.certificaciones.length > 0,
    !!p.cv,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function AppHeader({
  profile,
  sources,
  sourcesError,
  onOpenProfile,
}: {
  profile: UserProfile | null;
  sources: DataSource[] | undefined;
  sourcesError: boolean;
  onOpenProfile: () => void;
}) {
  const completeness = profileCompleteness(profile);

  return (
    <header
      className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/85 px-4 shadow-xs backdrop-blur-xl md:px-6"
      data-testid="app-header"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm">
          <MapPinned className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-heading text-lg font-semibold leading-tight tracking-tight text-slate-900">
            Empleo Cerca de Ti
          </h1>
          <p className="truncate text-xs text-slate-500">
            Empleo FP · España y Europa
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="sm" data-testid="sources-button" aria-label="Fuentes de datos de la aplicación">
                <Database className="size-4" aria-hidden />
                <span className="hidden sm:inline">Fuentes</span>
              </Button>
            }
          />
          <PopoverContent align="end" className="w-96" data-testid="sources-popover">
            <div className="space-y-3">
              <div>
                <p className="font-heading text-sm font-semibold text-slate-900">Fuentes de datos activas</p>
                <p className="text-xs text-slate-500">
                  Ámbito restringido a España y Europa. Cada oferta indica su origen.
                </p>
              </div>
              {sourcesError && (
                <p className="text-xs text-slate-500" data-testid="sources-error">
                  No se pudo consultar el estado de las fuentes ahora mismo.
                </p>
              )}
              <ul className="space-y-2" data-testid="sources-list">
                {(sources ?? []).map((s) => (
                  <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-900">{s.nombre}</span>
                      <Badge
                        variant={s.estado === "activo" ? "default" : "outline"}
                        data-testid={`source-badge-${s.id}`}
                        className={s.estado === "activo" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : ""}
                      >
                        {s.estado === "activo" ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.descripcion}</p>
                    {s.requiere.length > 0 && (
                      <p className="mt-1 text-xs text-slate-400">
                        Para activarla: variables de entorno {s.requiere.join(" y ")} en el backend.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </PopoverContent>
        </Popover>

        <Button size="sm" data-testid="open-profile-button" onClick={onOpenProfile}>
          <GraduationCap className="size-4" aria-hidden />
          <span className="hidden sm:inline">Mi perfil FP</span>
          <Badge
            variant="secondary"
            data-testid="profile-completeness-badge"
            className={
              completeness >= 80
                ? "ml-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                : "ml-1 bg-amber-100 text-amber-800 hover:bg-amber-100"
            }
          >
            {completeness}%
          </Badge>
        </Button>
      </div>
    </header>
  );
}
