"use client";

import React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface ApproximateMapProps {
  center: { lat: number; lng: number };
  radiusKm: number;
  zoom?: number;
}

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

export function ApproximateMap({ center, radiusKm, zoom = 12 }: ApproximateMapProps) {
  const mapRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<L.Map | null>(null);

  React.useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    L.circle([center.lat, center.lng], {
      radius: radiusKm * 1000,
      color: "#dc4b2f",
      fillColor: "#dc4b2f",
      fillOpacity: 0.15,
      weight: 2,
      dashArray: "8, 8",
    }).addTo(map);

    const marker = L.marker([center.lat, center.lng], {
      icon: L.divIcon({
        className: "approximate-marker",
        html: '<div style="width: 24px; height: 24px; border-radius: 50%; background: #dc4b2f; border: 3px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      }),
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [center.lat, center.lng, radiusKm, zoom]);

  return (
    <div
      ref={mapRef}
      className="w-full h-64 rounded-lg border border-[#181713]/20 overflow-hidden"
      role="img"
      aria-label={`Zona aproximada del trabajo: radio de ${radiusKm} km`}
    />
  );
}