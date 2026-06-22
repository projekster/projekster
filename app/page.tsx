"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import BatchCard from "./components/BatchCard";
import { supabase } from "./utils/supabase";

// ==========================================
// 1. DYNAMISCHE IMPORT: TACTISCHE RADAR
// ==========================================
const RadarMap = dynamic(() => import("./components/RadarMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] md:h-[500px] bg-slate-900 border border-slate-800 rounded-3xl animate-pulse flex flex-col items-center justify-center shadow-inner">
      <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-amber-500 font-bold tracking-widest uppercase text-xs">Satellietverbinding maken...</p>
    </div>
  ),
});

// ==========================================
// 2. DATAMODEL BLAUWDRUK
// ==========================================
interface Batch {
  id: string; type: string; title: string; maker: string; category: string;
  reserved: number; total: number; days_left: number; price: string;
  image_url?: string; location?: string; unit?: string; lat?: number; lng?: number;
  distance?: number; created_at?: string;
}

const VOEDSEL_FILTERS = ["Alle", "Vlees & Vis", "Zuivel & Eieren", "Groente & Fruit", "Graan & Meel", "Dranken & Conserven", "Honing & Zoet"];
const GRONDSTOF_FILTERS = ["Alle", "Brandhout & Pellets", "Veevoer, Hooi & Stro", "Planten & Zaden", "Mest & Compost", "Levend Vee", "Werktuigen & Machines", "Off-Grid & Energie", "Bouwmateriaal"];

// ==========================================
// TOP 1% CONFIGURATIE: DE INFINITE GRID
// ==========================================
const ITEMS_PER_PAGE = 20;

