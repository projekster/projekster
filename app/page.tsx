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
    <div className="w-full h-[400px] md:h-[500px] bg-slate-50 border border-slate-200 rounded-3xl animate-pulse flex flex-col items-center justify-center shadow-inner">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-500 font-bold tracking-widest uppercase text-xs">Satellietverbinding maken...</p>
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
  distance?: number; created_at?: string; allows_trade?: boolean; // TOEGEVOEGD VOOR DE NIEUWE UI
}

const VOEDSEL_FILTERS = ["Alle", "Vlees & Vis", "Zuivel & Eieren", "Groente & Fruit", "Graan & Meel", "Dranken & Conserven", "Honing & Zoet"];
const GRONDSTOF_FILTERS = ["Alle", "Brandhout & Pellets", "Veevoer, Hooi & Stro", "Planten & Zaden", "Mest & Compost", "Levend Vee", "Werktuigen & Machines", "Off-Grid & Energie", "Bouwmateriaal"];

const ITEMS_PER_PAGE = 20;

export default function Home() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [activeVoedsel, setActiveVoedsel] = useState("Alle");
  const [activeGrondstof, setActiveGrondstof] = useState("Alle");
  const [searchLocation, setSearchLocation] = useState("");
  
  const [isUsingGPS, setIsUsingGPS] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{lat: number, lng: number} | null>(null);

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
        const res = await supabase.rpc('get_batches_with_distance', {
          user_lat: currentGps.lat,
          user_lng: currentGps.lng,
          limit_val: ITEMS_PER_PAGE,
          offset_val: currentPage * ITEMS_PER_PAGE
        });
        data = res.data; error = res.error;
      } else {
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
      console.error("Kritieke fout bij ophalen handelspost:", err);
      setError("Verbinding met het netwerk verloren. Controleer je signaal.");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [page, gpsCoords]);

  useEffect(() => {
    loadMarketData();
  }, [loadMarketData]); 

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

  const matchesLocation = (batch: Batch) => {
    if (!searchLocation.trim()) return true;
    return batch.location?.toLowerCase().includes(searchLocation.toLowerCase());
  };

  const voedselBatches = batches.filter(batch => batch.type === "voedsel" && (activeVoedsel === "Alle" || batch.category === activeVoedsel) && matchesLocation(batch));
  const grondstofBatches = batches.filter(batch => batch.type === "grondstof" && (activeGrondstof === "Alle" || batch.category === activeGrondstof) && matchesLocation(batch));

  const SkeletonGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-2xl overflow-hidden h-80 animate-pulse flex flex-col shadow-sm">
          <div className="h-40 bg-slate-100 w-full border-b border-slate-100"></div>
          <div className="p-5 space-y-3 flex-grow flex flex-col justify-between">
            <div className="space-y-2"><div className="h-4 bg-slate-200 rounded w-3/4"></div><div className="h-3 bg-slate-100 rounded w-1/2"></div></div>
            <div className="h-2 bg-slate-200 rounded w-full mt-auto"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900">
      
      {/* HERO SECTIE */}
      <section className="relative flex flex-col items-center justify-center px-4 pt-24 pb-20 text-center border-b border-slate-200 bg-white overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-50 via-white to-white pointer-events-none"></div>
        <div className="relative z-10 max-w-4xl w-full space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter text-slate-900 uppercase drop-shadow-sm">Projekster.</h1>
            <p className="text-xs sm:text-sm md:text-base font-bold text-slate-500 tracking-[0.3em] uppercase">Onafhankelijke Oogst. Vrije Handel.</p>
          </div>
          <div className="w-16 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto"></div>
          <p className="text-sm sm:text-base md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-light">De directe verbinding tussen vrije producenten en de lokale gemeenschap. Elimineer de tussenlaag. Herwin je waarde.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-sm mx-auto pt-4">
            <a href="#radar" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-all shadow-lg shadow-slate-900/10 text-center">Verken de Markt</a>
            <Link href="/maak-batch" className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-900 font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-all text-center shadow-sm">Zelf Aanbieden</Link>
          </div>
        </div>
      </section>

      {/* TRUST INDICATORS */}
      <div className="w-full border-b border-slate-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 py-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-slate-100">
          <div className="px-4 py-2"><p className="text-slate-900 font-bold uppercase tracking-wider text-sm mb-1">100% Lokaal</p><p className="text-slate-500 text-xs">Direct van boer of maker in jouw eigen regio.</p></div>
          <div className="px-4 py-2"><p className="text-slate-900 font-bold uppercase tracking-wider text-sm mb-1">Direct Contact</p><p className="text-slate-500 text-xs">Geen algoritmes, geen verborgen marges of platformkosten.</p></div>
          <div className="px-4 py-2"><p className="text-slate-900 font-bold uppercase tracking-wider text-sm mb-1">Vrij van Fiat</p><p className="text-slate-500 text-xs">Betaal in euro's of ruil soeverein in natura.</p></div>
        </div>
      </div>

      {/* TACTISCHE RADAR SECTIE */}
      <section id="radar" className="w-full bg-slate-50 pt-16 pb-8 border-b border-slate-200">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"></span> 
                Live Netwerk Radar
              </h2>
              <p className="text-xs text-slate-500 mt-2 uppercase tracking-widest font-bold">Geolocatie van actieve aanbieders</p>
            </div>
          </div>
          <div className="rounded-3xl overflow-hidden shadow-sm border border-slate-200">
            <RadarMap batches={batches} />
          </div>
        </div>
      </section>

      {/* CONTROL PANEL */}
      <div id="aanbod" className="w-full border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-[69px] z-40 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex flex-col xl:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center justify-between w-full xl:w-auto gap-3 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-3"><span className="text-lg">📜</span> Actuele Lijstweergave</div>
            <button onClick={() => loadMarketData(false)} disabled={isLoading || isLocating} className="xl:hidden flex items-center justify-center p-2 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 rounded-lg transition-colors shadow-sm">
              <svg className={`w-4 h-4 ${isLoading && !isLoadingMore ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
            <button onClick={() => loadMarketData(false)} disabled={isLoading || isLocating} className="hidden xl:flex items-center justify-center p-3 bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors h-[46px] w-[46px] shadow-sm">
              <svg className={`w-5 h-5 ${isLoading && !isLoadingMore ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>

            <button onClick={toggleGPS} disabled={isLocating} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 h-[46px] rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-sm ${isUsingGPS ? "bg-amber-600 text-white border-amber-600" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"}`}>
              {isLocating ? <><span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></span> Radar scannen...</> : isUsingGPS ? <><span>📡</span> GPS Actief (Dichtbij)</> : <><span>📍</span> Sorteer op locatie</>}
            </button>

            <div className="relative w-full sm:w-64">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm opacity-50">🔍</span>
              <input type="text" value={searchLocation} onChange={(e) => setSearchLocation(e.target.value)} placeholder="Zoek regio of dorp..." className="w-full bg-white border border-slate-200 rounded-xl h-[46px] pl-10 pr-10 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm" />
              {searchLocation && <button onClick={() => setSearchLocation("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 w-6 h-6 rounded-full flex items-center justify-center transition-colors">✕</button>}
            </div>
          </div>
        </div>
      </div>

      {/* ERROR STATE */}
      {error && (
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-10">
          <div className="w-full bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600 font-medium text-sm flex items-center justify-center gap-3 shadow-sm">
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
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <span className="text-amber-500">🌾</span> De Provisiekast
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {VOEDSEL_FILTERS.map(filter => (
                    <button key={filter} onClick={() => setActiveVoedsel(filter)} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 border ${activeVoedsel === filter ? "bg-amber-600 text-white border-amber-600 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>{filter}</button>
                  ))}
                </div>
              </div>

              {voedselBatches.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 min-h-[150px]">
                  {voedselBatches.map(batch => (
                    <BatchCard 
                      key={batch.id} 
                      id={batch.id} 
                      title={batch.title} 
                      maker={batch.maker} 
                      reserved={batch.reserved} 
                      total={batch.total} 
                      category={batch.category} 
                      daysLeft={batch.days_left} 
                      image_url={batch.image_url} 
                      location={batch.location} 
                      unit={batch.unit} 
                      distance={batch.distance} 
                      created_at={batch.created_at} 
                      price={batch.price} 
                      allows_trade={batch.allows_trade} 
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-16 text-center">
                  <span className="text-6xl mb-6 block grayscale opacity-30">🌾</span>
                  <h3 className="text-slate-900 font-black uppercase tracking-widest text-xl mb-3">De markt is nog in afwachting</h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto mb-8 font-medium">Het ecosysteem is klaar voor je eerste oogst. Wees de pionier in jouw regio en zet de eerste voedsel-batch op de radar.</p>
                  <Link href="/maak-batch" className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-all shadow-md inline-block">
                    + Plaats Eerste Aanbod
                  </Link>
                </div>
              )}
            </section>

            {/* ZUIL 2: HET ERF */}
            <section className="space-y-8">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 border-b border-slate-200 pb-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <span className="text-slate-400">🪵</span> Het Erf
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {GRONDSTOF_FILTERS.map(filter => (
                    <button key={filter} onClick={() => setActiveGrondstof(filter)} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 border ${activeGrondstof === filter ? "bg-slate-900 text-white border-slate-900 shadow-md" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>{filter}</button>
                  ))}
                </div>
              </div>

              {grondstofBatches.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 min-h-[150px]">
                  {grondstofBatches.map(batch => (
                    <BatchCard 
                      key={batch.id} 
                      id={batch.id} 
                      title={batch.title} 
                      maker={batch.maker} 
                      reserved={batch.reserved} 
                      total={batch.total} 
                      category={batch.category} 
                      daysLeft={batch.days_left} 
                      image_url={batch.image_url} 
                      location={batch.location} 
                      unit={batch.unit} 
                      distance={batch.distance} 
                      created_at={batch.created_at} 
                      price={batch.price} 
                      allows_trade={batch.allows_trade} 
                    />
                  ))}
                </div>
              ) : (
                <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-16 text-center">
                  <span className="text-6xl mb-6 block grayscale opacity-30">🪵</span>
                  <h3 className="text-slate-900 font-black uppercase tracking-widest text-xl mb-3">Het erf is leeg</h3>
                  <p className="text-slate-500 text-sm max-w-md mx-auto mb-8 font-medium">Ruim baan voor nieuw materiaal. Plaats het eerste brandhout, werktuig of off-grid materiaal om de markt te openen.</p>
                  <Link href="/maak-batch" className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs py-4 px-8 rounded-xl transition-all shadow-md inline-block">
                    + Vul Het Erf
                  </Link>
                </div>
              )}
            </section>

            {/* INFINITE GRID - LOAD MORE BUTTON */}
            {hasMore && (
              <div className="flex justify-center pt-8 border-t border-slate-200">
                <button 
                  onClick={() => loadMarketData(true)}
                  disabled={isLoadingMore}
                  className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-black uppercase tracking-widest text-xs py-4 px-12 rounded-xl transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isLoadingMore ? (
                    <><span className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></span> Netwerk scannen...</>
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