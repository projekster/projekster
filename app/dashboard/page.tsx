"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";
import BatchCard from "../components/BatchCard";

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
  created_at?: string; // <-- TOEGEVOEGD: Nodig voor de live timer hack in de BatchCard
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
  status: string;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  
  const [makerName, setMakerName] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  
  // State: Verkoper (Wat ik aanbied & beheer)
  const [myBatches, setMyBatches] = useState<Batch[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
  
  // State: Koper (Wat ik claim bij anderen)
  const [outgoingOrders, setOutgoingOrders] = useState<Order[]>([]);
  
  // State: Trust Matrix (Erecode)
  const [ratedOrderIds, setRatedOrderIds] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"aanbod" | "investeringen">("aanbod");
  
  // State: Veiligheidsmodal
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

      try {
        const { data: profileData } = await supabase.from("profiles").select("display_name").eq("id", session.user.id).single();
        let currentMaker = profileData?.display_name || "";
        
        if (currentMaker) {
          setMakerName(currentMaker);

          // Haal Eigen Voorraad op (Inclusief created_at voor de timer)
          const { data: batchesData } = await supabase.from("batches").select("*").eq("maker", currentMaker).order("created_at", { ascending: false });
          if (batchesData) setMyBatches(batchesData);

          // Haal Inkomende Verzoeken op (Filter Geweigerd eruit)
          const { data: inOrdersData } = await supabase.from("orders").select("*").eq("seller_name", currentMaker).order("created_at", { ascending: false });
          if (inOrdersData) setIncomingOrders(inOrdersData.filter(o => o.status !== "rejected"));

          // Haal Uitgaande Investeringen/Claims op
          const { data: outOrdersData } = await supabase.from("orders").select("*").eq("buyer_id", session.user.id).order("created_at", { ascending: false });
          if (outOrdersData) setOutgoingOrders(outOrdersData.filter(o => o.status !== "rejected"));

          // Haal Gegeven Beoordelingen op
          const { data: ratingsData } = await supabase.from("trust_ratings").select("order_id").eq("reviewer_id", session.user.id);
          if (ratingsData) setRatedOrderIds(ratingsData.map(r => r.order_id));
        }
      } catch (error) { 
        console.error("Fout bij kluis synchronisatie:", error); 
      } finally { 
        setIsLoading(false); 
      }
    }
    fetchDashboardData();
  }, [router]);

  // ==========================================
  // 3. ORDER ENGINE (ACCEPTEER / WEIGER / VOLTOOI)
  // ==========================================
  const handleOrderAction = async (order: Order, action: "accepted" | "rejected" | "completed") => {
    try {
      // Pas de status aan in de database
      await supabase.from("orders").update({ status: action }).eq("id", order.id);

      // Bij Weigering: Geef de voorraad direct terug aan de vrije markt
      if (action === "rejected" && order.trade_type === "fiat") {
        const targetBatch = myBatches.find(b => b.id === order.batch_id);
        if (targetBatch) {
          const newReserved = Math.max(0, targetBatch.reserved - order.amount);
          await supabase.from("batches").update({ reserved: newReserved }).eq("id", targetBatch.id);
          setMyBatches(myBatches.map(b => b.id === targetBatch.id ? { ...b, reserved: newReserved } : b));
        }
      }

      // Bij Voltooiing: PERMANENT BURN - Schrijf de verkochte eenheden definitief af
      if (action === "completed" && order.trade_type === "fiat") {
        const targetBatch = myBatches.find(b => b.id === order.batch_id);
        if (targetBatch) {
          const newReserved = Math.max(0, targetBatch.reserved - order.amount);
          const newTotal = Math.max(0, targetBatch.total - order.amount);
          await supabase.from("batches").update({ reserved: newReserved, total: newTotal }).eq("id", targetBatch.id);
          setMyBatches(myBatches.map(b => b.id === targetBatch.id ? { ...b, reserved: newReserved, total: newTotal } : b));
        }
      }
      
      // Update de UI status
      if (action === "rejected") {
        setIncomingOrders(incomingOrders.filter(o => o.id !== order.id));
      } else {
        setIncomingOrders(incomingOrders.map(o => o.id === order.id ? { ...o, status: action } : o));
      }

      // Routeer direct naar de chat als je accepteert
      if (action === "accepted") {
        router.push(`/inbox/${order.id}`);
      }
    } catch (error) { 
      console.error("Fout bij afhandelen order:", error); 
    }
  };

  // ==========================================
  // 4. SOVEREIGN TRUST MATRIX (ERECODE STEMMEN)
  // ==========================================
  const handleRateTransaction = async (orderId: string, targetName: string, score: number) => {
    try {
      const { error } = await supabase.from("trust_ratings").insert([{
        order_id: orderId,
        reviewer_id: currentUserId,
        target_name: targetName,
        score: score
      }]);
      if (error) throw error;
      
      // Update UI direct zodat knoppen verdwijnen en dubbel-stemmen wordt voorkomen
      setRatedOrderIds([...ratedOrderIds, orderId]);
    } catch (error: any) {
      alert("Systeemfout of je hebt al gestemd op deze transactie.");
    }
  };

  // ==========================================
  // 5. BATCH VERNIETIGING (VAULT LOCK LOGICA)
  // ==========================================
  const executeDelete = async () => {
    if (!batchToDelete) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("batches").delete().eq("id", batchToDelete.id);
      if (error) throw error;
      setMyBatches(myBatches.filter(b => b.id !== batchToDelete.id));
      setBatchToDelete(null);
    } catch (error) { 
      console.error("Fout bij verwijderen:", error); 
    } finally { 
      setIsDeleting(false); 
    }
  };

  // ==========================================
  // RENDER LAADSCHERM
  // ==========================================
  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 uppercase tracking-widest font-black text-xs animate-pulse">
          Kluis synchroniseren met het netwerk...
        </p>
      </main>
    );
  }

  // ==========================================
  // MAIN DASHBOARD RENDER
  // ==========================================
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20 pt-8 relative">
      
      {/* ------------------------------------- */}
      {/* VERWIJDER MODAL (BEVESTIGING)         */}
      {/* ------------------------------------- */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-600 to-red-500"></div>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 text-3xl">⚠️</div>
            <h3 className="text-2xl font-black text-slate-900 text-center uppercase tracking-tight mb-2">Bevestig Vernietiging</h3>
            <p className="text-slate-500 text-center text-sm mb-8 font-medium">Weet je zeker dat je <strong className="text-slate-900">"{batchToDelete.title}"</strong> wilt verwijderen? Dit kan niet ongedaan worden gemaakt.</p>
            <div className="flex gap-3">
              <button disabled={isDeleting} onClick={() => setBatchToDelete(null)} className="w-1/2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold uppercase tracking-widest py-4 rounded-xl transition-colors">Annuleren</button>
              <button disabled={isDeleting} onClick={executeDelete} className="w-1/2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest py-4 rounded-xl shadow-md transition-all">{isDeleting ? "Wissen..." : "Vernietigen"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        
        {/* ------------------------------------- */}
        {/* HEADER & DUAL-ROLE TOGGLE             */}
        {/* ------------------------------------- */}
        <div className="flex flex-col gap-8 mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-2">Mijn Kluis</h1>
              <p className="text-slate-500 flex items-center gap-2 text-sm font-medium">
                <span>🛡️</span> Geverifieerd als: <strong className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{makerName}</strong>
              </p>
            </div>
            <Link href="/maak-batch" className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl transition-all shadow-md text-center inline-block">
              + Nieuwe Oogst Toevoegen
            </Link>
          </div>

          <div className="flex gap-2 border-b border-slate-200 pb-0">
            <button 
              onClick={() => setViewMode("aanbod")} 
              className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "aanbod" ? "text-amber-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Mijn Aanbod (Verkoop)
              {viewMode === "aanbod" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>}
            </button>
            <button 
              onClick={() => setViewMode("investeringen")} 
              className={`px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "investeringen" ? "text-emerald-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              Mijn Claims (Aankoop)
              {viewMode === "investeringen" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>}
            </button>
          </div>
        </div>

        {/* ========================================================== */}
        {/* VIEW 1: AANBOD & VERKOOP (De Maker's Kant)                 */}
        {/* ========================================================== */}
        {viewMode === "aanbod" && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            
            {/* INKOMENDE VERZOEKEN (DE BALIE) */}
            {incomingOrders.length > 0 && (
              <div className="mb-16">
                <div className="border-b border-slate-200 pb-4 mb-6 flex items-center justify-between">
                  <h2 className="text-xl font-black text-amber-600 uppercase tracking-tight flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse"></span> Actieve Orders
                  </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {incomingOrders.map((order) => (
                    <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md relative overflow-hidden transition-all flex flex-col justify-between">
                      <div>
                        <div className={`absolute top-0 left-0 w-1.5 h-full ${order.status === 'completed' ? 'bg-slate-300' : order.status === 'accepted' ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
                        
                        <div className="flex justify-between items-start mb-4">
                          <div className="pl-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                              {order.trade_type === "fiat" ? "💶 Fiat" : "📦 Ruil"} • {order.status === 'completed' ? 'Voltooid' : order.status === 'accepted' ? 'Actief' : 'Nieuw Verzoek'}
                            </p>
                            <h3 className="text-lg font-bold text-slate-900">{order.batch_title}</h3>
                          </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6 ml-2">
                          <p className="text-sm text-slate-600 font-medium">
                            <strong className="text-amber-600">{order.buyer_name}</strong> {order.status === 'completed' ? 'heeft overgenomen:' : 'wil overnemen:'} {order.trade_type === "fiat" ? <span className="font-bold text-slate-900">{order.amount} eenheden</span> : <span className="font-bold text-slate-900">deze batch</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex gap-3 mt-auto pl-2">
                        {order.status === "pending" && (
                          <>
                            <button onClick={() => handleOrderAction(order, "rejected")} className="w-1/3 bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 text-xs font-bold uppercase tracking-widest py-3 rounded-xl border border-slate-200 hover:border-red-200 transition-colors">Weiger</button>
                            <button onClick={() => handleOrderAction(order, "accepted")} className="w-2/3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-widest py-3 rounded-xl shadow-md transition-colors flex justify-center items-center gap-2"><span>🤝</span> Accepteer & Chat</button>
                          </>
                        )}
                        {order.status === "accepted" && (
                          <>
                            <button onClick={() => router.push(`/inbox/${order.id}`)} className="w-1/2 bg-white hover:bg-slate-50 text-slate-700 text-[10px] font-bold uppercase tracking-widest py-3 rounded-xl border border-slate-300 transition-colors shadow-sm">💬 Open Chat</button>
                            <button onClick={() => handleOrderAction(order, "completed")} className="w-1/2 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest py-3 rounded-xl shadow-md transition-colors flex justify-center items-center gap-2"><span>✅</span> Afronden</button>
                          </>
                        )}
                        
                        {/* DE ERECODE MODULE VOOR VERKOPER */}
                        {order.status === "completed" && !ratedOrderIds.includes(order.id) && (
                          <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-center animate-in zoom-in-95">
                            <p className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-widest">Erecode: Beoordeel de Koper</p>
                            <div className="flex gap-2">
                              <button onClick={() => handleRateTransaction(order.id, order.buyer_name, -1)} className="w-1/2 bg-red-50 text-red-600 hover:bg-red-100 font-bold py-2 rounded-lg text-sm border border-red-200 transition-colors shadow-sm">-1 (Onbetrouwbaar)</button>
                              <button onClick={() => handleRateTransaction(order.id, order.buyer_name, 1)} className="w-1/2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-bold py-2 rounded-lg text-sm border border-emerald-200 transition-colors shadow-sm">+1 (Betrouwbaar)</button>
                            </div>
                          </div>
                        )}
                        {order.status === "completed" && ratedOrderIds.includes(order.id) && (
                          <div className="w-full text-center py-2 text-xs text-slate-400 font-bold uppercase tracking-widest">✅ Beoordeling afgegeven</div>
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
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><span>📜</span> Actief op de markt</h2>
              </div>

              {myBatches.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                  {myBatches.map((batch) => (
                    <div key={batch.id} className="relative group h-full">
                      {/* HIER IS DE INJECTIE GEDAAN: created_at={batch.created_at} */}
                      <BatchCard 
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
                      
                      {/* HOVER OVERLAY & VAULT LOCK (WHITE CUBE) */}
                      <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl flex flex-col items-center justify-center p-5 gap-3 border border-slate-200 shadow-inner">
                        <button onClick={() => router.push(`/bewerk-batch/${batch.id}`)} className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl transition-colors shadow-sm">Bewerken</button>
                        
                        {batch.reserved > 0 ? (
                          <div className="w-full text-center group/lock relative">
                            <button disabled className="w-full bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl flex items-center justify-center gap-2"><span>🔒</span> Vergrendeld</button>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-slate-800 text-white text-[10px] font-medium p-3 rounded-lg opacity-0 group-hover/lock:opacity-100 transition-opacity pointer-events-none shadow-xl z-50">
                              Verwijderen geblokkeerd. Handel actieve claims eerst af.
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setBatchToDelete(batch)} className="w-full bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 text-red-600 hover:text-white text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl transition-colors shadow-sm">Verwijderen</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-12 text-center shadow-sm">
                  <span className="text-5xl mb-4 block opacity-40 grayscale">🕸️</span>
                  <h3 className="text-slate-900 font-bold mb-2 text-base uppercase tracking-wide">Je biedt niks aan</h3>
                  <p className="text-slate-500 text-sm mt-2">Activeer een nieuwe batch om zichtbaar te worden op de radar.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW 2: INVESTERINGEN & AANKOOP (De Koper's Kant)          */}
        {/* ========================================================== */}
        {viewMode === "investeringen" && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-300 space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-3"><span>📦</span> Jouw Claims bij Makers</h2>
            </div>

            {outgoingOrders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {outgoingOrders.map(order => (
                  <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-4 border-b border-slate-100 pb-4">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Aanbieder: <span className="text-slate-900">{order.seller_name}</span></p>
                          <h3 className="text-lg font-bold text-emerald-600 leading-tight">{order.batch_title}</h3>
                        </div>
                      </div>
                      
                      <div className="mb-6 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                         <div className="flex justify-between text-sm">
                            <span className="text-slate-500 font-medium">Volume geclaimd:</span>
                            <span className="text-slate-900 font-bold">{order.amount} {order.trade_type === 'fiat' ? 'Stuks/Eenheden' : 'Gehele Oogst'}</span>
                         </div>
                         <div className="flex justify-between text-sm items-center">
                            <span className="text-slate-500 font-medium">Status:</span>
                            {order.status === 'pending' && <span className="text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded text-xs border border-amber-100 animate-pulse">Wachten...</span>}
                            {order.status === 'accepted' && <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded text-xs border border-emerald-100">Geaccepteerd</span>}
                            {order.status === 'rejected' && <span className="text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-xs border border-red-100">Geweigerd</span>}
                            {order.status === 'completed' && <span className="text-slate-500 font-bold bg-slate-200 px-2 py-1 rounded text-xs border border-slate-300">Voltooid</span>}
                         </div>
                      </div>
                    </div>

                    <div className="mt-auto">
                      {order.status === 'accepted' ? (
                        <button onClick={() => router.push(`/inbox/${order.id}`)} className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-all flex justify-center items-center gap-2 shadow-sm">
                          <span>💬</span> Open Chat met Maker
                        </button>
                      ) : order.status === 'pending' ? (
                        <button disabled className="w-full bg-slate-50 border border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl cursor-not-allowed">
                          Kanaal is gesloten
                        </button>
                      ) : order.status === 'rejected' ? (
                         <button onClick={() => router.push(`/batch/${order.batch_id}`)} className="w-full bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-all shadow-sm">
                          Bekijk Originele Batch
                        </button>
                      ) : null}

                      {/* DE ERECODE MODULE VOOR KOPER */}
                      {order.status === 'completed' && !ratedOrderIds.includes(order.id) && (
                        <div className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 text-center mt-3 animate-in zoom-in-95">
                          <p className="text-xs text-slate-500 font-bold mb-3 uppercase tracking-widest">Erecode: Beoordeel de Maker</p>
                          <div className="flex gap-2">
                            <button onClick={() => handleRateTransaction(order.id, order.seller_name, -1)} className="w-1/2 bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 rounded-lg text-sm border border-red-200 transition-colors shadow-sm">-1 (Slecht)</button>
                            <button onClick={() => handleRateTransaction(order.id, order.seller_name, 1)} className="w-1/2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 font-bold py-2.5 rounded-lg text-sm border border-emerald-200 transition-colors shadow-sm">+1 (Top)</button>
                          </div>
                        </div>
                      )}
                      {order.status === 'completed' && ratedOrderIds.includes(order.id) && (
                        <div className="w-full text-center py-2 mt-2 text-xs text-slate-400 font-bold uppercase tracking-widest">✅ Beoordeling afgegeven</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-12 text-center shadow-sm">
                <span className="text-5xl mb-4 block opacity-40 grayscale">🛒</span>
                <h3 className="text-slate-900 font-bold mb-2 text-base uppercase tracking-wide">Geen lopende claims</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">Je hebt nog geen voorraad gereserveerd of geruild op de markt.</p>
                <Link href="/#aanbod" className="text-emerald-700 hover:text-emerald-800 text-xs font-black uppercase tracking-widest border border-emerald-200 hover:border-emerald-300 bg-emerald-50 px-6 py-4 rounded-xl transition-all shadow-sm inline-block">
                  Verken de markt
                </Link>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}