export default function Home() {
  // --- Data & Flow State ---
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // --- Infinite Grid States ---
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  // --- Filter State ---
  const [activeVoedsel, setActiveVoedsel] = useState("Alle");
  const [activeGrondstof, setActiveGrondstof] = useState("Alle");
  const [searchLocation, setSearchLocation] = useState("");
  
  // --- Geolocatie State ---
  const [isUsingGPS, setIsUsingGPS] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);

  // ==========================================
  // DE DATA MOTOR (TIJD & GPS GECOMBINEERD)
  // ==========================================
  const loadMarketData = useCallback(async (isLoadMore = false, forceGpsCoords: {lat: number, lng: number} | null = null) => {
    const currentPage = isLoadMore ? page + 1 : 0;
    const currentGps = forceGpsCoords || gpsCoords;
    const isGpsActive = !!currentGps;
    
    if (!isLoadMore) setIsLoading(true);
    else setIsLoadingMore(true);
    setError(null);

    try {
      let data, error;
      
      if (isGpsActive && currentGps) {
        // RADAR MODUS (Geolocatie Sortering met Offset/Limit)
        const res = await supabase.rpc('get_batches_with_distance', {
          user_lat: currentGps.lat,
          user_lng: currentGps.lng,
          limit_val: ITEMS_PER_PAGE,
          offset_val: currentPage * ITEMS_PER_PAGE
        });
        data = res.data; error = res.error;
      } else {
        // STANDAARD MODUS (Tijd-gesorteerd via de Automated Reaper view)
        const res = await supabase
          .from("live_market")
          .select("*")
          .order("created_at", { ascending: false })
          .range(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE - 1);
        data = res.data; error = res.error;
      }

      if (error) throw error;
      
      if (data) {
        if (isLoadMore) {
          setBatches(prev => [...prev, ...data]);
        } else {
          setBatches(data);
        }
        
        setHasMore(data.length === ITEMS_PER_PAGE);
        setPage(currentPage);
      }
    } catch (err: any) {
      console.error("Kritieke fout bij ophalen kluis:", err);
      setError("Verbinding met het netwerk verloren. Controleer je signaal.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [page, gpsCoords]);

  useEffect(() => {
    loadMarketData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // ==========================================
  // DE GEOGRAFISCHE RADAR TRIGGER
  // ==========================================
  const toggleGPS = () => {
    if (isUsingGPS) {
      setIsUsingGPS(false);
      setGpsCoords(null);
      loadMarketData(false, null); 
      return;
    }

    if (!navigator.geolocation) {
      alert("Jouw browser of apparaat ondersteunt geen radarfunctionaliteit.");
      return;
    }

    setIsLocating(true);
    setError(null);
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        setGpsCoords(coords);
        setIsUsingGPS(true);
        setIsLocating(false);
        loadMarketData(false, coords);
      },
      (err) => {
        console.error("GPS Database Error:", err);
        alert("Radar toegang geweigerd of time-out. Zorg dat je locatie-rechten aanstaan op dit apparaat.");
        setIsLocating(false);
        setIsUsingGPS(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ==========================================
  // FILTER LOGICA (CLIENT SIDE)
  // ==========================================
  const matchesLocation = (batch: Batch) => {
    if (!searchLocation.trim()) return true;
    return batch.location?.toLowerCase().includes(searchLocation.toLowerCase());
  };

  const voedselBatches = batches.filter(batch => batch.type === "voedsel" && (activeVoedsel === "Alle" || batch.category === activeVoedsel) && matchesLocation(batch));
  const grondstofBatches = batches.filter(batch => batch.type === "grondstof" && (activeGrondstof === "Alle" || batch.category === activeGrondstof) && matchesLocation(batch));

  // ==========================================
  // PREMIUM SKELETON LOADER
  // ==========================================
  const SkeletonGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden h-80 animate-pulse flex flex-col">
          <div className="h-40 bg-slate-800/50 w-full border-b border-slate-800"></div>
          <div className="p-5 space-y-3 flex-grow flex flex-col justify-between">
            <div className="space-y-2"><div className="h-4 bg-slate-800 rounded w-3/4"></div><div className="h-3 bg-slate-800/50 rounded w-1/2"></div></div>
            <div className="h-2 bg-slate-800 rounded w-full mt-auto"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      
      {/* HERO SECTIE */}
      <section className="relative flex flex-col items-center justify-center px-4 pt-24 pb-20 text-center border-b border-slate-900 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-amber-600/5 blur-[140px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl w-full space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter text-white uppercase drop-shadow-2xl">Projekster.</h1>
            <p className="text-xs sm:text-sm md:text-base font-bold text-amber-500 tracking-[0.3em] uppercase">Onafhankelijke Oogst. Vrije Handel.</p>
          </div>
          <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto"></div>
          <p className="text-sm sm:text-base md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed font-light">De directe verbinding tussen vrije producenten en de lokale gemeenschap. Elimineer de tussenlaag. Herwin je waarde.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-sm mx-auto pt-4">
            <a href="#radar" className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-all shadow-lg shadow-amber-900/20 text-center">Verken de Markt</a>
            <Link href="/maak-batch" className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-all hover:border-slate-500 text-center">Zelf Aanbieden</Link>
          </div>
        </div>
      </section>

      {/* TRUST INDICATORS */}
      <div className="w-full border-b border-slate-900 bg-slate-950/50">
        <div className="max-w-[1400px] mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-800/60">
          <div className="px-4 py-2"><p className="text-white font-bold uppercase tracking-wider text-sm mb-1">100% Lokaal</p><p className="text-slate-500 text-xs">Direct van boer of maker in jouw eigen regio.</p></div>
          <div className="px-4 py-2"><p className="text-white font-bold uppercase tracking-wider text-sm mb-1">Direct Contact</p><p className="text-slate-500 text-xs">Geen algoritmes, geen verborgen marges of platformkosten.</p></div>
          <div className="px-4 py-2"><p className="text-white font-bold uppercase tracking-wider text-sm mb-1">Vrij van Fiat</p><p className="text-slate-500 text-xs">Betaal in euro's of ruil soeverein in natura.</p></div>
        </div>
      </div>

      {/* TACTISCHE RADAR SECTIE */}
      <section id="radar" className="w-full bg-slate-950 pt-16 pb-8 border-b border-slate-900">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.8)]"></span> 
                Live Netwerk Radar
              </h2>
              <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-bold">Geolocatie van actieve aanbieders en kluizen</p>
            </div>
          </div>
          <RadarMap batches={batches} />
        </div>
      </section>

      {/* CONTROL PANEL */}
      <div id="aanbod" className="w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-[69px] z-40 shadow-xl">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex flex-col xl:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center justify-between w-full xl:w-auto gap-3 text-slate-400 text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-3"><span className="text-lg">📜</span> Actuele Lijstweergave</div>
            <button onClick={() => loadMarketData(false)} disabled={isLoading || isLocating} className="xl:hidden flex items-center justify-center p-2 bg-slate-900 border border-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors">
              <svg className={`w-4 h-4 ${isLoading && !isLoadingMore ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <button onClick={() => loadMarketData(false)} disabled={isLoading || isLocating} className="hidden xl:flex items-center justify-center p-3 bg-slate-900 border border-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors h-[46px] w-[46px]">
              <svg className={`w-5 h-5 ${isLoading && !isLoadingMore ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>

            <button onClick={toggleGPS} disabled={isLocating} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 h-[46px] rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isUsingGPS ? "bg-amber-600 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)]" : "bg-slate-900 border border-slate-700 text-slate-300 hover:border-amber-500 hover:text-amber-500"}`}>
              {isLocating ? <><span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span> Radar scannen...</> : isUsingGPS ? <><span>📡</span> GPS Actief (Dichtbij)</> : <><span>📍</span> Sorteer op locatie</>}
            </button>

            <div className="relative w-full sm:w-64">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm opacity-50">🔍</span>
              <input type="text" value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} placeholder="Zoek regio..." className="w-full bg-slate-900 border border-slate-800 rounded-xl h-[46px] pl-10 pr-10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/70 transition-colors shadow-inner" />
              {searchLocation && <button onClick={() => setSearchLocation("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white bg-slate-800 hover:bg-slate-700 w-6 h-6 rounded-full flex items-center justify-center transition-colors">✕</button>}
            </div>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-10">
          <div className="w-full bg-red-950/30 border border-red-900/50 rounded-2xl p-6 text-center text-red-400 font-medium text-sm flex items-center justify-center gap-3">
            <span>⚠️</span> {error}
          </div>
        </div>
      )}

      {/* DE MARKTPLAATS RASTERS */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-12 flex-grow w-full space-y-24">
        
        {isLoading && !isLoadingMore ? (
          <div className="space-y-20"><section><SkeletonGrid /></section><section><SkeletonGrid /></section></div>
        ) : !error && (
          <>
            {/* ZUIL 1: DE PROVISIEKAST */}
            <section className="space-y-8">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-900 pb-6">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <span className="text-amber-500 drop-shadow-lg">🌾</span> De Provisiekast
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {VOEDSEL_FILTERS.map(filter => (
                    <button key={filter} onClick={() => setActiveVoedsel(filter)} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 border ${activeVoedsel === filter ? "bg-amber-600 text-white border-amber-500 shadow-lg shadow-amber-900/30" : "bg-slate-900/60 text-slate-400 border-slate-800/80 hover:border-slate-600 hover:text-slate-200"}`}>{filter}</button>
                  ))}
                </div>
              </div>

              {voedselBatches.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 min-h-[150px]">
                  {voedselBatches.map(batch => (
                    <BatchCard key={batch.id} id={batch.id} title={batch.title} maker={batch.maker} reserved={batch.reserved} total={batch.total} category={batch.category} daysLeft={batch.days_left} image_url={batch.image_url} location={batch.location} unit={batch.unit} distance={batch.distance} created_at={batch.created_at} />
                  ))}
                </div>
              ) : (
                // DE NIEUWE PLACEHOLDER UITNODIGING
                <div className="w-full bg-slate-900/10 border border-dashed border-slate-700 rounded-3xl p-16 text-center shadow-inner">
                  <span className="text-6xl mb-6 block drop-shadow-lg grayscale opacity-50">🌾</span>
                  <h3 className="text-white font-black uppercase tracking-widest text-xl mb-3">De kluis is nog in afwachting</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 font-medium">Het ecosysteem is klaar voor je eerste oogst. Wees de pionier in jouw regio en zet de eerste voedsel-batch op de radar.</p>
                  <Link href="/maak-batch" className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-all shadow-lg shadow-amber-900/20 inline-block">
                    + Plaats Eerste Aanbod
                  </Link>
                </div>
              )}
            </section>

            {/* ZUIL 2: HET ERF */}
            <section className="space-y-8">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-900 pb-6">
                <div>
                  <h2 className="text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                    <span className="text-slate-500 drop-shadow-lg">🪵</span> Het Erf
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GRONDSTOF_FILTERS.map(filter => (
                    <button key={filter} onClick={() => setActiveGrondstof(filter)} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 border ${activeGrondstof === filter ? "bg-slate-700 text-white border-slate-500 shadow-lg shadow-slate-900/50" : "bg-slate-900/60 text-slate-400 border-slate-800/80 hover:border-slate-600 hover:text-slate-200"}`}>{filter}</button>
                  ))}
                </div>
              </div>

              {grondstofBatches.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 min-h-[150px]">
                  {grondstofBatches.map(batch => (
                    <BatchCard key={batch.id} id={batch.id} title={batch.title} maker={batch.maker} reserved={batch.reserved} total={batch.total} category={batch.category} daysLeft={batch.days_left} image_url={batch.image_url} location={batch.location} unit={batch.unit} distance={batch.distance} created_at={batch.created_at} />
                  ))}
                </div>
              ) : (
                // DE NIEUWE PLACEHOLDER UITNODIGING
                <div className="w-full bg-slate-900/10 border border-dashed border-slate-700 rounded-3xl p-16 text-center shadow-inner">
                  <span className="text-6xl mb-6 block drop-shadow-lg grayscale opacity-50">🪵</span>
                  <h3 className="text-white font-black uppercase tracking-widest text-xl mb-3">Het erf is leeg</h3>
                  <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 font-medium">Ruim baan voor nieuw materiaal. Plaats het eerste brandhout, werktuig of off-grid materiaal om de markt te openen.</p>
                  <Link href="/maak-batch" className="bg-slate-800 hover:bg-slate-700 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-all shadow-lg shadow-slate-900/50 inline-block border border-slate-600 hover:border-slate-500">
                    + Vul Het Erf
                  </Link>
                </div>
              )}
            </section>

            {/* INFINITE GRID - LOAD MORE BUTTON */}
            {hasMore && (
              <div className="flex justify-center pt-8 border-t border-slate-900">
                <button 
                  onClick={() => loadMarketData(true)}
                  disabled={isLoadingMore}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-500 hover:text-amber-400 font-black uppercase tracking-widest text-xs py-4 px-12 rounded-xl transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <><span className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></span> Netwerk scannen...</>
                  ) : (
                    <><span>📡</span> Laad meer aanbod</>
                  )}
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}