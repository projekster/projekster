"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import Link from "next/link";
import { useEffect, useState } from "react";

interface Batch {
  id: string;
  title: string;
  maker: string;
  type: string;
  category: string;
  price: string;
  lat?: number;
  lng?: number;
}

// Top 1% Custom Icons (Gloeiende radar-stippen via CSS/HTML voor Lichte Kaart)
const createCustomIcon = (type: string) => {
  const colorClass = type === "voedsel" ? "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.6)]" : "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.6)]";
  
  return L.divIcon({
    className: "custom-leaflet-icon",
    // We gebruiken hier border-white in plaats van border-slate-900 voor maximaal contrast op de lichte kaart
    html: `<div class="w-4 h-4 rounded-full border-2 border-white ${colorClass} animate-pulse"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

export default function RadarMap({ batches }: { batches: Batch[] }) {
  const mappableBatches = batches.filter(b => b.lat && b.lng);
  
  const defaultCenter: [number, number] = [52.3676, 4.9041]; 
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full h-[400px] md:h-[500px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm relative z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={7} 
        className="w-full h-full bg-slate-50"
        scrollWheelZoom={false}
      >
        {/* De Premium White Cube Kaartlaag (light_all in plaats van dark_all) */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {mappableBatches.map((batch) => (
          <Marker 
            key={batch.id} 
            position={[batch.lat!, batch.lng!]} 
            icon={createCustomIcon(batch.type)}
          >
            <Popup className="premium-popup border-0">
              <div className="p-2 bg-white text-slate-900 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{batch.category}</span>
                <h3 className="font-black text-sm mb-1 mt-1 leading-tight text-slate-900">{batch.title}</h3>
                <p className="text-xs text-amber-600 font-bold mb-4">{batch.price}</p>
                <Link href={`/batch/${batch.id}`} className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold uppercase tracking-widest py-2.5 rounded-lg transition-colors shadow-sm">
                  Bekijk Aanbod
                </Link>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}