import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { List, Map as MapIcon } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import SearchFilters, { DEFAULT_FILTERS, type FilterState } from "@/components/SearchFilters";
import ResultsPanel from "@/components/ResultsPanel";
import MapPanel from "@/components/MapPanel";
import MessageComposer from "@/components/MessageComposer";
import ProfileWizard from "@/components/ProfileWizard";
import {
  apiGet,
  type AppConfig,
  type CompanyResult,
  type OfferWithMatch,
  type SearchResponse,
  type UserProfile,
} from "@/lib/api";
import { getClientId } from "@/lib/client";
import { cn } from "@/lib/utils";

export default function Home() {
  const clientId = getClientId();
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ result: CompanyResult; offer: OfferWithMatch | null } | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const profileQ = useQuery({
    queryKey: ["profile", clientId],
    queryFn: () => apiGet<UserProfile>(`/profile?client_id=${clientId}`),
    retry: false,
    staleTime: 60_000,
  });
  const catalogQ = useQuery({
    queryKey: ["fp-catalog"],
    queryFn: () => apiGet<import("@/lib/api").FpCatalog>("/fp/catalog"),
    staleTime: Infinity,
    retry: false,
  });
  const configQ = useQuery({
    queryKey: ["config"],
    queryFn: () => apiGet<AppConfig>("/config"),
    staleTime: Infinity,
    retry: false,
  });
  const sourcesQ = useQuery({
    queryKey: ["sources"],
    queryFn: () => apiGet<import("@/lib/api").DataSource[]>("/sources"),
    staleTime: Infinity,
    retry: false,
  });

  const profile = profileQ.data ?? null;
  const profileReady = !!profile?.location;

  // Primera visita sin perfil: asistente obligatorio. Un perfil inexistente responde
  // 404 (isError), así que el disparador es isFetched, no isSuccess.
  useEffect(() => {
    if (profileQ.isFetched && !profileReady) setWizardOpen(true);
  }, [profileQ.isFetched, profileReady]);

  // Radio inicial = distancia máxima guardada en el perfil.
  useEffect(() => {
    if (profile) {
      setFilters((f) => ({ ...f, radius: profile.max_distance_km }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const searchQ = useQuery({
    queryKey: ["search", clientId, profile?.location?.lat, profile?.location?.lng, filters],
    queryFn: () => {
      const loc = profile!.location!;
      const params = new URLSearchParams({
        client_id: clientId,
        lat: String(loc.lat),
        lng: String(loc.lng),
        radius_km: String(filters.radius),
        only_active: String(filters.onlyActive),
        no_exp_only: String(filters.noExpOnly),
        internships_only: String(filters.internshipsOnly),
        sort: filters.sort,
      });
      if (filters.sector) params.set("sector", filters.sector);
      if (filters.contract) params.set("contract", filters.contract);
      if (filters.jornada) params.set("jornada", filters.jornada);
      if (filters.minMatch > 0) params.set("min_match", String(filters.minMatch));
      return apiGet<SearchResponse>(`/search?${params.toString()}`);
    },
    enabled: profileReady,
    staleTime: 30_000,
  });

  const results = searchQ.data?.results ?? [];
  const activeOffers = results.reduce((acc, r) => acc + r.offers.filter((o) => o.active).length, 0);

  const openComposer = (
    result: CompanyResult,
    offer: OfferWithMatch | null,
    _tipo: "espontanea" | "responder_oferta"
  ) => {
    setComposer({ result, offer });
  };

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-slate-50">
      <AppHeader
        profile={profile}
        sources={sourcesQ.data}
        sourcesError={sourcesQ.isError}
        onOpenProfile={() => setWizardOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Panel izquierdo: filtros + empresas/ofertas */}
        <aside
          className={cn(
            "w-full flex-col border-r border-slate-200 bg-white md:flex md:w-[460px] md:shrink-0",
            mobileView === "list" ? "flex" : "hidden"
          )}
          data-testid="results-panel"
        >
          <SearchFilters
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            familias={catalogQ.data?.familias ?? []}
            profile={profile}
            resultCount={results.length}
            activeOfferCount={activeOffers}
          />
          <ResultsPanel
            search={searchQ.data}
            isPending={profileReady && searchQ.isPending}
            isError={searchQ.isError}
            onRefetch={() => searchQ.refetch()}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onContact={openComposer}
          />
        </aside>

        {/* Panel derecho: mapa */}
        <main
          className={cn("min-h-0 flex-1 md:block", mobileView === "map" ? "block" : "hidden")}
          data-testid="map-panel"
        >
          <MapPanel
            results={results}
            center={profile?.location ?? null}
            radiusKm={filters.radius}
            selectedId={selectedId}
            onSelect={setSelectedId}
            mapsProvider={configQ.data?.maps_provider ?? "osm"}
            mapsApiKey={configQ.data?.maps_api_key ?? null}
          />
        </main>
      </div>

      {/* Conmutador móvil lista/mapa */}
      <button
        type="button"
        data-testid="mobile-view-toggle"
        onClick={() => setMobileView((v) => (v === "list" ? "map" : "list"))}
        className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 font-medium text-white shadow-xl transition-transform duration-200 hover:scale-105 md:hidden"
        aria-label={mobileView === "list" ? "Ver mapa" : "Ver lista de resultados"}
      >
        {mobileView === "list" ? <MapIcon className="size-4" aria-hidden /> : <List className="size-4" aria-hidden />}
        {mobileView === "list" ? "Ver mapa" : "Ver lista"}
      </button>

      <ProfileWizard
        open={wizardOpen}
        canClose={profileReady}
        onClose={() => setWizardOpen(false)}
        profile={profile}
        catalog={catalogQ.data}
        catalogError={catalogQ.isError}
      />

      <MessageComposer
        open={!!composer}
        onOpenChange={(v) => !v && setComposer(null)}
        context={composer}
        clientId={clientId}
      />
    </div>
  );
}
