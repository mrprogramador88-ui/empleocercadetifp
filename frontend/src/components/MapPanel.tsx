// Panel de mapa. Por defecto usa Leaflet + tiles Carto (OpenStreetMap), sin clave.
// Si el backend indica maps_provider="google" (GOOGLE_MAPS_API_KEY definida en el
// backend), se monta GoogleMapPanel con la misma interfaz de props.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { CompanyResult, UserLocation } from "@/lib/api";
import { matchTier } from "@/lib/format";
import GoogleMapPanel from "@/components/GoogleMapPanel";

const TIER_HEX: Record<string, string> = {
  alta: "#16A34A",
  media: "#D97706",
  general: "#64748B",
};

function pinHtml(color: string, pulse: boolean): string {
  return `
    <div class="company-pin" style="--pin:${color}">
      <span class="pin-dot"></span>
      ${pulse ? '<span class="pin-pulse"></span>' : ""}
    </div>`;
}

export default function MapPanel({
  results,
  center,
  radiusKm,
  selectedId,
  onSelect,
  mapsProvider,
  mapsApiKey,
}: {
  results: CompanyResult[];
  center: UserLocation | null;
  radiusKm: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  mapsProvider: "google" | "osm";
  mapsApiKey: string | null;
}) {
  if (mapsProvider === "google" && mapsApiKey && center) {
    return (
      <GoogleMapPanel
        apiKey={mapsApiKey}
        results={results}
        center={{ lat: center.lat, lng: center.lng }}
        radiusKm={radiusKm}
        selectedId={selectedId}
        onSelect={onSelect}
      />
    );
  }

  return (
    <LeafletMap
      results={results}
      center={center}
      radiusKm={radiusKm}
      selectedId={selectedId}
      onSelect={onSelect}
    />
  );
}

function LeafletMap({
  results,
  center,
  radiusKm,
  selectedId,
  onSelect,
}: {
  results: CompanyResult[];
  center: UserLocation | null;
  radiusKm: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const markerByIdRef = useRef<Map<string, L.Marker>>(new Map());
  const circleRef = useRef<L.Circle | null>(null);
  const userRef = useRef<L.Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Inicialización una sola vez (el cleanup cubre el doble montaje de StrictMode).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [40.4168, -3.7038], zoom: 6, zoomControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      circleRef.current = null;
      userRef.current = null;
    };
  }, []);

  // Usuario + círculo de radio.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    const pos: L.LatLngExpression = [center.lat, center.lng];

    if (!circleRef.current) {
      circleRef.current = L.circle(pos, {
        radius: radiusKm * 1000,
        color: "#2563EB",
        weight: 1.5,
        fillColor: "#2563EB",
        fillOpacity: 0.08,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(pos);
      circleRef.current.setRadius(radiusKm * 1000);
    }

    const userIcon = L.divIcon({
      className: "",
      html: '<div class="user-pin"><span class="user-pin-dot"></span></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });
    if (!userRef.current) {
      userRef.current = L.marker(pos, { icon: userIcon, zIndexOffset: 1000 })
        .addTo(map)
        .bindTooltip("Tu ubicación", { direction: "top" });
      map.setView(pos, map.getZoom() < 8 ? 9 : map.getZoom());
    } else {
      userRef.current.setLatLng(pos);
    }
  }, [center, radiusKm]);

  // Marcadores de empresas.
  useEffect(() => {
    const map = mapRef.current;
    const group = markersRef.current;
    if (!map || !group) return;
    group.clearLayers();
    markerByIdRef.current.clear();

    for (const r of results) {
      const pct = r.offers.find((o) => o.active)?.match_pct ?? r.match.pct;
      const color = TIER_HEX[matchTier(pct)];
      const marker = L.marker([r.company.lat, r.company.lng], {
        icon: L.divIcon({
          className: "",
          html: pinHtml(color, r.has_active_offer),
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
        title: r.company.name,
      }).bindTooltip(
        `<strong>${r.company.name}</strong><br/>${r.company.sector_label} · ${pct}% · ${r.distance_km.toFixed(1).replace(".", ",")} km`,
        { direction: "top", offset: [0, -8] }
      );
      marker.on("click", () => onSelectRef.current(r.company.id));
      marker.addTo(group);
      markerByIdRef.current.set(r.company.id, marker);
    }
  }, [results]);

  // Selección → centrar el mapa (flyTo suave) y abrir el tooltip.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const marker = markerByIdRef.current.get(selectedId);
    if (!marker) return;
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 13), { duration: 1.2 });
    marker.openTooltip();
  }, [selectedId]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" data-testid="map-canvas" aria-label="Mapa de empresas y ofertas" />
      {center && (
        <div
          className="pointer-events-none absolute left-3 top-3 z-[2] rounded-xl border border-slate-200/90 bg-white/90 px-3 py-2 shadow-md backdrop-blur-md"
          data-testid="map-hud"
        >
          <p className="text-xs font-semibold text-slate-800">
            {results.length} empresas · {results.reduce((acc, r) => acc + r.offers.filter((o) => o.active).length, 0)} ofertas activas
          </p>
          <p className="text-[11px] text-slate-500">
            Radio {radiusKm} km desde {center.municipio || center.label.split(",")[0]}
          </p>
        </div>
      )}
    </div>
  );
}
