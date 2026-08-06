"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapPickerProps {
  value: { lat: number; lng: number } | null;
  onChange: (location: { lat: number; lng: number }) => void;
  radiusKm?: number;
  readonly?: boolean;
}

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];
const DEFAULT_ZOOM = 12;

const iconRetinaUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const iconUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const shadowUrl = "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

const DefaultIcon = L.icon({
  iconRetinaUrl,
  iconUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

export function MapPicker({
  value,
  onChange,
  radiusKm = 3,
  readonly = false,
}: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
      scrollWheelZoom: !readonly,
      dragging: !readonly,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapInstanceRef.current = map;
    setMapReady(true);

    map.on("click", (e: L.LeafletMouseEvent) => {
      if (readonly) return;
      const { lat, lng } = e.latlng;
      updateMarker(lat, lng);
      onChange({ lat, lng });
    });

    if (value) {
      updateMarker(value.lat, value.lng);
      map.setView([value.lat, value.lng], 15);
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [readonly]);

  const updateMarker = (lat: number, lng: number) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { draggable: !readonly }).addTo(map);
      markerRef.current.on("dragend", (e) => {
        const { lat, lng } = e.target.getLatLng();
        onChange({ lat, lng });
      });
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(radiusKm * 1000);
    } else {
      circleRef.current = L.circle([lat, lng], {
        radius: radiusKm * 1000,
        color: "#dc4b2f",
        fillColor: "#dc4b2f",
        fillOpacity: 0.15,
        weight: 2,
        dashArray: "8, 8",
      }).addTo(map);
    }
  };

  useEffect(() => {
    if (value && mapInstanceRef.current) {
      updateMarker(value.lat, value.lng);
      mapInstanceRef.current.setView([value.lat, value.lng], 15);
    }
  }, [value?.lat, value?.lng, radiusKm]);

  return (
    <div
      ref={mapRef}
      className="w-full h-80 rounded-lg border border-[#181713]/20 overflow-hidden"
      role="application"
      aria-label={readonly ? "Ubicación aproximada del trabajo" : "Seleccioná tu ubicación en el mapa"}
    >
      {!mapReady && (
        <div className="w-full h-full flex items-center justify-center bg-[#f3efe6]">
          <span className="text-[#777166]">Cargando mapa…</span>
        </div>
      )}
    </div>
  );
}