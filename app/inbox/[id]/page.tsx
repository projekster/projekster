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

  // Scroll automatische naar beneden bij nieuwe berichten
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    async function initializeChat() {
      // 1. Verifieer de sessie
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setCurrentUserId(session.user.id);

      // Haal eigen naam op
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session.user.id).single();
      if (profile) setCurrentUserName(profile.display_name);

      try {
        // 2. Haal Order & Context op
        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select("*")
          .eq("id", params.id)
          .single();

        if (orderError) throw orderError;
        setOrder(orderData);

        // 3. Haal Berichtenhistorie op
        const { data: messagesData } = await supabase
          .from("messages")
          .select("*")
          .eq("order_id", params.id)
          .order("created_at", { ascending: true });

        if (messagesData) setMessages(messagesData);

        // ==========================================
        // TELEMETRIE: LIVE WEBSOCKET SUBSCRIPTION (REALTIME)
        // ==========================================
        const channel = supabase
          .channel(`room-${params.id}`)
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "messages", filter: `order_id=eq.${params.id}` },
            (payload) => {
              const incoming = payload.new as Message;
              // Voorkom dubbele rendering als je zelf de verzender bent
              setMessages((prev) => {
                if (prev.some(m => m.id === incoming.id)) return prev;
                return [...prev, incoming];
              });
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };

      } catch (error) {
        console.error("Fout bij laden van chatroom:", error);
      } finally {
        setIsLoading(false);
      }
    }

    initializeChat();
  }, [params.id, router]);

  // Bericht Verzenden inclusief Notificatie-Trigger
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;

    const messageText = newMessage.trim();
    setNewMessage(""); // Maak direct leeg voor snelle UX feel

    try {
      // 1. Bepaal wie de gesprekspartner is (de ontvanger van de notificatie)
      const partnerName = currentUserName === order.seller_name ? order.buyer_name : order.seller_name;
      
      // Zoek het user_id van de partner op in de profiles tabel
      const { data: partnerProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("display_name", partnerName)
        .single();

      // 2. Verstuur het bericht zelf
      const { error } = await supabase.from("messages").insert([{
        order_id: order.id,
        sender_id: currentUserId,
        sender_name: currentUserName,
        text: messageText
      }]);

      if (error) throw error;

      // 3. Vuur de Notificatie af naar het netwerk van de ontvanger
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
      alert("Bericht kon niet worden verzonden.");
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-amber-500 font-bold uppercase tracking-widest text-xs animate-pulse">Beveiligd kanaal opzetten...</p>
      </main>
    );
  }

  if (!order) return <div className="text-white text-center pt-20">Geen toegang of kanaal bestaat niet.</div>;

  // Bepaal wie de gesprekspartner is
  const partnerName = currentUserName === order.seller_name ? order.buyer_name : order.seller_name;

  return (
    <main className="min-h-[calc(100screen-69px)] bg-slate-950 text-slate-100 flex flex-col lg:grid lg:grid-cols-12 flex-grow">
      
      {/* ======================================= */}
      {/* LINKERKANT: HET LIVE CHAT SCHERM       */}
      {/* ======================================= */}
      <div className="lg:col-span-8 flex flex-col h-[70vh] lg:h-[85vh] border-r border-slate-900">
        
        {/* Chat Header */}
        <div className="p-4 md:p-6 border-b border-slate-900 bg-slate-900/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-amber-500 border border-slate-700">
              {partnerName.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="font-black text-white uppercase tracking-tight text-sm md:text-base">{partnerName}</h2>
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center gap-1">
                <span className="w-1.5 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Geverifieerd Kanaal
              </p>
            </div>
          </div>
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-300 uppercase tracking-wider font-bold">
            Sluit Chat
          </Link>
        </div>

        {/* Berichten Venster */}
        <div className="flex-grow overflow-y-auto p-4 md:p-6 space-y-4 bg-slate-950/20 scrollbar-none">
          {messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"} animate-in fade-in duration-200`}>
                <span className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mb-1 px-1">
                  {msg.sender_name}
                </span>
                <div className={`max-w-xs md:max-w-md p-4 rounded-2xl text-sm leading-relaxed shadow-lg ${
                  isMe 
                    ? "bg-amber-600 text-white rounded-tr-none" 
                    : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                }`}>
                  {msg.text}
                </div>
                <span className="text-[9px] text-slate-700 mt-1 px-1">
                  {new Date(msg.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Balk */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-900 bg-slate-950 flex gap-3">
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Stuur een beveiligd bericht naar ${partnerName}...`}
            className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button className="bg-amber-600 hover:bg-amber-500 text-white font-black uppercase tracking-widest text-xs px-6 rounded-xl transition-colors shadow-lg shadow-amber-900/20">
            Verstuur
          </button>
        </form>

      </div>

      {/* ======================================= */}
      {/* RECHTERKANT: CONTEXT & CONTEXT DETAILS   */}
      {/* ======================================= */}
      <div className="lg:col-span-4 bg-slate-950 p-6 space-y-6 flex flex-col justify-between h-auto lg:h-[85vh]">
        <div className="space-y-6">
          <div className="border-b border-slate-900 pb-4">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-1">Informatie & Context</h3>
            <h4 className="text-xl font-black text-white uppercase tracking-tight">{order.batch_title}</h4>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Transactie Vorm</p>
              <span className={`inline-block text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-md ${
                order.trade_type === "fiat" ? "bg-amber-600/10 text-amber-500 border border-amber-500/20" : "bg-emerald-600/10 text-emerald-400 border border-emerald-400/20"
              }`}>
                {order.trade_type === "fiat" ? "💶 Fiat Handel" : "🔄 Natura Ruil"}
              </span>
            </div>

            {order.trade_type === "fiat" ? (
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Gereserveerd Volume</p>
                <p className="text-base font-bold text-white">{order.amount} eenheden</p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Tegenprestatie (In Natura)</p>
                <p className="text-sm font-medium text-emerald-400 italic">"{order.trade_offer}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Veiligheidsvoorschrift */}
        <div className="p-4 bg-slate-900/30 border border-slate-900 rounded-xl text-center">
          <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
            🔒 Dit kanaal is end-to-end beveiligd binnen de Projekster-architectuur. Stem hier de overdracht en locatie af. Handel altijd veilig en volgens de erecode.
          </p>
        </div>

      </div>

    </main>
  );
}