"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../utils/supabase";

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  created_at: string;
}

export default function ChatRoom() {
  const params = useParams();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // States
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Scroll automatisch naar beneden bij nieuwe berichten
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let activeChannel: any; 

    async function initializeChat() {
      const id = params?.id as string;
      if (!id) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setCurrentUserId(session.user.id);

      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session.user.id).single();
      if (profile) setCurrentUserName(profile.display_name);

      try {
        // Haal Order op (Inclusief Status)
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", id)
          .single();

        if (orderError) throw orderError;
        
        // Zorg dat oude orders zonder status standaard op 'voltooid' of 'pending' worden gezet voor weergave
        if (!orderData.status) {
           orderData.status = orderData.trade_type === 'fiat' ? 'completed' : 'pending';
        }
        setOrder(orderData);

        // Haal Berichten op
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("order_id", id)
          .order("created_at", { ascending: true });

        if (messagesData) setMessages(messagesData);

        // Live Websocket
        const uniqueChannelName = `room_${id}_${Date.now()}`;
        activeChannel = supabase.channel(uniqueChannelName);
        
        activeChannel
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${id}` },
            (payload: any) => {
              const incoming = payload.new as Message;
              setMessages((prev) => {
                const alreadyExists = prev.some(m => m.id === incoming.id);
                if (alreadyExists) return prev;
                const filtered = prev.filter(m => !(m.id.startsWith('temp_') && m.text === incoming.text));
                return [...filtered, incoming];
              });
            }
          )
          .subscribe();

      } catch (error) {
        console.error("Fout bij laden van chatroom:", error);
      } finally {
        setIsLoading(false);
      }
    }

    initializeChat();

    return () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
      }
    };
  }, [params?.id, router]);

  // ==========================================
  // BERICHT VERZENDEN (MET OPTIMISTIC UI)
  // ==========================================
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault(); 
    if (!newMessage.trim() || !currentUserId || !order) return;

    const messageText = newMessage.trim();
    setNewMessage(""); 

    const tempMsg: Message = {
      id: `temp_${Date.now()}`,
      sender_id: currentUserId,
      sender_name: currentUserName,
      text: messageText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const partnerName = currentUserName === order.seller_name ? order.buyer_name : order.seller_name;
      const { data: partnerProfile } = await supabase.from("profiles").select("id").eq("display_name", partnerName).single();

      await supabase.from("messages").insert([{
        order_id: order.id,
        sender_id: currentUserId,
        sender_name: currentUserName,
        text: messageText
      }]);

      if (partnerProfile && partnerProfile.id) {
        await supabase.from("notifications").insert([{
          user_id: partnerProfile.id,
          type: "chat",
          title: `Nieuw bericht van ${currentUserName}`,
          content: messageText.length > 40 ? messageText.substring(0, 40) + "..." : messageText,
          link: `/inbox/${order.id}`
        }]);
      }
    } catch (error) {
      console.error("Bericht verzenden mislukt:", error);
    }
  };

  // ==========================================
  // HANDELS-LOGICA: ACCEPTEER / WIJS AF
  // ==========================================
  const handleTradeAction = async (action: 'completed' | 'rejected') => {
    setIsUpdatingStatus(true);
    try {
      // 1. Update de order status in de database
      const { error: orderError } = await supabase
        .from('orders')
        .update({ status: action })
        .eq('id', order.id);
      
      if (orderError) throw orderError;

      // 2. Als geaccepteerd: Voorraad afschrijven!
      if (action === 'completed') {
        // Haal actuele batch op om wiskunde correct uit te voeren
        const { data: batch } = await supabase.from('batches').select('reserved').eq('id', order.batch_id).single();
        if (batch) {
          const newReserved = batch.reserved + (order.amount || 1);
          await supabase.from('batches').update({ reserved: newReserved }).eq('id', order.batch_id);
        }
      }

      // 3. Stuur een onzichtbaar Systeem-bericht in de chat
      const systemText = action === 'completed' 
        ? "✅ De maker heeft dit ruilvoorstel officieel geaccepteerd. De voorraad is bijgewerkt."
        : "❌ De maker heeft dit ruilvoorstel afgewezen.";

      await supabase.from("messages").insert([{
        order_id: order.id,
        sender_id: "00000000-0000-0000-0000-000000000000", // Systeem ID
        sender_name: "Systeem",
        text: systemText
      }]);

      // 4. Update lokale state
      setOrder({ ...order, status: action });

    } catch (error) {
      console.error("Fout bij updaten handelsverzoek:", error);
      alert("Netwerkfout bij het verwerken van je keuze.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Beveiligd kanaal opzetten...</p>
      </main>
    );
  }

  if (!order) return <div className="min-h-screen bg-slate-50 text-slate-900 text-center pt-20 font-bold uppercase tracking-widest text-sm">Geen toegang of kanaal bestaat niet.</div>;

  const isSeller = currentUserName === order.seller_name;
  const partnerName = isSeller ? order.buyer_name : order.seller_name;
  const currentStatus = order.status || (order.trade_type === 'fiat' ? 'completed' : 'pending');

  return (
    <main className="min-h-[calc(100vh-69px)] bg-slate-50 text-slate-900 flex flex-col lg:grid lg:grid-cols-12 flex-grow">
      
      {/* ======================================= */}
      {/* LINKERKANT: HET LIVE CHAT SCHERM */}
      {/* ======================================= */}
      <div className="lg:col-span-8 flex flex-col h-[75vh] lg:h-[calc(100vh-69px)] border-r border-slate-200 bg-slate-50/50">
        
        <div className="p-4 md:p-6 border-b border-slate-200 bg-white flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-black text-slate-700 border border-slate-200 shadow-inner">
              {partnerName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="font-black text-slate-900 uppercase tracking-tight text-sm md:text-base">{partnerName}</h2>
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> Geverifieerd Kanaal
              </p>
            </div>
          </div>
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-900 uppercase tracking-wider font-bold bg-white border border-slate-200 px-4 py-2 rounded-lg transition-colors shadow-sm">
            Sluit Chat
          </Link>
        </div>

        <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-5 scrollbar-none">
          {messages.map((msg) => {
            // SYSTEEM BERICHTEN (Voor updates over de deal)
            if (msg.sender_name === "Systeem") {
              return (
                <div key={msg.id} className="w-full flex justify-center my-4">
                  <span className="bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-sm text-center">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isMe = msg.sender_id === currentUserId;
            const isPending = msg.id.startsWith('temp_'); 
            
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-in fade-in slide-in-from-bottom-2 duration-200 ${isPending ? 'opacity-70' : 'opacity-100'}`}>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1 px-1">
                  {msg.sender_name}
                </span>
                <div className={`max-w-[85%] md:max-w-md p-4 text-sm leading-relaxed shadow-sm ${
                  isMe 
                    ? "bg-amber-600 text-white rounded-2xl rounded-tr-sm" 
                    : "bg-white border border-slate-200 text-slate-700 rounded-2xl rounded-tl-sm"
                }`}>
                  {msg.text}
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1 font-medium tracking-wider">
                  {isPending ? 'Verzenden...' : new Date(msg.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-200 bg-white flex gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.02)]">
          <input 
            type="text"
            value={newMessage}
            disabled={currentStatus === 'rejected'}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={currentStatus === 'rejected' ? "Kanaal gesloten." : `Stuur een bericht naar ${partnerName}...`}
            className="flex-grow bg-slate-50 border border-slate-200 rounded-xl px-4 py-3.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-inner disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
          <button 
            disabled={!newMessage.trim() || currentStatus === 'rejected'}
            className="bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black uppercase tracking-widest text-xs px-6 md:px-8 rounded-xl transition-colors shadow-md flex items-center justify-center"
          >
            Verstuur
          </button>
        </form>

      </div>

      {/* ======================================= */}
      {/* RECHTERKANT: CONTEXT & COMMAND CENTER    */}
      {/* ======================================= */}
      <div className="lg:col-span-4 bg-white border-l border-slate-200 p-6 md:p-8 space-y-6 flex flex-col justify-between h-auto lg:h-[calc(100vh-69px)] overflow-y-auto relative">
        <div className="space-y-6">
          
          <div className="border-b border-slate-100 pb-4">
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Informatie & Context</h3>
              
              {/* STATUS INDICATOR BADGE */}
              {currentStatus === 'completed' ? (
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm">✅ Akkoord</span>
              ) : currentStatus === 'rejected' ? (
                <span className="bg-red-50 text-red-700 border border-red-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm">❌ Afgewezen</span>
              ) : (
                <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded shadow-sm animate-pulse">⏳ Onderhandeling</span>
              )}
            </div>
            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tight leading-tight">{order.batch_title}</h4>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-5 shadow-sm">
            <div>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Transactie Vorm</p>
              <span className={`inline-block text-xs font-black uppercase tracking-wider px-3 py-1.5 rounded-lg shadow-sm ${
                order.trade_type === "fiat" ? "bg-slate-900 text-white border border-slate-800" : "bg-white text-slate-900 border border-slate-300"
              }`}>
                {order.trade_type === "fiat" ? "💶 Fiat Gereserveerd" : "🔄 Natura Ruilvoorstel"}
              </span>
            </div>

            <div className="pt-4 border-t border-slate-200">
              {order.trade_type === "fiat" ? (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gereserveerd Volume</p>
                  <p className="text-xl font-black text-slate-900">{order.amount || 1} <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">eenheden</span></p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Gewenst Volume</p>
                    <p className="text-xl font-black text-slate-900">{order.amount || 1} <span className="text-sm text-slate-500 font-bold uppercase tracking-wider">eenheden</span></p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Tegenprestatie (Aangeboden)</p>
                    <p className="text-sm font-medium text-slate-700 bg-white border border-slate-200 p-3 rounded-xl shadow-inner italic leading-relaxed">"{order.trade_offer}"</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* HET COMMAND CENTER (Alleen voor de Maker bij een open ruilverzoek) */}
          {isSeller && order.trade_type === 'trade' && currentStatus === 'pending' && (
            <div className="pt-6 border-t border-slate-200 space-y-3 animate-in fade-in slide-in-from-bottom-4">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-2 text-center">Jouw Beslissing</h3>
              <button 
                disabled={isUpdatingStatus}
                onClick={() => handleTradeAction('completed')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white font-black uppercase tracking-widest text-xs py-4 rounded-xl transition-all shadow-md flex justify-center items-center gap-2"
              >
                {isUpdatingStatus ? "Verwerken..." : "✅ Accepteer Ruilakkoord"}
              </button>
              <button 
                disabled={isUpdatingStatus}
                onClick={() => handleTradeAction('rejected')}
                className="w-full bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border border-slate-200 hover:border-red-200 font-bold uppercase tracking-widest text-xs py-3.5 rounded-xl transition-all shadow-sm"
              >
                Wijs Af
              </button>
              <p className="text-[9px] text-slate-400 text-center font-medium leading-relaxed pt-2">
                Bij acceptatie wordt de voorraad ({order.amount || 1} eenheden) direct en definitief gereserveerd voor deze koper.
              </p>
            </div>
          )}

        </div>

        <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-2xl text-center mt-6">
          <p className="text-[10px] text-blue-800 font-medium leading-relaxed">
            🔒 Dit kanaal is end-to-end beveiligd. Handel altijd volgens de erecode. Zodra een deal rond is, kun je hier de overdracht afstemmen.
          </p>
        </div>
      </div>

    </main>
  );
}