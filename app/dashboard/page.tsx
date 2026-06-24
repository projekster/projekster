"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";
import BatchCard from "../components/BatchCard";
import QRCode from "react-qr-code"; // De nieuwe QR Motor

// ==========================================
// 1. DATAMODELLEN
// ==========================================
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

interface Order {
  id: string;
  batch_id: string;
  buyer_name: string;
  seller_name: string;
  batch_title: string;
  amount: number;
  trade_type: string;
  trade_offer?: string;
  status: 'pending' | 'accepted' | 'completed' | 'rejected';
  escrow_status?: string; // 'none', 'held', 'released'
  qr_release_code?: string;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  
  const [makerName, setMakerName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  
  // Stripe Status
  const [stripeOnboarded, setStripeOnboarded] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState("");
  const [isConnectingStripe, setIsConnectingStripe] = useState(false);
  
  // Handel States
  const [myBatches, setMyBatches] = useState<Batch[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
  const [outgoingOrders, setOutgoingOrders] = useState<Order[]>([]);
  const [ratedOrderIds, setRatedOrderIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"aanbod" | "investeringen">("aanbod");
  
  // Modals
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [qrOrder, setQrOrder] = useState<Order | null>(null); // Voor de Koper QR weergave

  // ==========================================
  // 2. DATA SYNCHRONISATIE & AUTH
  // ==========================================
  useEffect(() => {
    async function fetchDashboardData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { 
        router.push("/login"); 
        return; 
      }
      
      setCurrentUserId(session.user.id);
      setCurrentUserEmail(session.user.email || "");

      try {
        const { data: profileData } = await supabase.from("profiles").select("display_name, stripe_account_id, stripe_onboarding_complete").eq("id", session.user.id).single();
        let currentMaker = profileData?.display_name || "";
        
        if (currentMaker) {
          setMakerName(currentMaker);
          setStripeOnboarded(profileData?.stripe_onboarding_complete || false);
          setStripeAccountId(profileData?.stripe_account_id || "");

          const { data: batchesData } = await supabase.from("batches").select("*").eq("maker", currentMaker).order("created_at", { ascending: false });
          if (batchesData) setMyBatches(batchesData);

          const { data: inOrdersData } = await supabase.from("orders").select("*").eq("seller_name", currentMaker).order("created_at", { ascending: false });
          if (inOrdersData) setIncomingOrders(inOrdersData.filter(o => o.status !== "rejected"));

          const { data: outOrdersData } = await supabase.from("orders").select("*").eq("buyer_id", session.user.id).order("created_at", { ascending: false });
          if (outOrdersData) setOutgoingOrders(outOrdersData.filter(o => o.seller_name !== currentMaker));

          const { data: ratingsData } = await supabase.from("trust_ratings").select("order_id").eq("reviewer_id", session.user.id);
          if (ratingsData) setRatedOrderIds(ratingsData.map(r => r.order_id));
        }
      } catch (error) { 
        console.error("Fout bij synchronisatie:", error); 
      } finally { 
        setIsLoading(false); 
      }
    }
    fetchDashboardData();
  }, [router]);

  // ==========================================
  // 3. STRIPE ONBOARDING MOTOR
  // ==========================================
  const handleStripeConnect = async () => {
    setIsConnectingStripe(true);
    try {
      const response = await fetch("/api/stripe/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          email: currentUserEmail,
          stripeAccountId: stripeAccountId,
          returnUrl: window.location.origin,
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url; // Stuur boer naar de officiële Stripe Bank omgeving
      } else {
        throw new Error("Geen URL ontvangen van Stripe");
      }
    } catch (error) {
      console.error("Stripe error:", error);
      alert("Er ging iets mis met het opzetten van de bankverbinding. Probeer het later opnieuw.");
      setIsConnectingStripe(false);
    }
  };

  // ==========================================
  // 4. FYSIEKE AFHANDELING (NATURA)
  // ==========================================
  const handleCompleteNaturaTrade = async (order: Order) => {
    if(!confirm("Weet je zeker dat de goederen fysiek zijn overgedragen? Dit sluit de transactie definitief af.")) return;
    
    try {
      await supabase.from("orders").update({ status: "completed" }).eq("id", order.id);
      setIncomingOrders(incomingOrders.map(o => o.id === order.id ? { ...o, status: "completed" } : o));
    } catch (error) {
      console.error("Fout bij afronden Natura ruil:", error);
    }
  };

  const handleOpenChat = (orderId: string) => {
    router.push(`/inbox/${orderId}`);
  };

  // ==========================================
  // 5. ERECODE MATRIX
  // ==========================================
  const handleRateTransaction = async (orderId: string, targetName: string, score: number) => {
    try {
      const { error } = await supabase.from("trust_ratings").insert([{
        order_id: orderId, reviewer_id: currentUserId, target_name: targetName, score: score
      }]);
      if (error) throw error;
      setRatedOrderIds([...ratedOrderIds, orderId]);
    } catch (error: any) {
      alert("Systeemfout of je hebt al gestemd op deze transactie.");
    }
  };

  // ==========================================
  // 6. VOORRAAD VERNIETIGING
  // ==========================================
  const executeDelete = async () => {
    if (!batchToDelete) return;
    setIsDeleting(true);
    try {
      await supabase.from("batches").delete().eq("id", batchToDelete.id);
      setMyBatches(myBatches.filter(b => b.id !== batchToDelete.id));
      setBatchToDelete(null);
    } catch (error) { console.error("Fout bij verwijderen:", error); } 
    finally { setIsDeleting(false); }
  };

  // ==========================================
  // RENDER LAADSCHERM
  // ==========================================
  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 uppercase tracking-widest font-black text-xs animate-pulse">
          Handelspost synchroniseren...
        </p>
      </main>
    );
  }

