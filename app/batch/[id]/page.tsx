import type { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import Link from "next/link";
import Image from "next/image"; // <-- Compressie Engine
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase";

// ==========================================
// 1. SERVER-SIDE SUPABASE CLIENT (Voor OpenGraph)
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

type Props = {
  params: { id: string }
};

// ==========================================
// 2. DYNAMIC OPENGRAPH GENERATOR (De Virale Motor)
// Wordt aangeroepen door WhatsApp/Telegram/Facebook vóór paginalading
// ==========================================
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  // Haal de specifieke batch op uit de kluis
  const { data: batch } = await supabaseAdmin
    .from('batches')
    .select('title, maker, description, image_url, price, location')
    .eq('id', params.id)
    .single();

  // Als de batch niet bestaat, val terug op veilige standaard
  if (!batch) {
    return {
      title: 'Batch Niet Gevonden | Projekster',
    }
  }

  // Bouw de dynamische wervende tekst
  const dynamicDescription = `${batch.maker} biedt aan uit ${batch.location || 'de regio'}: ${batch.price}. ${batch.description ? batch.description.substring(0, 100) + '...' : 'Bekijk deze Oogst op Projekster.'}`;
  
  // Gebruik de foto van de boer, of val terug op de standaard og-image
  const ogImage = batch.image_url || "/og-image.png";

  return {
    title: `${batch.title} | Projekster`,
    description: dynamicDescription,
    openGraph: {
      title: `${batch.title} - Aangeboden door ${batch.maker}`,
      description: dynamicDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: batch.title,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${batch.title} - Aangeboden door ${batch.maker}`,
      description: dynamicDescription,
      images: [ogImage],
    },
  }
}

// ==========================================
// 3. DE CLIENT-SIDE APPLICATIE (UI & Logica)
// ==========================================
export default function BatchDetail() {
  const params = useParams();
  const router = useRouter();
  
  // UI & Data State
  const [batch, setBatch] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Transactie State
  const [tradeMode, setTradeMode] = useState(false);
  const [reserveMode, setReserveMode] = useState(false);
  const [tradeOffer, setTradeOffer] = useState("");
  const [reserveAmount, setReserveAmount] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // --- DATA OPHALEN ---
  useEffect(() => {
    async function fetchBatch() {
      try {
        const { data, error } = await supabase
          .from("batches")
          .select("*")
          .eq("id", params.id)
          .single();

        if (error) throw error;
        setBatch(data);
      } catch (error) {
        console.error("Fout bij ophalen:", error);
      } finally {
        setIsLoading(false);
      }
    }

    if (params.id) {
      fetchBatch();
    }
  }, [params.id]);

  // --- TRANSACTIE LOGICA ---
  const checkAuthAndProceed = async (mode: "reserve" | "trade") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Je moet een geverifieerd account hebben om te handelen op de Vrije Markt.");
      router.push("/login");
      return;
    }
    
    if (mode === "reserve") setReserveMode(true);
    if (mode === "trade") setTradeMode(true);
  };

  const handleReserve = async () => {
    if (reserveAmount <= 0 || reserveAmount > (batch.total - batch.reserved)) return;
    
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session?.user.id).single();
      const buyerName = profile?.display_name || "Anonieme Koper";

      const { error: orderError } = await supabase.from("orders").insert([{
        batch_id: batch.id,
        buyer_id: session?.user.id,
        buyer_name: buyerName,
        seller_name: batch.maker,
        batch_title: batch.title,
        amount: reserveAmount,
        trade_type: "fiat"
      }]);
      if (orderError) throw orderError;

      const newReserved = batch.reserved + reserveAmount;
      const { error: batchError } = await supabase.from('batches').update({ reserved: newReserved }).eq('id', batch.id);
      if (batchError) throw batchError;

      setBatch({ ...batch, reserved: newReserved });
      setActionSuccess("reserve");
    } catch (error: any) {
      console.error("Reserveringsfout:", error);
      alert("De kluis weigerde de reservering.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTrade = async () => {
    if (!tradeOffer.trim()) return;
    
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session?.user.id).single();
      const buyerName = profile?.display_name || "Anonieme Koper";

      const { error: orderError } = await supabase.from("orders").insert([{
        batch_id: batch.id,
        buyer_id: session?.user.id,
        buyer_name: buyerName,
        seller_name: batch.maker,
        batch_title: batch.title,
        amount: 1, 
        trade_type: "trade",
        trade_offer: tradeOffer
      }]);
      if (orderError) throw orderError;

      setActionSuccess("trade");
    } catch (error) {
      console.error("Fout bij ruilvoorstel:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- SKELETON LOADER ---
  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 md:px-6 py-8 md:py-12 flex justify-center">
        <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-12 gap-10 animate-pulse">
          <div className="lg:col-span-7 space-y-6">
            <div className="w-full h-96 bg-slate-900 rounded-3xl border border-slate-800"></div>
            <div className="h-12 bg-slate-900 rounded-lg w-3/4"></div>
            <div className="h-24 bg-slate-900 rounded-xl w-full"></div>
            <div className="h-32 bg-slate-900 rounded-xl w-full"></div>
          </div>
          <div className="lg:col-span-5">
            <div className="h-[500px] bg-slate-900 rounded-3xl border border-slate-800"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!batch) {
    return (
      <main className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 bg-red-900/20 rounded-full flex items-center justify-center mb-6 border border-red-900/50">
          <span className="text-4xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-black text-white uppercase tracking-widest mb-4">Batch Niet Gevonden</h1>
        <p className="text-slate-400 max-w-md mb-8">Deze oogst of grondstof bestaat niet meer of is verwijderd uit de kluis.</p>
        <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-xl transition-colors">
          Terug naar de markt
        </Link>
      </main>
    );
  }

  const remaining = batch.total - batch.reserved;
  const percentage = Math.min((batch.reserved / batch.total) * 100, 100);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 pb-20 pt-8">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6">
        
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 hover:text-amber-500 transition-colors">
            <span>&larr;</span> Terug naar Actueel Aanbod
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* KOLOM LINKS: VISUALISATIE & CONTEXT */}
          <div className="lg:col-span-7 space-y-8">
            
            <div className="w-full h-72 md:h-[500px] bg-slate-900 rounded-3xl border border-slate-800 relative overflow-hidden flex flex-col items-center justify-center group shadow-2xl">
              {batch.image_url ? (
                <Image 
                  src={batch.image_url} 
                  alt={batch.title} 
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105" 
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/50 to-slate-950"></div>
                  <div className="relative z-10 text-6xl md:text-8xl mb-4 drop-shadow-2xl">
                    {batch.type === 'voedsel' ? '🌾' : '🪵'}
                  </div>
                  <span className="relative z-10 text-slate-500 font-bold tracking-widest uppercase text-sm">Geen visueel bewijs</span>
                </>
              )}

              <div className="absolute top-6 left-6 z-20 flex gap-2">
                <span className="bg-amber-600/90 backdrop-blur-md text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg">
                  {batch.category}
                </span>
                {batch.allows_trade && (
                  <span className="bg-emerald-600/90 backdrop-blur-md text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg flex items-center gap-1">
                    <span>🔄</span> Ruil Toegestaan
                  </span>
                )}
              </div>
            </div>

            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4 tracking-tight">
                {batch.title}
              </h1>

              <div className="flex items-center gap-2 mb-6 text-amber-500">
                <span className="text-xl">📍</span>
                <span className="font-bold tracking-wide">{batch.location || "Locatie in overleg"}</span>
              </div>
              
              <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800/60 backdrop-blur-sm mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-800 rounded-full border-2 border-slate-700 flex items-center justify-center text-2xl shadow-inner">👨‍🌾</div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Aangeboden door</p>
                    <p className="font-black text-xl text-slate-200">{batch.maker}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                      <p className="text-xs text-slate-400 font-medium">Geverifieerde Producent in deze regio</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-8 text-slate-300 leading-relaxed font-light text-lg">
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="text-amber-500">📄</span> Oorsprong & Beschrijving
                  </h3>
                  <p className="text-slate-400 bg-slate-900/20 p-6 rounded-2xl border border-slate-800/30">
                    {batch.description || "Geen verdere beschrijving verstrekt door de maker."}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800/50 flex flex-col">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="text-amber-500">⚖️</span> De Spelregels
                    </h3>
                    <p className="text-sm text-slate-400 flex-grow">{batch.rules || "Handel volgens de algemene erecode van Projekster."}</p>
                  </div>

                  <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800/50 flex flex-col">
                    <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="text-amber-500">🛡️</span> Veiligheid
                    </h3>
                    <p className="text-sm text-slate-400 flex-grow">Je reserveert direct bij de bron. Wij faciliteren de connectie.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KOLOM RECHTS: DE CONVERSIE KLUIS */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-28 bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col gap-8">
              
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Status Voorraad</p>
                    <span className="text-2xl font-black text-amber-500">
                      {batch.reserved} <span className="text-lg text-slate-400">/ {batch.total} <span className="text-sm uppercase tracking-widest font-bold">{batch.unit || "Eenheden"}</span></span>
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Resterend</p>
                    <span className="text-sm font-bold text-white bg-slate-800 px-3 py-1 rounded-md border border-slate-700">
                      ⏳ {batch.days_left} {batch.days_left === 1 ? 'dag' : 'dagen'}
                    </span>
                  </div>
                </div>
                
                <div className="w-full bg-slate-950 rounded-full h-4 overflow-hidden shadow-inner border border-slate-800/80 p-0.5">
                  <div 
                    className="bg-gradient-to-r from-amber-600 to-amber-400 h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden" 
                    style={{ width: `${percentage}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
                
                {remaining <= 0 && (
                  <div className="text-center py-2 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-xs font-bold uppercase tracking-widest">
                    Volledig Uitverkocht
                  </div>
                )}
              </div>

              <div className="py-6 border-y border-slate-800 flex flex-col justify-center items-center text-center bg-slate-950/30 rounded-2xl">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Gevraagde Waarde (Fiat)</p>
                <p className="text-5xl font-black text-white tracking-tighter">{batch.price}</p>
                
                {batch.allows_trade && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-emerald-900/20 border border-emerald-900/50 text-emerald-400 px-4 py-2 rounded-xl text-sm font-medium">
                    <span>🔄</span> Ruilwaarde: {batch.trade_value || "In overleg"}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {actionSuccess === "reserve" ? (
                  <div className="bg-emerald-950/30 border border-emerald-900/50 p-6 rounded-2xl text-center animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-4xl mb-3 block">✅</span>
                    <h3 className="font-bold text-emerald-400 mb-1">Reservering Geplaatst</h3>
                    <p className="text-xs text-slate-400">Jouw claim is succesvol vastgelegd. De maker neemt binnenkort contact op om de levering te bespreken.</p>
                  </div>
                ) : actionSuccess === "trade" ? (
                  <div className="bg-amber-950/30 border border-amber-900/50 p-6 rounded-2xl text-center animate-in fade-in slide-in-from-bottom-2">
                    <span className="text-4xl mb-3 block">🤝</span>
                    <h3 className="font-bold text-amber-500 mb-1">Voorstel Verzonden</h3>
                    <p className="text-xs text-slate-400">Jouw ruilvoorstel ligt nu bij de maker ter overweging.</p>
                  </div>
                ) : remaining <= 0 ? (
                  <button disabled className="w-full bg-slate-800 text-slate-500 font-black uppercase tracking-widest py-5 rounded-xl cursor-not-allowed">
                    Geen Voorraad Meer
                  </button>
                ) : !tradeMode && !reserveMode ? (
                  <>
                    <button 
                      onClick={() => checkAuthAndProceed("reserve")}
                      className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest py-5 rounded-xl transition-all duration-300 shadow-xl shadow-amber-900/20 text-lg flex justify-center items-center gap-3 hover:scale-[1.02]"
                    >
                      <span>💶</span> Reserveer met Fiat
                    </button>
                    
                    {batch.allows_trade && (
                      <button 
                        onClick={() => checkAuthAndProceed("trade")}
                        className="w-full bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold uppercase tracking-widest py-5 rounded-xl border border-slate-700 transition-all duration-300 flex justify-center items-center gap-3 hover:border-slate-500"
                      >
                        <span>📦</span> Ruilvoorstel Doen
                      </button>
                    )}
                  </>
                ) : reserveMode ? (
                  <div className="bg-slate-950 p-6 rounded-2xl border border-amber-600/50 space-y-5 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
                    <div>
                      <h3 className="font-black text-white uppercase tracking-wide text-lg mb-1">Selecteer Aantal</h3>
                      <p className="text-xs text-amber-500 font-medium">Hoeveel {batch.unit || "eenheden"} wil je claimen?</p>
                    </div>
                    
                    <input 
                      type="number" 
                      min="1" 
                      max={remaining}
                      value={reserveAmount}
                      onChange={(e) => setReserveAmount(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white text-2xl font-black text-center focus:outline-none focus:border-amber-500 transition-all"
                    />
                    
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => setReserveMode(false)}
                        className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors text-xs"
                      >
                        Annuleer
                      </button>
                      <button 
                        disabled={isProcessing || reserveAmount < 1 || reserveAmount > remaining}
                        onClick={handleReserve}
                        className="w-2/3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-lg text-sm flex justify-center items-center gap-2"
                      >
                        {isProcessing ? "Verwerken..." : "Bevestig Claim"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-6 rounded-2xl border border-amber-600/50 space-y-4 animate-in fade-in slide-in-from-bottom-4 shadow-2xl">
                    <div>
                      <h3 className="font-black text-white uppercase tracking-wide text-lg mb-1">Jouw Voorstel</h3>
                      <p className="text-xs text-amber-500 font-medium">Beschrijf nauwkeurig wat je ter ruil aanbiedt.</p>
                    </div>
                    
                    <textarea 
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all resize-none"
                      rows={4}
                      value={tradeOffer}
                      onChange={(e) => setTradeOffer(e.target.value)}
                      placeholder={`Bijv: Ik heb nog 2 kuub onbehandeld eikenhout en een kist weckpotten liggen ter ruil...`}
                    ></textarea>
                    
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => { setTradeMode(false); setTradeOffer(""); }}
                        className="w-1/3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors text-xs"
                      >
                        Annuleer
                      </button>
                      <button 
                        disabled={!tradeOffer.trim() || isProcessing}
                        onClick={handleTrade}
                        className="w-2/3 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-lg text-sm flex justify-center items-center"
                      >
                        {isProcessing ? "Verzenden..." : "Verstuur Voorstel"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-500 text-center font-medium mt-2 flex items-center justify-center gap-2">
                <span>🔒</span> Veilige communicatie via de Projekster kluis.
              </p>

            </div>
          </div>

        </div>
      </div>
    </main>
  );
}