"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../utils/supabase"; 
import Link from "next/link";
import Image from "next/image";

// ==========================================
// DE CLIENT-SIDE APPLICATIE (UI & Kassa Logica)
// ==========================================
export default function BatchDetailClient({ id }: { id: string }) {
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
      if (!id) return; 

      try {
        const { data, error } = await supabase
          .from("batches")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        setBatch(data);
      } catch (error) {
        console.error("Fout bij ophalen:", error);
      } finally {
        setIsLoading(false); 
      }
    }

    fetchBatch();
  }, [id]);

  // --- TRANSACTIE BEVEILIGING ---
  const checkAuthAndProceed = async (mode: "reserve" | "trade") => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Je moet een geverifieerd account hebben om te handelen op de Vrije Markt.");
      router.push("/login");
      return;
    }

    // TOP 1% HACK: Zelf-aankoop Blokkade
    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session.user.id).single();
    if (profile && batch.maker === profile.display_name) {
      alert("Beveiliging: Je kunt niet reserveren of ruilen in je eigen voorraad.");
      return;
    }
    
    if (mode === "reserve") setReserveMode(true);
    if (mode === "trade") setTradeMode(true);
  };

  // --- DE STRIPE KASSA (FIAT) ---
  const handleReserve = async () => {
    if (reserveAmount <= 0 || reserveAmount > (batch.total - batch.reserved)) return;
    
    setIsProcessing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session?.user.id).single();
      const buyerName = profile?.display_name || "Anonieme Koper";

      // TOP 1% ARCHITECTUUR: Stuur de koper naar de onzichtbare Checkout Server
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batch.id,
          buyerId: session?.user.id,
          buyerName: buyerName,
          reserveAmount: reserveAmount
        }),
      });

      const data = await response.json();

      if (data.url) {
        // Lanceer de Stripe iDEAL Betaalomgeving
        window.location.href = data.url; 
      } else {
        throw new Error(data.error || "Fout bij opzetten beveiligde betaling.");
      }

    } catch (error: any) {
      console.error("Betaalfout:", error);
      alert(error.message || "De betaalomgeving kon niet worden geladen. Probeer het opnieuw.");
      setIsProcessing(false); // Zet knop weer vrij als het mislukt
    } 
  };

  // --- NATURA RUILVOORSTEL ---
  const handleTrade = async () => {
    if (!tradeOffer.trim() || reserveAmount <= 0 || reserveAmount > (batch.total - batch.reserved)) return;
    
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
        amount: reserveAmount, // TOP 1% FIX: Natura ruil accepteert nu ook dynamische volumes!
        trade_type: "trade",
        trade_offer: tradeOffer,
        status: "pending" // Gaat de Inbox-flow in als voorstel
      }]);
      if (orderError) throw orderError;

      setActionSuccess("trade");
    } catch (error) {
      console.error("Fout bij ruilvoorstel:", error);
      alert("Er ging iets mis bij het versturen van je ruilvoorstel.");
    } finally {
      setIsProcessing(false);
    }
  };

  // --- SKELETON LOADER (WHITE CUBE) ---
  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 md:px-6 py-8 md:py-12 flex justify-center">
        <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-12 gap-10 animate-pulse">
          <div className="lg:col-span-7 space-y-6">
            <div className="w-full h-96 bg-white border border-slate-200 rounded-3xl shadow-sm"></div>
            <div className="h-12 bg-slate-200 rounded-lg w-3/4"></div>
            <div className="h-24 bg-white border border-slate-200 rounded-xl w-full shadow-sm"></div>
            <div className="h-32 bg-white border border-slate-200 rounded-xl w-full shadow-sm"></div>
          </div>
          <div className="lg:col-span-5">
            <div className="h-[500px] bg-white border border-slate-200 rounded-3xl shadow-lg"></div>
          </div>
        </div>
      </main>
    );
  }

  // --- ERROR STATE ---
  if (!batch) {
    return (
      <main className="min-h-[80vh] bg-slate-50 flex flex-col items-center justify-center text-center px-4">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6 border border-red-100 shadow-sm">
          <span className="text-4xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-black text-slate-900 uppercase tracking-widest mb-4">Aanbod Niet Gevonden</h1>
        <p className="text-slate-500 max-w-md mb-8">Deze oogst of grondstof bestaat niet meer of is verwijderd van de markt.</p>
        <Link href="/#aanbod" className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-8 rounded-xl transition-colors shadow-md">
          Terug naar de markt
        </Link>
      </main>
    );
  }

  const remaining = batch.total - batch.reserved;
  const percentage = Math.min((batch.reserved / batch.total) * 100, 100);

  // ==========================================
  // DE NIEUWE SOVEREIGN WISKUNDE (0% Marge)
  // ==========================================
  const rawPrice = parseFloat(batch.price?.toString().replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
  const subTotal = rawPrice * reserveAmount;
  
  // Enkel de harde Stripe infrastructuurkosten (1.5% + €0.35)
  // Geen winstmarge voor Projekster.
  const infrastructureFee = (subTotal * 0.015) + 0.35; 
  const totalFiat = subTotal + infrastructureFee;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20 pt-8">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6">
        
        {/* BROODKRUIMEL / TERUG */}
        <div className="mb-8">
          <Link href="/#aanbod" className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500 hover:text-amber-600 transition-colors">
            <span>&larr;</span> Terug naar de Markt
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* KOLOM LINKS: VISUALISATIE & CONTEXT */}
          <div className="lg:col-span-7 space-y-8">
            
            {/* AFBEELDING */}
            <div className="w-full h-72 md:h-[500px] bg-slate-100 rounded-3xl border border-slate-200 relative overflow-hidden flex flex-col items-center justify-center group shadow-sm">
              {batch.image_url ? (
                <Image 
                  src={batch.image_url} 
                  alt={batch.title} 
                  fill
                  unoptimized={true} 
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105" 
                />
              ) : (
                <>
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-50 to-slate-100"></div>
                  <div className="relative z-10 text-6xl md:text-8xl mb-4 drop-shadow-sm">
                    {batch.type === 'voedsel' ? '🌾' : '🪵'}
                  </div>
                  <span className="relative z-10 text-slate-400 font-bold tracking-widest uppercase text-sm">Geen visueel bewijs</span>
                </>
              )}

              <div className="absolute top-6 left-6 z-20 flex gap-2">
                <span className="bg-white/95 backdrop-blur-md text-slate-900 border border-slate-200 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
                  {batch.category}
                </span>
                {batch.allows_trade && (
                  <span className="bg-emerald-50 backdrop-blur-md text-emerald-700 border border-emerald-200 text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm flex items-center gap-1">
                    <span>🔄</span> Ruil Toegestaan
                  </span>
                )}
              </div>
            </div>

            {/* TITEL & MAKER */}
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-4 tracking-tight">
                {batch.title}
              </h1>

              <div className="flex items-center gap-2 mb-6 text-amber-600">
                <span className="text-xl">📍</span>
                <span className="font-bold tracking-wide">{batch.location || "Locatie in overleg"}</span>
              </div>
              
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-slate-100 rounded-full border border-slate-200 flex items-center justify-center text-2xl shadow-inner">👨‍🌾</div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-1">Aangeboden door</p>
                    <p className="font-black text-xl text-slate-900">{batch.maker}</p>
                  </div>
                </div>
              </div>

              {/* DETAILS */}
              <div className="space-y-6 text-slate-600 leading-relaxed font-light text-lg">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="text-amber-500">📄</span> Oorsprong & Beschrijving
                  </h3>
                  <p className="text-slate-600 whitespace-pre-wrap">
                    {batch.description || "Geen verdere beschrijving verstrekt door de maker."}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="text-amber-500">⚖️</span> De Spelregels
                    </h3>
                    <p className="text-sm text-slate-600 flex-grow">{batch.rules || "Handel volgens de algemene erecode van Projekster."}</p>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="text-amber-500">🛡️</span> Veiligheid
                    </h3>
                    <p className="text-sm text-slate-600 flex-grow">Je reserveert direct bij de bron. Wij faciliteren de betaling via beveiligde Escrow.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* KOLOM RECHTS: DE CONVERSIE KASSA */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-28 bg-white border border-slate-200 rounded-3xl p-8 shadow-xl flex flex-col gap-8">
              
              {/* STATUS & VOORRAAD */}
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status Voorraad</p>
                    <span className="text-2xl font-black text-amber-600">
                      {batch.reserved} <span className="text-lg text-slate-400">/ {batch.total} <span className="text-sm uppercase tracking-widest font-bold">{batch.unit || "Eenheden"}</span></span>
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Resterend</p>
                    <span className="text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
                      ⏳ {batch.days_left} {batch.days_left === 1 ? 'dag' : 'dagen'}
                    </span>
                  </div>
                </div>
                
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden shadow-inner p-[1px]">
                  <div 
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden" 
                    style={{ width: `${percentage}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                  </div>
                </div>
                
                {remaining <= 0 && (
                  <div className="text-center py-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-bold uppercase tracking-widest">
                    Volledig Uitverkocht
                  </div>
                )}
              </div>

              {/* PRIJS */}
              <div className="py-6 border-y border-slate-100 flex flex-col justify-center items-center text-center bg-slate-50 rounded-2xl">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-2">Gevraagde Waarde (Fiat)</p>
                <p className="text-5xl font-black text-slate-900 tracking-tighter">€{rawPrice.toFixed(2).replace('.', ',')}</p>
                
                {batch.allows_trade && (
                  <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm">
                    <span>🔄</span> Ruilwaarde: {batch.trade_value || "In overleg"}
                  </div>
                )}
              </div>

              {/* ACTIES & FORMULIEREN */}
              <div className="space-y-4">
                {/* SUCCES MELDINGEN */}
                {actionSuccess === "trade" ? (
                  <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl text-center animate-in fade-in slide-in-from-bottom-2 shadow-sm">
                    <span className="text-4xl mb-3 block">🤝</span>
                    <h3 className="font-bold text-amber-800 mb-1">Voorstel Verzonden</h3>
                    <p className="text-xs text-amber-600 font-medium">Jouw ruilvoorstel is verzonden en de maker opent nu een communicatiekanaal met je.</p>
                  </div>
                ) : remaining <= 0 ? (
                  <button disabled className="w-full bg-slate-100 text-slate-400 font-black uppercase tracking-widest py-5 rounded-xl cursor-not-allowed border border-slate-200">
                    Geen Voorraad Meer
                  </button>
                ) : !tradeMode && !reserveMode ? (
                  <>
                    <button 
                      onClick={() => checkAuthAndProceed("reserve")}
                      className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg text-lg flex justify-center items-center gap-3 hover:-translate-y-0.5"
                    >
                      <span>💶</span> Reserveer met Fiat
                    </button>
                    
                    {batch.allows_trade && (
                      <button 
                        onClick={() => checkAuthAndProceed("trade")}
                        className="w-full bg-white hover:bg-slate-50 text-slate-800 font-bold uppercase tracking-widest py-4 rounded-xl border-2 border-slate-200 transition-all duration-300 flex justify-center items-center gap-3 hover:border-slate-300 shadow-sm"
                      >
                        <span>📦</span> Ruilvoorstel Doen
                      </button>
                    )}
                  </>
                ) : reserveMode ? (
                  
                  // DE FIAT KASSA UI
                  <div className="bg-white p-6 rounded-2xl border-2 border-amber-200 space-y-5 animate-in fade-in slide-in-from-bottom-4 shadow-lg">
                    <div>
                      <h3 className="font-black text-slate-900 uppercase tracking-wide text-lg mb-1">Selecteer Aantal</h3>
                      <p className="text-xs text-amber-600 font-medium">Hoeveel {batch.unit || "eenheden"} wil je afnemen?</p>
                    </div>
                    
                    <input 
                      type="number" 
                      min="1" 
                      max={remaining}
                      value={reserveAmount}
                      onChange={(e) => setReserveAmount(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 text-2xl font-black text-center focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all shadow-inner"
                    />
                    
                    {/* DE LIVE WISKUNDE (Transparantie) */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-sm space-y-2 text-slate-600">
                       <div className="flex justify-between">
                         <span>Waarde Goederen ({reserveAmount}x):</span> 
                         <span className="font-bold text-slate-900">€{subTotal.toFixed(2).replace('.', ',')}</span>
                       </div>
                       <div className="flex justify-between text-xs text-slate-500">
                         <span>Projekster Netwerkmarge:</span> 
                         <span>€0,00</span>
                       </div>
                       <div className="flex justify-between text-xs text-slate-400 border-b border-slate-200 pb-2">
                         <span>Externe Kluiskosten (Stripe):</span> 
                         <span>€{infrastructureFee.toFixed(2).replace('.', ',')}</span>
                       </div>
                       <div className="flex justify-between pt-2 font-black text-slate-900">
                         <span>Totaal Afrekenen:</span> 
                         <span>€{totalFiat.toFixed(2).replace('.', ',')}</span>
                       </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => setReserveMode(false)}
                        className="w-1/3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors text-xs"
                      >
                        Annuleer
                      </button>
                      <button 
                        disabled={isProcessing || reserveAmount < 1 || reserveAmount > remaining}
                        onClick={handleReserve}
                        className="w-2/3 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-300 text-white font-bold uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-md text-sm flex justify-center items-center gap-2"
                      >
                        {isProcessing ? "Verwerken..." : "Betaal Veilig"}
                      </button>
                    </div>
                  </div>

                ) : (
                  
                  // DE NATURA RUIL UI
                  <div className="bg-white p-6 rounded-2xl border-2 border-amber-200 space-y-4 animate-in fade-in slide-in-from-bottom-4 shadow-lg">
                    <div>
                      <h3 className="font-black text-slate-900 uppercase tracking-wide text-lg mb-1">Selecteer Aantal</h3>
                      <p className="text-xs text-amber-600 font-medium">Hoeveel {batch.unit || "eenheden"} wil je ruilen?</p>
                    </div>
                    
                    <input 
                      type="number" 
                      min="1" 
                      max={remaining}
                      value={reserveAmount}
                      onChange={(e) => setReserveAmount(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 text-2xl font-black text-center focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all shadow-inner"
                    />

                    <div className="pt-2 border-t border-slate-100">
                      <h3 className="font-black text-slate-900 uppercase tracking-wide text-lg mb-1">Jouw Voorstel</h3>
                      <p className="text-xs text-amber-600 font-medium mb-3">Beschrijf nauwkeurig wat je ter ruil aanbiedt.</p>
                      
                      <textarea 
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl p-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all resize-none shadow-inner"
                        rows={4}
                        value={tradeOffer}
                        onChange={(e) => setTradeOffer(e.target.value)}
                        placeholder={`Bijv: Ik heb nog 2 kuub onbehandeld eikenhout...`}
                      ></textarea>
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <button 
                        onClick={() => { setTradeMode(false); setTradeOffer(""); }}
                        className="w-1/3 bg-white hover:bg-slate-50 text-slate-600 border border-slate-300 font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors text-xs"
                      >
                        Annuleer
                      </button>
                      <button 
                        disabled={!tradeOffer.trim() || isProcessing || reserveAmount < 1 || reserveAmount > remaining}
                        onClick={handleTrade}
                        className="w-2/3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-bold uppercase tracking-wider py-3.5 rounded-xl transition-all shadow-md text-sm flex justify-center items-center"
                      >
                        {isProcessing ? "Verzenden..." : "Verstuur Voorstel"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 text-center font-medium mt-2 flex items-center justify-center gap-2">
                <span>🔒</span> Veilige transacties via Stripe Escrow. Geld wordt vrijgegeven na QR-scan.
              </p>

            </div>
          </div>

        </div>
      </div>
    </main>
  );
}