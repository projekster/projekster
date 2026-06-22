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

// Top 1% Custom Icons (Gloeiende radar-stippen via CSS/HTML)
const createCustomIcon = (type: string) => {
  const colorClass = type === "voedsel" ? "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)]" : "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)]";
  
  return L.divIcon({
    className: "custom-leaflet-icon",
    html: `<div class="w-4 h-4 rounded-full border-2 border-slate-900 ${colorClass} animate-pulse"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

export default function RadarMap({ batches }: { batches: Batch[] }) {
  // Filter alleen de batches die daadwerkelijk geografische coördinaten hebben
  const mappableBatches = batches.filter(b => b.lat && b.lng);
  
  // Standaard centrum (Nederland). Als er batches zijn, centreren we later dynamisch of we laten dit als breed overzicht.
  const defaultCenter: [number, number] = [52.3676, 4.9041]; 
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full h-[400px] md:h-[500px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative z-0">
      <MapContainer 
        center={defaultCenter} 
        zoom={7} 
        className="w-full h-full bg-slate-950"
        scrollWheelZoom={false} // Voorkomt dat de hele pagina vastloopt als je scrolt
      >
        {/* De Premium Dark Mode Kaartlaag */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {mappableBatches.map((batch) => (
          <Marker 
            key={batch.id} 
            position={[batch.lat!, batch.lng!]} 
            icon={createCustomIcon(batch.type)}
          >
            <Popup className="premium-popup">
              <div className="p-1 bg-slate-900 text-white rounded-lg">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{batch.category}</span>
                <h3 className="font-black text-sm mb-1 mt-0.5 leading-tight">{batch.title}</h3>
                <p className="text-xs text-amber-500 font-bold mb-3">{batch.price}</p>
                <Link href={`/batch/${batch.id}`} className="block w-full text-center bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold uppercase tracking-widest py-2 rounded transition-colors">
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