"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";
import BatchCard from "../components/BatchCard";
import QRCode from "react-qr-code";

// ==========================================
// 1. DATAMODELLEN
// ==========================================
interface Batch {
  id: string; type: string; title: string; maker: string; category: string;
  reserved: number; total: number; days_left: number; price?: string;
  allows_trade?: boolean; image_url?: string; location?: string;
  unit?: string; created_at?: string;
}

interface Order {
  id: string; batch_id: string; buyer_name: string; seller_name: string;
  batch_title: string; amount: number; trade_type: string; trade_offer?: string;
  status: 'pending' | 'accepted' | 'completed' | 'rejected' | 'disputed' | 'cancelled';
  escrow_status?: string; qr_release_code?: string; created_at: string;
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
  const [isLoggingInStripe, setIsLoggingInStripe] = useState(false);
  
  // Handel States
  const [myBatches, setMyBatches] = useState<Batch[]>([]);
  const [incomingOrders, setIncomingOrders] = useState<Order[]>([]);
  const [outgoingOrders, setOutgoingOrders] = useState<Order[]>([]);

  // Notificatie Voorkeuren
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  // De Nieuwe 5-Zuil Navigatie
  const [viewMode, setViewMode] = useState<"actie" | "lopend" | "voorraad" | "archief" | "instellingen">("actie");
  
  // Modals
  const [batchToDelete, setBatchToDelete] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [qrOrder, setQrOrder] = useState<Order | null>(null);

