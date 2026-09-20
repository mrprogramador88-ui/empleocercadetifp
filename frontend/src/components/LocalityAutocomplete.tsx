import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { apiGet, type GeocodeHit } from "@/lib/api";
import { Input } from "@/components/ui/input";

// Autocompletado de localidad/dirección/CP contra la geocodificación del backend
// (siempre restringida al país seleccionado, y el backend solo admite países europeos).
export default function LocalityAutocomplete({
  cc,
  value,
  onSelect,
  placeholder,
  testid,
}: {
  cc: string;
  value: string;
  onSelect: (hit: GeocodeHit) => void;
  placeholder?: string;
  testid: string;
}) {
  const [q, setQ] = useState(value);
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => setQ(value), [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (q.trim().length < 3 || q === value) {
      setHits([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await apiGet<GeocodeHit[]>(
          `/geo/geocode?q=${encodeURIComponent(q.trim())}&cc=${cc}`
        );
        setHits(results);
        setOpen(true);
        if (results.length === 0) toast.info("Sin resultados dentro de España y Europa para ese texto");
      } catch {
        setHits([]);
        toast.error("No se pudo geocodificar ahora mismo. Puedes fijar la chincheta en el mapa.");
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, cc]);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <Input
          data-testid={testid}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          placeholder={placeholder ?? "Escribe una dirección, municipio o código postal"}
          className="pl-8 pr-8"
          autoComplete="off"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-slate-400" />}
      </div>
      {open && hits.length > 0 && (
        <ul
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          data-testid={`${testid}-suggestions`}
        >
          {hits.map((hit, i) => (
            <li key={`${hit.lat}-${hit.lng}-${i}`}>
              <button
                type="button"
                data-testid={`${testid}-option-${i}`}
                className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onSelect(hit);
                  setQ(hit.label.split(",").slice(0, 2).join(", "));
                  setOpen(false);
                }}
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
                <span className="line-clamp-2">{hit.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