  // ==========================================
  // MAIN DASHBOARD RENDER
  // ==========================================
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20 pt-8 relative">
      
      {/* --- MODAL: QR CODE KOPER --- */}
      {qrOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-8 shadow-2xl relative flex flex-col items-center">
            <button onClick={() => setQrOrder(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 text-xl font-black">&times;</button>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">Afhaal Bewijs</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8 text-center">{qrOrder.batch_title}</p>
            
            <div className="bg-white p-4 rounded-2xl border-4 border-slate-900 shadow-sm mb-6">
              <QRCode value={qrOrder.qr_release_code || qrOrder.id} size={200} level="H" />
            </div>
            
            <p className="text-center text-sm font-medium text-slate-600 mb-6">
              Laat deze code scannen door <strong className="text-slate-900">{qrOrder.seller_name}</strong> bij het ophalen. Na de scan wordt je betaling definitief vrijgegeven.
            </p>
            <button onClick={() => setQrOrder(null)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest py-4 rounded-xl transition-colors">Sluiten</button>
          </div>
        </div>
      )}

      {/* --- MODAL: VERWIJDER BATCH --- */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 text-3xl">⚠️</div>
            <h3 className="text-2xl font-black text-slate-900 text-center uppercase tracking-tight mb-2">Bevestig Vernietiging</h3>
            <p className="text-slate-500 text-center text-sm mb-8 font-medium">Weet je zeker dat je <strong className="text-slate-900">"{batchToDelete.title}"</strong> wilt verwijderen?</p>
            <div className="flex gap-3">
              <button disabled={isDeleting} onClick={() => setBatchToDelete(null)} className="w-1/2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold uppercase tracking-widest py-4 rounded-xl">Annuleren</button>
              <button disabled={isDeleting} onClick={executeDelete} className="w-1/2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest py-4 rounded-xl shadow-md">{isDeleting ? "Wissen..." : "Vernietigen"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        
        {/* --- HEADER --- */}
        <div className="flex flex-col gap-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-2">Mijn Handel</h1>
              <p className="text-slate-500 flex items-center gap-2 text-sm font-medium">
                <span>🌾</span> Handelaar: <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{makerName}</strong>
              </p>
            </div>
            <Link href="/maak-batch" className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl transition-all shadow-md text-center inline-block">
              + Nieuwe Oogst Toevoegen
            </Link>
          </div>

          <div className="flex gap-2 border-b border-slate-200 pb-0">
            <button onClick={() => setViewMode("aanbod")} className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "aanbod" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"}`}>
              Mijn Aanbod (Verkoop)
              {viewMode === "aanbod" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900"></div>}
            </button>
            <button onClick={() => setViewMode("investeringen")} className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "investeringen" ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}>
              Mijn Reserveringen (Aankoop)
              {viewMode === "investeringen" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-emerald-500"></div>}
            </button>
          </div>
        </div>

        {/* ========================================================== */}
        {/* VIEW 1: MIJN AANBOD (De Maker's Kant)                      */}
        {/* ========================================================== */}
        {viewMode === "aanbod" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            
            {/* STRIPE ONBOARDING BANNER */}
            {myBatches.length > 0 && !stripeOnboarded && (
              <div className="mb-10 bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight mb-2 flex items-center gap-2"><span>🏦</span> Activeer Fiat Betalingen</h3>
                  <p className="text-amber-700 text-sm font-medium leading-relaxed max-w-2xl">
                    Om euro's te kunnen ontvangen van kopers, moet je eenmalig je bankrekening koppelen via onze beveiligde partner Stripe. Zonder koppeling kunnen kopers jouw voorraad niet met fiat reserveren.
                  </p>
                </div>
                <button 
                  onClick={handleStripeConnect} 
                  disabled={isConnectingStripe}
                  className="w-full md:w-auto bg-amber-600 hover:bg-amber-500 disabled:bg-amber-300 text-white font-bold uppercase tracking-widest text-xs px-8 py-4 rounded-xl shadow-md transition-all whitespace-nowrap"
                >
                  {isConnectingStripe ? "Verbinden..." : "Koppel Bankrekening"}
                </button>
              </div>
            )}

            {/* INKOMENDE ORDERS */}
            {incomingOrders.length > 0 && (
              <div className="mb-16">
                <div className="border-b border-slate-200 pb-4 mb-6">
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-slate-900 animate-pulse"></span> Actieve Bestellingen
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {incomingOrders.map((order) => (
                    <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative flex flex-col justify-between">
                      <div className={`absolute top-0 left-0 w-1.5 h-full ${order.status === 'completed' ? 'bg-slate-300' : order.trade_type === 'fiat' ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                      
                      <div className="pl-2 mb-6">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                          {order.trade_type === "fiat" ? "💶 Fiat" : "🔄 Natura"} • {order.status === 'completed' ? 'Afgerond' : order.status === 'accepted' ? 'Akkoord' : 'Nieuw Verzoek'}
                        </p>
                        <h3 className="text-lg font-bold text-slate-900 mb-4">{order.batch_title}</h3>
                        
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <p className="text-sm text-slate-600 font-medium">
                            <strong className="text-slate-900">{order.buyer_name}</strong> {order.status === 'completed' ? 'heeft overgenomen:' : 'wil overnemen:'} <strong className="text-slate-900">{order.amount || 1} eenheden</strong>.
                          </p>
                        </div>
                      </div>

                      {/* LOGICA: Knoppen gebaseerd op Fiat of Natura */}
                      <div className="flex flex-col gap-3 mt-auto pl-2">
                         {/* NATURA FLOW */}
                         {order.trade_type === 'trade' && (order.status === "pending" || order.status === "accepted") && (
                           <div className="flex gap-2">
                             <button onClick={() => handleOpenChat(order.id)} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-colors">💬 Chat</button>
                             {order.status === "accepted" && (
                               <button onClick={() => handleCompleteNaturaTrade(order)} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl shadow-md transition-colors">📦 Markeer als Overhandigd</button>
                             )}
                           </div>
                         )}

                         {/* FIAT FLOW */}
                         {order.trade_type === 'fiat' && order.status !== 'completed' && order.escrow_status !== 'released' && (
                           <div className="flex gap-2">
                              <button onClick={() => handleOpenChat(order.id)} className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-colors">💬 Chat</button>
                              {/* SCAN QR KNOP -> Verwijst later naar de scanner page */}
                              <button onClick={() => router.push(`/scan/${order.id}`)} className="w-2/3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl shadow-md transition-colors flex justify-center items-center gap-2"><span>📷</span> Scan Afhaal-QR</button>
                           </div>
                         )}

                         {/* ERECODE MATRIX (Voor alles wat afgerond is) */}
                         {order.status === "completed" && !ratedOrderIds.includes(order.id) && (
                           <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-center animate-in zoom-in-95 mt-2">
                             <p className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-widest">Erecode: Beoordeel de Koper</p>
                             <div className="flex gap-2">
                               <button onClick={() => handleRateTransaction(order.id, order.buyer_name, -1)} className="w-1/2 bg-red-50 text-red-600 hover:bg-red-100 font-bold py-2 rounded-lg text-sm border border-red-200 transition-colors shadow-sm">-1 (Slecht)</button>
                               <button onClick={() => handleRateTransaction(order.id, order.buyer_name, 1)} className="w-1/2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold py-2 rounded-lg text-sm border border-emerald-200 transition-colors shadow-sm">+1 (Top)</button>
                             </div>
                           </div>
                         )}
                         {order.status === "completed" && ratedOrderIds.includes(order.id) && (
                           <div className="w-full text-center py-2 mt-2 text-xs text-slate-400 font-bold uppercase tracking-widest">✅ Beoordeling verwerkt</div>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* MIJN ACTUELE VOORRAAD */}
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight"><span>📜</span> Mijn Voorraad</h2>
              </div>
              {myBatches.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                  {myBatches.map((batch) => (
                    <div key={batch.id} className="relative group h-full">
                      <BatchCard {...batch} />
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl flex flex-col items-center justify-center p-5 gap-3 border border-slate-200 shadow-inner">
                        <button onClick={() => router.push(`/bewerk-batch/${batch.id}`)} className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl shadow-sm">Bewerken</button>
                        {batch.reserved > 0 ? (
                          <div className="w-full text-center group/lock relative">
                            <button disabled className="w-full bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl"><span>🔒</span> Geblokkeerd</button>
                          </div>
                        ) : (
                          <button onClick={() => setBatchToDelete(batch)} className="w-full bg-red-50 hover:bg-red-600 text-red-600 hover:text-white text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl transition-colors">Verwijderen</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-12 text-center shadow-sm">
                  <h3 className="text-slate-900 font-bold mb-2 text-base uppercase tracking-wide">De schappen zijn leeg</h3>
                  <p className="text-slate-500 text-sm mt-2">Voeg een oogst of product toe om te starten met handelen.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW 2: MIJN RESERVERINGEN (De Koper's Kant)               */}
        {/* ========================================================== */}
        {viewMode === "investeringen" && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight"><span>📦</span> Lopende Reserveringen</h2>
            </div>

            {outgoingOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {outgoingOrders.map(order => (
                  <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm relative flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Bij: <span className="text-slate-900">{order.seller_name}</span></p>
                      <h3 className="text-lg font-bold text-slate-900 mb-4">{order.batch_title}</h3>
                      
                      <div className="mb-6 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                         <div className="flex justify-between text-sm">
                            <span className="text-slate-500 font-medium">Gereserveerd:</span>
                            <span className="text-slate-900 font-bold">{order.amount || 1} {order.trade_type === 'fiat' ? 'Eenheden' : 'Eenheden (Ruil)'}</span>
                         </div>
                         <div className="flex justify-between text-sm items-center">
                            <span className="text-slate-500 font-medium">Status:</span>
                            {order.status === 'pending' && <span className="text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded text-xs border border-amber-100">Wacht op reactie</span>}
                            {order.status === 'accepted' && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded text-xs border border-emerald-100">Geaccepteerd</span>}
                            {order.status === 'completed' && <span className="text-slate-500 font-bold bg-slate-200 px-2 py-1 rounded text-xs border border-slate-300">Afgehandeld</span>}
                         </div>
                      </div>
                    </div>

                    <div className="mt-auto flex flex-col gap-2">
                      {order.status !== 'completed' && (
                        <button onClick={() => router.push(`/inbox/${order.id}`)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-sm">
                          💬 Open Chat
                        </button>
                      )}

                      {/* DE FIAT QR KNOP VOOR DE KOPER */}
                      {order.trade_type === 'fiat' && order.status !== 'completed' && (
                        <button onClick={() => setQrOrder(order)} className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
                          <span>📱</span> Toon Afhaal-QR
                        </button>
                      )}

                      {order.status === 'completed' && !ratedOrderIds.includes(order.id) && (
                        <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-center mt-2">
                          <p className="text-[10px] text-slate-500 font-bold mb-3 uppercase tracking-widest">Erecode: Beoordeel de Maker</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleRateTransaction(order.id, order.seller_name, -1)} className="w-1/2 bg-white text-slate-600 hover:text-red-600 font-bold py-2 rounded-lg text-xs border border-slate-200 shadow-sm">-1</button>
                            <button onClick={() => handleRateTransaction(order.id, order.seller_name, 1)} className="w-1/2 bg-white text-slate-600 hover:text-emerald-600 font-bold py-2 rounded-lg text-xs border border-slate-200 shadow-sm">+1</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-12 text-center shadow-sm">
                <h3 className="text-slate-900 font-bold mb-2 text-base uppercase tracking-wide">Geen actieve reserveringen</h3>
                <Link href="/#aanbod" className="text-slate-600 hover:text-slate-900 text-xs font-black uppercase tracking-widest underline mt-2 inline-block">Verken de markt</Link>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}