  // ==========================================
  // 2. DATA SYNCHRONISATIE
  // ==========================================
  useEffect(() => {
    async function fetchDashboardData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      
      setCurrentUserId(session.user.id);
      setCurrentUserEmail(session.user.email || "");

      try {
        const { data: profileData } = await supabase.from("profiles")
          .select("display_name, stripe_account_id, stripe_onboarding_complete, email_alerts, push_alerts")
          .eq("id", session.user.id).single();
          
        let currentMaker = profileData?.display_name || "";
        
        if (currentMaker) {
          setMakerName(currentMaker);
          setStripeOnboarded(profileData?.stripe_onboarding_complete || false);
          setStripeAccountId(profileData?.stripe_account_id || "");
          if (profileData?.email_alerts !== undefined) setEmailAlerts(profileData.email_alerts);
          if (profileData?.push_alerts !== undefined) setPushAlerts(profileData.push_alerts);

          const { data: batchesData } = await supabase.from("batches").select("*").eq("maker", currentMaker).order("created_at", { ascending: false });
          if (batchesData) setMyBatches(batchesData);

          const { data: inOrdersData } = await supabase.from("orders").select("*").eq("seller_name", currentMaker).order("created_at", { ascending: false });
          if (inOrdersData) setIncomingOrders(inOrdersData);

          const { data: outOrdersData } = await supabase.from("orders").select("*").eq("buyer_id", session.user.id).order("created_at", { ascending: false });
          if (outOrdersData) setOutgoingOrders(outOrdersData);

          // Verificatie Check (Terugkomst van Stripe KYC)
          const searchParams = new URLSearchParams(window.location.search);
          const activeStripeId = profileData?.stripe_account_id || "";
          if (searchParams.get("onboarding") === "success" && activeStripeId) {
             setViewMode("instellingen"); 
             fetch("/api/stripe/verify", {
               method: "POST", headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ accountId: activeStripeId, userId: session.user.id })
             }).then(res => res.json()).then(verifyData => {
               if (verifyData.success) { setStripeOnboarded(true); router.replace('/dashboard'); } 
               else { alert("KYC incompleet."); router.replace('/dashboard'); }
             }).catch(err => console.error("Verificatie fout:", err));
          }
        }
      } catch (error) { console.error("Fout bij synchronisatie:", error); } 
      finally { setIsLoading(false); }
    }
    fetchDashboardData();
  }, [router]);

  // ==========================================
  // 3. SLIMME FILTER LOGICA (De 4 Tabbladen)
  // ==========================================
  
  // TAB 1: ACTIE VEREIST
  const actionRequiredIn = incomingOrders.filter(o => o.trade_type === 'trade' && o.status === 'pending');
  const actionRequiredOut = outgoingOrders.filter(o => o.trade_type === 'trade' && o.status === 'pending');
  const totalActions = actionRequiredIn.length;

  // TAB 2: LOPENDE ZAKEN (Klaar voor overdracht met QR)
  const ongoingIn = incomingOrders.filter(o => (o.trade_type === 'fiat' && o.escrow_status === 'held') || (o.trade_type === 'trade' && o.status === 'accepted'));
  const ongoingOut = outgoingOrders.filter(o => (o.trade_type === 'fiat' && o.escrow_status === 'held') || (o.trade_type === 'trade' && o.status === 'accepted'));
  const totalOngoing = ongoingIn.length + ongoingOut.length;

  // TAB 4: ARCHIEF
  const archivedIn = incomingOrders.filter(o => ['rejected', 'disputed', 'cancelled'].includes(o.status) || (o.trade_type === 'fiat' && o.escrow_status === 'released') || (o.trade_type === 'trade' && o.status === 'completed'));
  const archivedOut = outgoingOrders.filter(o => ['rejected', 'disputed', 'cancelled'].includes(o.status) || (o.trade_type === 'fiat' && o.escrow_status === 'released') || (o.trade_type === 'trade' && o.status === 'completed'));

  // ==========================================
  // 4. TRANSACTIE LOGICA & AUTO-ROLLBACK
  // ==========================================
  const handleTradeAction = async (order: Order, action: 'accepted' | 'rejected') => {
    setIsUpdatingStatus(true);
    try {
      // Genereer direct een QR code voor Natura als het wordt geaccepteerd!
      const qrCode = action === 'accepted' ? Math.random().toString(36).substring(2, 8).toUpperCase() : null;

      const updatePayload: any = { status: action };
      if (qrCode) updatePayload.qr_release_code = qrCode;

      const { error } = await supabase.from('orders').update(updatePayload).eq('id', order.id);
      if (error) throw error;

      if (action === 'accepted') {
        const { data: batch } = await supabase.from('batches').select('reserved').eq('id', order.batch_id).single();
        if (batch) {
          await supabase.from('batches').update({ reserved: batch.reserved + (order.amount || 1) }).eq('id', order.batch_id);
        }
      }

      setIncomingOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: action, qr_release_code: qrCode || o.qr_release_code } : o));
    } catch (err) { alert("Netwerkfout."); } 
    finally { setIsUpdatingStatus(false); }
  };

  const handleDisputeCancel = async (order: Order) => {
    if (!confirm("Weet je zeker dat je deze overdracht wilt annuleren? De gereserveerde eenheden worden direct teruggegeven aan de online voorraad van de maker.")) return;
    setIsUpdatingStatus(true);
    try {
      // 1. Spookvoorraad Rollback (Eenheden vrijgeven)
      const { data: batch } = await supabase.from('batches').select('reserved').eq('id', order.batch_id).single();
      if (batch) {
        const newReserved = Math.max(0, batch.reserved - (order.amount || 1));
        await supabase.from('batches').update({ reserved: newReserved }).eq('id', order.batch_id);
      }

      // 2. Order naar Disputed zetten
      await supabase.from('orders').update({
        status: 'disputed',
        dispute_reason: 'Geannuleerd tijdens overdracht',
        cancelled_by: currentUserId
      }).eq('id', order.id);

      // 3. UI updaten
      setOutgoingOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'disputed' } : o));
      setIncomingOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'disputed' } : o));
      
      alert(order.trade_type === 'fiat' ? "Annulering vastgelegd. De Escrow beheerder kijkt mee voor restitutie." : "Natura ruil geannuleerd en voorraad vrijgegeven.");
    } catch(err) { alert("Fout bij annuleren."); }
    finally { setIsUpdatingStatus(false); }
  };

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
  // INSTELLINGEN & STRIPE
  // ==========================================
  const handleStripeConnect = async () => {
    setIsConnectingStripe(true);
    try {
      const response = await fetch("/api/stripe/onboard", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: currentUserEmail, stripeAccountId: stripeAccountId, returnUrl: window.location.origin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.accountId && !stripeAccountId) await supabase.from("profiles").update({ stripe_account_id: data.accountId }).eq("id", currentUserId);
      window.location.href = data.url; 
    } catch (error: any) { alert(`KYC Connectiefout: ${error.message}`); } 
    finally { setIsConnectingStripe(false); }
  };

  const handleStripeLogin = async () => {
    setIsLoggingInStripe(true);
    try {
      const response = await fetch("/api/stripe/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: stripeAccountId }),
      });
      const data = await response.json();
      if (data.url) window.open(data.url, '_blank'); else throw new Error(data.error);
    } catch (error: any) { alert(`Fout: ${error.message}`); } 
    finally { setIsLoggingInStripe(false); }
  };

  const saveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await supabase.from("profiles").update({ display_name: makerName }).eq("id", currentUserId);
      alert("Profiel succesvol opgeslagen.");
    } catch (error) { alert("Kon instellingen niet opslaan."); }
    finally { setIsSavingSettings(false); }
  };

  const toggleNotification = async (type: 'email' | 'push') => {
    const newValue = type === 'email' ? !emailAlerts : !pushAlerts;
    if (type === 'email') setEmailAlerts(newValue);
    if (type === 'push') setPushAlerts(newValue);
    try { await supabase.from("profiles").update(type === 'email' ? { email_alerts: newValue } : { push_alerts: newValue }).eq("id", currentUserId); } 
    catch (error) { if (type === 'email') setEmailAlerts(!newValue); if (type === 'push') setPushAlerts(!newValue); }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 uppercase tracking-widest font-black text-xs animate-pulse">Administratie inladen...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20 pt-8 relative">
      
      {/* MODAL: QR CODE KOPER */}
      {qrOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-8 shadow-2xl relative flex flex-col items-center">
            <button onClick={() => setQrOrder(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-900 text-xl font-black">&times;</button>
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">Afhaal Bewijs</h3>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-8 text-center">{qrOrder.batch_title}</p>
            <div className="bg-white p-4 rounded-2xl border-4 border-slate-900 shadow-sm mb-6"><QRCode value={qrOrder.qr_release_code || qrOrder.id} size={200} level="H" /></div>
            <p className="text-center text-sm font-medium text-slate-600 mb-6">Laat deze code scannen door <strong className="text-slate-900">{qrOrder.seller_name}</strong> bij overdracht. Dit sluit de deal definitief en onomkeerbaar.</p>
            <button onClick={() => setQrOrder(null)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest py-4 rounded-xl">Sluiten</button>
          </div>
        </div>
      )}

      {/* MODAL: DELETE BATCH */}
      {batchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-100 text-3xl">⚠️</div>
            <h3 className="text-2xl font-black text-slate-900 text-center uppercase tracking-tight mb-2">Bevestig Vernietiging</h3>
            <p className="text-slate-500 text-center text-sm mb-8 font-medium">Weet je zeker dat je <strong className="text-slate-900">"{batchToDelete.title}"</strong> wilt verwijderen uit je online voorraad?</p>
            <div className="flex gap-3">
              <button disabled={isDeleting} onClick={() => setBatchToDelete(null)} className="w-1/2 bg-white hover:bg-slate-50 border border-slate-300 text-xs font-bold uppercase tracking-widest py-4 rounded-xl">Annuleren</button>
              <button disabled={isDeleting} onClick={executeDelete} className="w-1/2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase tracking-widest py-4 rounded-xl shadow-md">{isDeleting ? "Wissen..." : "Vernietigen"}</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        
        {/* HEADER & TABS 2.0 */}
        <div className="flex flex-col gap-8 mb-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-2">Administratie</h1>
              <p className="text-slate-500 flex items-center gap-2 text-sm font-medium">
                <span>👨‍🌾</span> Beheerder: <strong className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{makerName}</strong>
              </p>
            </div>
            <Link href="/maak-batch" className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs py-4 px-6 rounded-xl transition-all shadow-md text-center">
              + Nieuwe Oogst Toevoegen
            </Link>
          </div>

          <div className="flex gap-2 border-b border-slate-200 pb-0 overflow-x-auto scrollbar-none">
            <button onClick={() => setViewMode("actie")} className={`whitespace-nowrap px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "actie" ? "text-amber-600" : "text-slate-400 hover:text-slate-600"}`}>
              🔴 Actie Vereist {totalActions > 0 && <span className="ml-2 bg-red-500 text-white px-2 py-0.5 rounded-full">{totalActions}</span>}
              {viewMode === "actie" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-amber-500"></div>}
            </button>
            <button onClick={() => setViewMode("lopend")} className={`whitespace-nowrap px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "lopend" ? "text-blue-600" : "text-slate-400 hover:text-slate-600"}`}>
              🟠 Lopende Zaken {totalOngoing > 0 && <span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{totalOngoing}</span>}
              {viewMode === "lopend" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-blue-600"></div>}
            </button>
            <button onClick={() => setViewMode("voorraad")} className={`whitespace-nowrap px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "voorraad" ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}>
              📦 Mijn Voorraad
              {viewMode === "voorraad" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-emerald-500"></div>}
            </button>
            <button onClick={() => setViewMode("archief")} className={`whitespace-nowrap px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "archief" ? "text-slate-900" : "text-slate-400 hover:text-slate-600"}`}>
              📁 Archief
              {viewMode === "archief" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-slate-900"></div>}
            </button>
            <button onClick={() => setViewMode("instellingen")} className={`whitespace-nowrap px-6 py-4 text-xs font-black uppercase tracking-widest transition-all relative ${viewMode === "instellingen" ? "text-purple-600" : "text-slate-400 hover:text-slate-600"}`}>
              ⚙️ Instellingen & KYC
              {viewMode === "instellingen" && <div className="absolute bottom-0 left-0 w-full h-[3px] bg-purple-600"></div>}
            </button>
          </div>
        </div>

        {/* ========================================================== */}
        {/* VIEW 1: ACTIE VEREIST (Natura acceptaties)                 */}
        {/* ========================================================== */}
        {viewMode === "actie" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Inkomende Verzoeken (Als Verkoper)</h2>
              {actionRequiredIn.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {actionRequiredIn.map(order => (
                    <div key={order.id} className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">🔄 Nieuw Ruilvoorstel</p>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{order.batch_title}</h3>
                      <p className="text-sm text-slate-700 font-medium mb-4 italic">"{order.trade_offer}" - <strong className="not-italic text-slate-900">{order.buyer_name}</strong></p>
                      <div className="flex gap-2">
                        <button disabled={isUpdatingStatus} onClick={() => handleTradeAction(order, 'accepted')} className="w-1/2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-widest py-3 rounded-xl shadow-md">Accepteren</button>
                        <button disabled={isUpdatingStatus} onClick={() => handleTradeAction(order, 'rejected')} className="w-1/2 bg-white text-slate-600 hover:text-red-600 text-xs font-bold uppercase tracking-widest py-3 rounded-xl border border-slate-300">Weigeren</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500 font-medium">Je bent helemaal bij. Geen acties vereist.</p>}
            </div>

            <div className="pt-8 border-t border-slate-200">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Uitgaande Verzoeken (Als Koper)</h2>
              {actionRequiredOut.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {actionRequiredOut.map(order => (
                    <div key={order.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">⏳ Wachten op: {order.seller_name}</p>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{order.batch_title}</h3>
                      <p className="text-sm text-slate-500 font-medium">Je ruilvoorstel is verzonden. Zodra de boer accepteert, verplaatst deze naar 'Lopende Zaken'.</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500 font-medium">Je hebt geen voorstellen in de wachtrij staan.</p>}
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW 2: LOPENDE ZAKEN (De QR Handshake Area)               */}
        {/* ========================================================== */}
        {viewMode === "lopend" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8">
            <div className="bg-blue-50 border border-blue-200 p-5 rounded-xl flex gap-3 text-sm text-blue-800 font-medium">
              <span className="text-xl">ℹ️</span>
              <p>Dit is de wachtkamer voor overdracht. <strong>Kopers</strong> tonen hier hun QR-code. <strong>Makers</strong> scannen deze QR-code om de deal cryptografisch te verzegelen en (indien Fiat) de betaling vrij te geven.</p>
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Jouw Verkopen (Jij moet scannen)</h2>
              {ongoingIn.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ongoingIn.map(order => (
                    <div key={order.id} className="bg-white border-2 border-slate-800 rounded-2xl p-6 shadow-md flex flex-col">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Koper: {order.buyer_name}</p>
                      <h3 className="text-lg font-bold text-slate-900 mb-4">{order.batch_title} ({order.amount}x)</h3>
                      <div className="mt-auto flex flex-col gap-2">
                        <button onClick={() => router.push(`/inbox/${order.id}`)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl transition-all">💬 Open Chat</button>
                        <button onClick={() => router.push(`/scan/${order.id}`)} className="w-full bg-slate-900 hover:bg-slate-800 text-emerald-400 text-xs font-black uppercase tracking-widest py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"><span>📷</span> Scan Afhaal-QR</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500 font-medium">Geen goederen klaar voor overdracht.</p>}
            </div>

            <div className="pt-8 border-t border-slate-200">
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-6">Jouw Aankopen (Jij moet afhalen)</h2>
              {ongoingOut.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {ongoingOut.map(order => (
                    <div key={order.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Afhalen bij: {order.seller_name}</p>
                      <h3 className="text-lg font-bold text-slate-900 mb-4">{order.batch_title} ({order.amount}x)</h3>
                      <div className="mt-auto flex flex-col gap-2">
                        <button onClick={() => setQrOrder(order)} className="w-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl shadow-md flex items-center justify-center gap-2"><span>📱</span> Toon Afhaal-QR</button>
                        <button onClick={() => router.push(`/inbox/${order.id}`)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-widest py-3.5 rounded-xl">💬 Open Chat</button>
                        <button disabled={isUpdatingStatus} onClick={() => handleDisputeCancel(order)} className="w-full mt-2 text-[10px] text-red-500 hover:text-red-700 font-bold uppercase tracking-widest">🚨 Annuleer / Open Claim</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500 font-medium">Je hoeft op dit moment nergens goederen af te halen.</p>}
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW 3: MIJN VOORRAAD (De Live Batches)                    */}
        {/* ========================================================== */}
        {viewMode === "voorraad" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {myBatches.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
                {myBatches.map((batch) => (
                  <div key={batch.id} className="relative group h-full">
                    <BatchCard {...batch} daysLeft={batch.days_left} />
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl flex flex-col items-center justify-center p-5 gap-3 border border-slate-200 shadow-inner">
                      <button onClick={() => router.push(`/bewerk-batch/${batch.id}`)} className="w-full bg-white border border-slate-300 text-slate-700 text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl shadow-sm">Bewerken</button>
                      {batch.reserved > 0 ? (
                        <button disabled className="w-full bg-slate-100 border border-slate-200 text-slate-400 text-[10px] font-bold uppercase tracking-widest py-3.5 rounded-xl"><span>🔒</span> Geblokkeerd</button>
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
                <p className="text-slate-500 text-sm">Plaats een oogst of product op de radar om te starten met handelen.</p>
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW 4: ARCHIEF (De Boekhouding)                           */}
        {/* ========================================================== */}
        {viewMode === "archief" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
             <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead className="bg-slate-50 text-slate-500 font-black uppercase tracking-widest text-[10px]">
                     <tr>
                       <th className="px-6 py-4">Datum</th>
                       <th className="px-6 py-4">Oogst / Product</th>
                       <th className="px-6 py-4">Rol</th>
                       <th className="px-6 py-4">Tegenpartij</th>
                       <th className="px-6 py-4">Type</th>
                       <th className="px-6 py-4">Status</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {[...archivedIn, ...archivedOut].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(order => (
                       <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 text-slate-500">{new Date(order.created_at).toLocaleDateString('nl-NL')}</td>
                         <td className="px-6 py-4 font-bold text-slate-900">{order.batch_title} ({order.amount}x)</td>
                         <td className="px-6 py-4 text-slate-600">{order.seller_name === makerName ? 'Verkoper' : 'Koper'}</td>
                         <td className="px-6 py-4 text-slate-600">{order.seller_name === makerName ? order.buyer_name : order.seller_name}</td>
                         <td className="px-6 py-4 font-medium">{order.trade_type === 'fiat' ? '💶 Fiat' : '🔄 Natura'}</td>
                         <td className="px-6 py-4">
                           {['completed'].includes(order.status) && <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">✅ Succes</span>}
                           {['rejected', 'cancelled'].includes(order.status) && <span className="bg-slate-100 text-slate-500 border border-slate-300 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">Geannuleerd</span>}
                           {['disputed'].includes(order.status) && <span className="bg-red-50 text-red-700 border border-red-200 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider">🚨 Claim Geopend</span>}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
                 {archivedIn.length === 0 && archivedOut.length === 0 && (
                   <div className="p-12 text-center text-slate-500 font-medium">Nog geen transacties in het archief.</div>
                 )}
               </div>
             </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* VIEW 5: INSTELLINGEN & KYC                                 */}
        {/* ========================================================== */}
        {viewMode === "instellingen" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-8 max-w-4xl">
            {myBatches.length > 0 && !stripeOnboarded && (
              <div className="mb-4 bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                <div>
                  <h3 className="text-lg font-black text-amber-900 uppercase tracking-tight mb-2 flex items-center gap-2"><span>🏦</span> Actie Vereist: Activeer Fiat Betalingen</h3>
                  <p className="text-amber-700 text-sm font-medium leading-relaxed max-w-2xl">
                    Je hebt producten op de radar gezet, maar je bankrekening is nog niet gekoppeld. Zonder deze KYC-koppeling via Stripe kunnen kopers jouw goederen niet met iDEAL reserveren.
                  </p>
                </div>
                <button onClick={handleStripeConnect} disabled={isConnectingStripe} className="w-full md:w-auto bg-amber-600 hover:bg-amber-500 disabled:bg-amber-300 text-white font-bold uppercase tracking-widest text-xs px-8 py-4 rounded-xl shadow-md transition-all whitespace-nowrap">
                  {isConnectingStripe ? "Verbinden..." : "Start KYC Verificatie"}
                </button>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
               <div className="flex items-center gap-3 mb-2">
                 <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl border border-blue-100">🏦</div>
                 <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Financiën & KYC</h2>
               </div>
               <p className="text-sm text-slate-500 mb-6 font-medium border-b border-slate-100 pb-6">
                 Beheer je bankkoppeling en ontvangst van fiat-betalingen. Wij maken gebruik van Stripe Connect voor veilige, gecertificeerde uitbetalingen.
               </p>
               {stripeOnboarded ? (
                 <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                   <div className="flex items-center gap-4">
                     <span className="text-4xl">✅</span>
                     <div>
                       <h3 className="font-bold text-emerald-900 text-lg uppercase tracking-tight">Identiteit Geverifieerd</h3>
                       <p className="text-sm text-emerald-700 font-medium mt-1">Jouw account is succesvol gekoppeld en kan fiat-betalingen ontvangen.</p>
                     </div>
                   </div>
                   <button onClick={handleStripeLogin} disabled={isLoggingInStripe} className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-all shadow-md whitespace-nowrap">
                     {isLoggingInStripe ? "Laden..." : "Beheer Bankzaken"}
                   </button>
                 </div>
               ) : (
                 <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
                   <div className="flex items-center gap-4">
                     <span className="text-4xl">ℹ️</span>
                     <div>
                       <h3 className="font-bold text-slate-900 text-lg uppercase tracking-tight">Status: Niet Gekoppeld</h3>
                       <p className="text-sm text-slate-500 font-medium mt-1">Je kunt nu alleen Natura-ruilhandel uitvoeren.</p>
                     </div>
                   </div>
                   <button onClick={handleStripeConnect} disabled={isConnectingStripe} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-all shadow-md whitespace-nowrap">
                     {isConnectingStripe ? "Verbinden..." : "Start Verificatie"}
                   </button>
                 </div>
               )}
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
               <div className="flex items-center gap-3 mb-2">
                 <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xl border border-slate-200">👨‍🌾</div>
                 <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Mijn Profiel</h2>
               </div>
               <p className="text-sm text-slate-500 mb-6 font-medium border-b border-slate-100 pb-6">Deze gegevens zijn zichtbaar voor kopers op het netwerk.</p>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                 <div className="space-y-3">
                   <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Handelsnaam / Pseudoniem</label>
                   <input type="text" value={makerName} onChange={(e) => setMakerName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-bold focus:outline-none focus:border-blue-500 transition-all shadow-inner" />
                 </div>
                 <div className="space-y-3">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">E-mailadres (Geverifieerd)</label>
                   <input type="text" disabled value={currentUserEmail} className="w-full bg-slate-100 border border-slate-200 rounded-xl p-4 text-slate-500 font-bold cursor-not-allowed" />
                 </div>
               </div>
               <button onClick={saveSettings} disabled={isSavingSettings} className="bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest text-xs px-8 py-4 rounded-xl transition-all shadow-md">
                 {isSavingSettings ? "Opslaan..." : "Gegevens Bijwerken"}
               </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm">
               <div className="flex items-center gap-3 mb-2">
                 <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center text-xl border border-slate-200">🔔</div>
                 <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Communicatie Voorkeuren</h2>
               </div>
               <p className="text-sm text-slate-500 mb-6 font-medium border-b border-slate-100 pb-6">Blijf op de hoogte van nieuwe reserveringen en inkomende chatberichten.</p>
               
               <div className="space-y-6">
                 <div className="flex items-center justify-between cursor-pointer group" onClick={() => toggleNotification('email')}>
                   <div>
                     <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors">E-mail Notificaties</h3>
                     <p className="text-sm text-slate-500 font-medium mt-1">Stuur een e-mail bij nieuwe reserveringen en chatberichten.</p>
                   </div>
                   <div className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 shadow-inner border ${emailAlerts ? "bg-amber-500 border-amber-600" : "bg-slate-200 border-slate-300"}`}>
                     <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${emailAlerts ? "translate-x-6" : ""}`}></div>
                   </div>
                 </div>

                 <div className="flex items-center justify-between cursor-pointer group pt-6 border-t border-slate-50" onClick={() => toggleNotification('push')}>
                   <div>
                     <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors">App Push-berichten</h3>
                     <p className="text-sm text-slate-500 font-medium mt-1">Ontvang direct een pop-up op je telefoonscherm (via PWA).</p>
                   </div>
                   <div className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 shadow-inner border ${pushAlerts ? "bg-emerald-500 border-emerald-600" : "bg-slate-200 border-slate-300"}`}>
                     <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${pushAlerts ? "translate-x-6" : ""}`}></div>
                   </div>
                 </div>
               </div>
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-6 text-center">Wijzigingen worden direct opgeslagen in je profiel.</p>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}