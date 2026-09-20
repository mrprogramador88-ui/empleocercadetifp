// Google Maps (rama opcional): solo se activa si el backend expone maps_provider="google",
// es decir, si GOOGLE_MAPS_API_KEY está definida en backend/.env. La clave es de uso
// público por diseño (Google Maps JS) y debe restringirse por referente HTTP en Google
// Cloud Console; nunca se usa para otros servicios.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from "react";
import type { CompanyResult } from "@/lib/api";
import { matchTier } from "@/lib/format";

declare global {
  interface Window {
    google?: any;
    __gmapsPromise?: Promise<void>;
  }
}

const TIER_HEX: Record<string, string> = {
  alta: "#16A34A",
  media: "#D97706",
  general: "#64748B",
};

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  if (!window.__gmapsPromise) {
    window.__gmapsPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&language=es&region=ES`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo cargar Google Maps"));
      document.head.appendChild(script);
    });
  }
  return window.__gmapsPromise;
}

export default function GoogleMapPanel({
  apiKey,
  results,
  center,
  radiusKm,
  selectedId,
  onSelect,
}: {
  apiKey: string;
  results: CompanyResult[];
  center: { lat: number; lng: number };
  radiusKm: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const circleRef = useRef<any>(null);
  const userRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        const google = window.google;
        const map = new google.maps.Map(containerRef.current, {
          center,
          zoom: 9,
          disableDefaultUI: false,
        });
        mapRef.current = map;

        circleRef.current = new google.maps.Circle({
          map,
          center,
          radius: radiusKm * 1000,
          strokeColor: "#2563EB",
          strokeWeight: 1.5,
          fillColor: "#2563EB",
          fillOpacity: 0.08,
        });
        userRef.current = new google.maps.Marker({ map, position: center, title: "Tu ubicación" });
      })
      .catch(() => {
        // Sin bloquear la app: el panel muestra el mapa vacío y el HUD sigue operativo.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Marcadores.
  useEffect(() => {
    const google = window.google;
    const map = mapRef.current;
    if (!google || !map) return;
    for (const [, m] of markersRef.current) m.setMap(null);
    markersRef.current.clear();

    for (const r of results) {
      const pct = r.offers.find((o) => o.active)?.match_pct ?? r.match.pct;
      const color = TIER_HEX[matchTier(pct)];
      const marker = new google.maps.Marker({
        map,
        position: { lat: r.company.lat, lng: r.company.lng },
        title: `${r.company.name} — ${pct}%`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: color,
          fillOpacity: 0.95,
          strokeColor: "#FFFFFF",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => onSelectRef.current(r.company.id));
      markersRef.current.set(r.company.id, marker);
    }
  }, [results]);

  // Centro/radio del usuario.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google) return;
    circleRef.current?.setCenter(center);
    circleRef.current?.setRadius(radiusKm * 1000);
    userRef.current?.setPosition(center);
  }, [center, radiusKm]);

  // Selección → recentrar.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedId) return;
    const marker = markersRef.current.get(selectedId);
    if (marker) {
      map.panTo(marker.getPosition());
      map.setZoom(Math.max(map.getZoom(), 13));
    }
  }, [selectedId]);

  return <div ref={containerRef} className="h-full w-full" data-testid="map-canvas-google" aria-label="Mapa de Google con empresas y ofertas" />;
}
