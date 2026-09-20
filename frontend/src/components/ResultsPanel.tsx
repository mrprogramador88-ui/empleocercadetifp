import { useEffect } from "react";
import { motion } from "motion/react";
import { AlertTriangle, MapPinOff, RotateCcw, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import CompanyCard from "@/components/CompanyCard";
import type { CompanyResult, OfferWithMatch, SearchResponse } from "@/lib/api";

export default function ResultsPanel({
  search,
  isPending,
  isError,
  onRefetch,
  selectedId,
  onSelect,
  onContact,
}: {
  search: SearchResponse | undefined;
  isPending: boolean;
  isError: boolean;
  onRefetch: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onContact: (result: CompanyResult, offer: OfferWithMatch | null, tipo: "espontanea" | "responder_oferta") => void;
}) {
  // Sincroniza la lista con la selección hecha desde el mapa.
  useEffect(() => {
    if (selectedId) {
      document.getElementById(`company-card-${selectedId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  if (isPending) {
    return (
      <div className="flex-1 space-y-2 overflow-y-auto p-4" data-testid="results-skeleton">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex animate-pulse items-start gap-3 rounded-xl border border-slate-200 p-4">
            <div className="size-[54px] shrink-0 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-200" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
              <div className="h-10 rounded bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center" data-testid="results-error">
        <AlertTriangle className="size-8 text-amber-500" aria-hidden />
        <div>
          <p className="font-medium text-slate-800">No se pudo actualizar la búsqueda</p>
          <p className="mt-1 text-sm text-slate-500">El servidor de búsqueda no responde ahora mismo. Inténtalo de nuevo.</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefetch} data-testid="results-retry-button">
          <RotateCcw className="size-4" aria-hidden />
          Reintentar
        </Button>
      </div>
    );
  }

  if (!search || search.results.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center" data-testid="results-empty">
        <MapPinOff className="size-8 text-slate-300" aria-hidden />
        <div>
          <p className="font-medium text-slate-800">No hay empresas con estos filtros</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-slate-500">
            Prueba a ampliar el radio de búsqueda (control deslizante), quitar filtros de sector o contrato, o baja la coincidencia mínima.
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <SearchX className="size-3.5" aria-hidden />
          Consejo: la mayoría de empresas FP están en núcleos industriales
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto" data-testid="results-list">
      {search.results.map((result, i) => (
        <CompanyCard
          key={result.company.id}
          result={result}
          index={i}
          selected={selectedId === result.company.id}
          onSelect={() => onSelect(result.company.id)}
          onContact={onContact}
        />
      ))}
      {search.truncated && (
        <p className="p-3 text-center text-xs text-slate-400">
          Se muestran las 200 mejores coincidencias; afina los filtros para ver más.
        </p>
      )}
      <motion.footer className="border-t border-slate-200 p-3 text-center text-[11px] leading-relaxed text-slate-400">
        Catálogo de demostración académico sobre municipios reales de España y Europa.
        Conecta una fuente real para obtener empresas y ofertas en vivo.
      </motion.footer>
    </div>
  );
}
