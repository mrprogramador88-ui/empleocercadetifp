import { useState } from "react";
import { motion } from "motion/react";
import {
  Briefcase,
  Building2,
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  GraduationCap,
  Info,
  Mail,
  MapPin,
  Phone,
  Sparkles,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import MatchBadge from "@/components/MatchBadge";
import {
  CONTRACT_LABELS,
  JORNADA_LABELS,
  TIER_COLORS,
  fmtDistance,
  matchTier,
  tiempoRelativo,
} from "@/lib/format";
import type { CompanyResult, OfferWithMatch } from "@/lib/api";

const SOURCE_LABELS: Record<string, string> = {
  catalogo_demo: "Catálogo de demostración académico",
  adzuna: "Adzuna (API externa)",
};

export default function CompanyCard({
  result,
  selected,
  onSelect,
  onContact,
  index,
}: {
  result: CompanyResult;
  selected: boolean;
  onSelect: () => void;
  onContact: (result: CompanyResult, offer: OfferWithMatch | null, tipo: "espontanea" | "responder_oferta") => void;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { company, distance_km, offers } = result;
  const best = offers.find((o) => o.active) ?? offers[0] ?? null;
  const pct = best ? best.match_pct : result.match.pct;
  const tier = matchTier(pct);

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.3), ease: "easeOut" }}
      className={`group relative border-b border-slate-200 transition-colors last:border-b-0 ${
        selected ? "bg-blue-50/60" : "bg-white hover:bg-slate-50/80"
      }`}
      data-testid={`company-card-${company.id}`}
      data-selected={selected || undefined}
    >
      {selected && <span className="absolute inset-y-0 left-0 w-1 bg-blue-600" aria-hidden />}
      <div
        className="cursor-pointer p-4 pb-2"
        onClick={onSelect}
        data-testid={`company-card-${company.id}-select`}
        role="button"
        aria-label={`Seleccionar ${company.name} en el mapa`}
      >
        <div className="flex items-start gap-3">
          <MatchBadge pct={pct} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-heading text-[15px] font-semibold leading-snug text-slate-900">
              {company.name}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" aria-hidden />
                {company.city}
                {company.province ? `, ${company.province}` : ""} · {fmtDistance(distance_km)}
              </span>
            </p>
            <p className="mt-0.5 truncate text-xs text-slate-500">{company.sector_label}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-[10px] text-indigo-800">
                Datos de demostración
              </Badge>
              {best?.active && (
                <Badge className="bg-emerald-100 text-[10px] text-emerald-800 hover:bg-emerald-100" data-testid={`company-card-${company.id}-active-offer`}>
                  Oferta activa
                </Badge>
              )}
              {best?.is_internship && (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-800">
                  Prácticas FCT/Dual
                </Badge>
              )}
              {best?.first_job_friendly && !best?.is_internship && (
                <Badge variant="outline" className="border-teal-200 bg-teal-50 text-[10px] text-teal-800">
                  Primer empleo
                </Badge>
              )}
              {best?.contract_type === "indefinido" && (
                <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-700">
                  Indefinido
                </Badge>
              )}
              {company.country_code !== "es" && (
                <Badge variant="outline" className="border-slate-300 text-[10px] text-slate-700">
                  {company.country}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {best ? (
          <div className="mt-2 ml-[66px] rounded-lg border border-slate-200 bg-slate-50/70 p-2.5" data-testid={`company-card-${company.id}-best-offer`}>
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-slate-800">
              <Briefcase className="size-3.5 shrink-0 text-blue-700" aria-hidden />
              {best.title}
            </p>
            <p className="mt-0.5 flex items-center gap-2 pl-5 text-[11px] text-slate-500">
              <span>{CONTRACT_LABELS[best.contract_type] ?? best.contract_type}</span>
              <span aria-hidden>·</span>
              <span>{JORNADA_LABELS[best.jornada] ?? best.jornada}</span>
              {best.active ? (
                <span className="ml-auto inline-flex items-center gap-1 text-emerald-700">
                  <Clock className="size-3" aria-hidden />
                  {tiempoRelativo(best.published_at)}
                </span>
              ) : (
                <span className="ml-auto text-slate-400">Cerrada</span>
              )}
            </p>
          </div>
        ) : (
          <p className="mt-2 ml-[66px] text-[12px] italic text-slate-500">
            Sin ofertas activas ahora mismo — empresa receptora de candidaturas espontáneas.
          </p>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-3 pb-3 pl-[66px]">
        <Button variant="ghost" size="xs" data-testid={`company-card-${company.id}-expand`} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Ocultar detalle" : "Ver detalle"}
          <ChevronDown className={`size-3.5 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          data-testid={`company-card-${company.id}-contact`}
          onClick={() => onContact(result, best, best ? "responder_oferta" : "espontanea")}
          className="text-blue-700 hover:bg-blue-50 hover:text-blue-800"
        >
          <Sparkles className="size-3.5" aria-hidden />
          Contactar
        </Button>
        <span
          className="ml-auto inline-flex items-center gap-1 font-mono text-[11px] font-semibold"
          style={{ color: TIER_COLORS[tier].fg }}
          data-testid={`company-card-${company.id}-pct`}
        >
          {pct}% coincidencia
        </span>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-4 pl-[66px]" data-testid={`company-card-${company.id}-detail`}>
          {/* Desglose del motor de coincidencia */}
          <section aria-label="Desglose de la coincidencia">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Afinidad con tu perfil</h4>
            <ul className="mt-2 space-y-1.5">
              {result.match.factores.map((f) => (
                <li key={f.factor} className="flex items-center gap-2 text-[11px] text-slate-600">
                  <span className="w-44 shrink-0 truncate" title={f.label}>
                    {f.label} ({f.peso}%)
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                    <span
                      className="block h-full rounded-full bg-blue-600 transition-all duration-500"
                      style={{ width: `${f.score}%` }}
                    />
                  </span>
                  <span className="w-8 text-right font-mono">{f.score}</span>
                </li>
              ))}
            </ul>
            <ul className="mt-2 space-y-1">
              {result.match.razones.slice(0, 4).map((r, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[12px] text-slate-600">
                  <Check className="mt-0.5 size-3 shrink-0 text-emerald-600" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          </section>

          {/* Sobre la empresa */}
          <section className="mt-3" aria-label="Sobre la empresa">
            <h4 className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">
              <Building2 className="size-3" aria-hidden />
              Sobre la empresa
            </h4>
            <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{company.description || "Actividad no disponible en la fuente."}</p>
            <dl className="mt-2 space-y-1 text-[12px]">
              <div className="flex gap-1.5" data-testid={`company-card-${company.id}-contact-info`}>
                <dt className="flex items-center gap-1 text-slate-500">
                  <Mail className="size-3" aria-hidden /> Correo:
                </dt>
                <dd className={company.email ? "text-slate-800" : "italic text-slate-400"}>
                  {company.email ?? "No disponible en la fuente de demostración"}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="flex items-center gap-1 text-slate-500">
                  <Phone className="size-3" aria-hidden /> Teléfono:
                </dt>
                <dd className={company.phone ? "text-slate-800" : "italic text-slate-400"}>
                  {company.phone ?? "No disponible en la fuente de demostración"}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt className="flex items-center gap-1 text-slate-500">
                  <Globe className="size-3" aria-hidden /> Web:
                </dt>
                <dd className={company.website ? "text-slate-800" : "italic text-slate-400"}>
                  {company.website ?? "No disponible en la fuente de demostración"}
                </dd>
              </div>
            </dl>
          </section>

          {/* Ofertas de la empresa */}
          {offers.length > 0 && (
            <section className="mt-3" aria-label="Ofertas de la empresa">
              <h4 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Ofertas ({offers.length})
              </h4>
              <ul className="mt-2 space-y-2">
                {offers.map((o) => (
                  <li key={o.id} className="rounded-lg border border-slate-200 bg-white p-2.5" data-testid={`offer-item-${o.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-slate-800">{o.title}</p>
                      <span className="font-mono text-[11px] font-semibold text-blue-700">{o.match_pct}%</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {CONTRACT_LABELS[o.contract_type] ?? o.contract_type} · {JORNADA_LABELS[o.jornada] ?? o.jornada} ·{" "}
                      {o.min_experience_years === 0 ? "Sin experiencia requerida" : `${o.min_experience_years} años de experiencia`}
                    </p>
                    {o.skills.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {o.skills.map((s) => (
                          <Badge key={s} variant="secondary" className="text-[10px]">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {o.description && <p className="mt-1.5 text-[12px] leading-relaxed text-slate-600">{o.description}</p>}
                    <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500">
                      <Info className="size-3" aria-hidden />
                      Fuente: {SOURCE_LABELS[o.source] ?? o.source}
                      {o.source_url ? (
                        <a href={o.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-700 underline" data-testid={`offer-${o.id}-link`}>
                          Ver oferta original
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ) : (
                        <span className="italic text-slate-400">· sin enlace externo</span>
                      )}
                    </p>
                    <div className="mt-2">
                      <Button
                        size="xs"
                        variant="outline"
                        data-testid={`offer-${o.id}-message`}
                        onClick={() => onContact(result, o, "responder_oferta")}
                      >
                        <Sparkles className="size-3.5" aria-hidden />
                        Generar mensaje para esta oferta
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-3 flex items-start gap-1.5 rounded-md bg-indigo-50/60 p-2 text-[11px] leading-relaxed text-indigo-900">
            <GraduationCap className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Los datos de contacto se completarán automáticamente al conectar una fuente real de empresas u ofertas.
          </p>
        </div>
      )}
    </motion.article>
  );
}
