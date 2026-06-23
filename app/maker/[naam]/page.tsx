"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../utils/supabase";
import BatchCard from "../../components/BatchCard";

interface Batch {
  id: string;
  type: string;
  title: string;
  maker: string;
  category: string;
  reserved: number;
  total: number;
  days_left: number;
  image_url?: string;
  location?: string;
  unit?: string;
  created_at?: string; 
}

interface MakerProfile {
  display_name: string;
  created_at?: string;
}

export default function MakerProfilePage() {
  const params = useParams();
  const router = useRouter();
  
  // States
  const [profile, setProfile] = useState<MakerProfile | null>(null);
  const [makerBatches, setMakerBatches] = useState<Batch[]>([]);
  const [trustScore, setTrustScore] = useState<number>(0); 
  const [isLoading, setIsLoading] = useState(true);

  // Decodeer de naam uit de URL (vervangt %20 door spaties etc.)
  const decodedNaam = params.naam ? decodeURIComponent(params.naam as string) : "";

  useEffect(() => {
    async function loadMakerEcosystem() {
      if (!decodedNaam) return;

      try {
        // 1. Haal de publieke profielgegevens op
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("display_name, created_at")
          .eq("display_name", decodedNaam)
          .single();

        if (profileError || !profileData) {
          setProfile({ display_name: decodedNaam });
        } else {
          setProfile(profileData);
        }

        // 2. Haal alle actieve batches op via de AUTOMATED REAPER (live_market)
        const { data: batchesData, error: batchesError } = await supabase
          .from("live_market")
          .select("*")
          .eq("maker", decodedNaam)
          .order("created_at", { ascending: false });

        if (batchesError) throw batchesError;
        if (batchesData) setMakerBatches(batchesData);

        // 3. Haal Erecode / Trust Score op
        const { data: trustData } = await supabase
          .from("trust_ratings")
          .select("score")
          .eq("target_name", decodedNaam);
          
        if (trustData) {
          const totalTrust = trustData.reduce((acc, curr) => acc + curr.score, 0);
          setTrustScore(totalTrust);
        }

      } catch (error) {
        console.error("Kritieke fout bij laden profiel-ecosysteem:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadMakerEcosystem();
  }, [decodedNaam]);

  // ==========================================
  // PREMIUM SKELETON LOADER (WHITE CUBE)
  // ==========================================
  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 md:px-6 py-12 flex justify-center">
        <div className="w-full max-w-[1400px] space-y-12 animate-pulse">
          <div className="h-48 bg-white rounded-3xl border border-slate-200 w-full shadow-sm"></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white h-80 rounded-2xl border border-slate-200 shadow-sm"></div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // ERROR STATE (WHITE CUBE)
  // ==========================================
  if (!profile) {
    return (
      <main className="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100 text-3xl shadow-sm">⚠️</div>
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-widest mb-4">Makers-profiel onbekend</h1>
        <Link href="/" className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-md">
          Terug naar de markt
        </Link>
      </main>
    );
  }

  // Bereken overcomplete statistieken voor de vertrouwens-matrix
  const totalActive = makerBatches.length;
  const uniqueLocations = Array.from(new Set(makerBatches.map(b => b.location).filter(Boolean)));
  const primaryLocation = uniqueLocations.length > 0 ? uniqueLocations[0] : "Regio in overleg";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20 pt-8">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        
        {/* Breadcrumb */}
        <div className="mb-8">
          <Link href="/#aanbod" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 hover:text-amber-600 transition-colors">
            <span>&larr;</span> Terug naar alle aanbieders
          </Link>
        </div>

        {/* ======================================= */}
        {/* MAKER HERO BANNER (DE GEOCENTRISCHE KLUIS)*/}
        {/* ======================================= */}
        <section className="bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-sm relative overflow-hidden mb-16 animate-in fade-in slide-in-from-top-4 duration-500">
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            
            {/* Linkerkant: Naam en Regio */}
            <div className="flex items-center gap-5 md:gap-6">
              <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center text-4xl shadow-inner select-none">
                👨‍🌾
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tight">
                    {profile.display_name}
                  </h1>
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-md flex items-center gap-1.5 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Sovereign Producer
                  </span>
                </div>
                
                <p className="text-slate-500 font-medium text-sm flex items-center gap-2">
                  <span className="text-amber-600 text-base">📍</span> Operationele basis: <strong className="text-slate-900">{primaryLocation}</strong>
                </p>
              </div>
            </div>

            {/* Rechterkant: Onafhankelijke Statistieken (De Reputatie-Matrix) */}
            <div className="grid grid-cols-2 gap-4 border-t md:border-t-0 md:border-l border-slate-100 pt-6 md:pt-0 md:pl-10 text-left min-w-[250px]">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Actief Aanbod</p>
                <p className="text-2xl font-black text-slate-900">{totalActive} <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Batches</span></p>
              </div>
              <div>
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                  <span>✦</span> Erecode Score
                </p>
                <p className={`text-2xl font-black uppercase tracking-tight text-sm md:text-base flex items-center gap-1.5 pt-1 ${trustScore >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {trustScore > 0 ? `+${trustScore}` : trustScore} Punten
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* ======================================= */}
        {/* DE ETALAGE: ACTUEEL CURRICULUM          */}
        {/* ======================================= */}
        <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
              <span>📦</span> Actuele Productie-Kluis
            </h2>
            <span className="text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-widest bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm">
              Direct leverbaar vanaf het erf
            </span>
          </div>

          {makerBatches.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {makerBatches.map((batch) => (
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
                  created_at={batch.created_at} 
                />
              ))}
            </div>
          ) : (
            // Empty State (Licht, luchtig, professioneel)
            <div className="w-full bg-white border border-dashed border-slate-300 rounded-3xl p-16 text-center flex flex-col items-center justify-center shadow-sm">
              <span className="text-5xl mb-4 opacity-30 grayscale">🌾</span>
              <h3 className="text-slate-900 font-bold mb-1 text-sm uppercase tracking-wide">Ecosysteem tijdelijk in rust</h3>
              <p className="text-slate-500 text-xs max-w-xs mx-auto">Deze maker heeft op dit moment al zijn voorraad succesvol verhandeld of gecleard. Houd de radar in de gaten voor nieuwe oogst-cycli.</p>
            </div>
          )}
        </section>

      </div>
    </main>
  );
}