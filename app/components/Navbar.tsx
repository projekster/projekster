"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";
import Image from "next/image";

interface Notification {
  id: string;
  title: string;
  content: string;
  link: string;
  is_read: boolean;
  created_at: string;
}

export default function Navbar() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [makerName, setMakerName] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Notificatie State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        fetchProfileAndNotifications(session.user.id);
      }
    };

    const fetchProfileAndNotifications = async (userId: string) => {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", userId).single();
      if (profile) setMakerName(profile.display_name);

      const { data: notifs } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .eq("is_read", false)
        .order("created_at", { ascending: false });
      
      if (notifs) setNotifications(notifs);

      supabase
        .channel('public:notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, 
          (payload) => {
            setNotifications((current) => [payload.new as Notification, ...current]);
          }
        )
        .subscribe();
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfileAndNotifications(session.user.id);
      } else {
        setUser(null);
        setMakerName("");
        setNotifications([]);
      }
    });

    return () => { subscription.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const markAsRead = async (id: string, link: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
    setShowNotifications(false);
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    router.push(link);
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.map(n => n.id);
    setNotifications([]);
    setShowNotifications(false);
    await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds);
  };

  return (
    <nav className="w-full border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-4 flex justify-between items-center relative">
        
        <Link href="/" className="text-xl md:text-2xl font-black tracking-tighter text-slate-900 uppercase flex items-center gap-3 group">
          <Image 
            src="/icon-192x192.png" 
            alt="Projekster Logo" 
            width={32} 
            height={32} 
            priority
            className="rounded-lg shadow-[0_2px_10px_rgba(245,158,11,0.2)] transition-transform duration-300 group-hover:scale-105" 
          />
          Projekster.
        </Link>

        {/* DESKTOP MENU */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/maak-batch" className="text-sm font-bold text-slate-500 hover:text-amber-600 transition-colors uppercase tracking-wide">
            + Oogst Aanbieden
          </Link>
          
          {user ? (
            <div className="flex items-center gap-4 border-l border-slate-200 pl-6 relative">
              
              {/* NOTIFICATIE BEL */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 text-slate-400 hover:text-slate-900 transition-colors relative"
                >
                  <span className="text-xl">🔔</span>
                  {notifications.length > 0 && (
                    <span className="absolute top-1 right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 border-2 border-white"></span>
                    </span>
                  )}
                </button>

                {/* NOTIFICATIE DROPDOWN PANEL */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                      <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Systeem Meldingen</h3>
                      {notifications.length > 0 && (
                        <button onClick={markAllAsRead} className="text-[10px] text-slate-400 hover:text-amber-600 font-bold uppercase tracking-wider">Wis alles</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto scrollbar-none">
                      {notifications.length > 0 ? (
                        notifications.map((n) => (
                          <div 
                            key={n.id} 
                            onClick={() => markAsRead(n.id, n.link)}
                            className="p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <h4 className="text-sm font-bold text-amber-600 mb-1">{n.title}</h4>
                            <p className="text-xs text-slate-500 leading-relaxed">{n.content}</p>
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-2 block">
                              {new Date(n.created_at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute:'2-digit' })}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-400 text-xs font-medium">
                          Geen nieuwe transmissies.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="text-right hidden lg:block">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Welkom terug,</p>
                <p className="text-sm font-black text-slate-900">{makerName || "Verifiëren..."}</p>
              </div>
              <Link href="/dashboard" className="bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-xs font-bold py-2.5 px-4 rounded-xl transition-all uppercase tracking-widest flex items-center gap-2 shadow-sm">
                <span>🛡️</span> Mijn Kluis
              </Link>
              <button onClick={handleLogout} className="bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-500 hover:text-red-600 text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-sm">
                Sluit Af
              </button>
            </div>
          ) : (
            <Link href="/login" className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white text-sm font-bold py-2.5 px-6 rounded-xl transition-all shadow-md uppercase tracking-wider">
              Inloggen
            </Link>
          )}
        </div>

        {/* MOBIEL MENU TOGGLE */}
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden text-slate-500 hover:text-slate-900 p-2 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-7 h-7">
            {isMobileMenuOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M3 6h18M3 18h18" />}
          </svg>
        </button>
      </div>

      {/* MOBIEL MENU PANEL */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-6 space-y-5 shadow-xl animate-in slide-in-from-top-2 absolute w-full left-0 z-40">
          {user && (
            <div className="pb-4 border-b border-slate-100 mb-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Ingelogd als</p>
                <p className="text-lg font-black text-slate-900">{makerName}</p>
              </div>
              <button onClick={() => { setShowNotifications(!showNotifications); }} className="relative text-2xl">
                🔔
                {notifications.length > 0 && <span className="absolute top-0 right-0 h-3 w-3 rounded-full bg-amber-500 animate-pulse border-2 border-white"></span>}
              </button>
            </div>
          )}
          
          {user && showNotifications && notifications.length > 0 && (
             <div className="bg-slate-50 rounded-xl p-4 border border-amber-200 shadow-inner">
                <p className="text-xs font-bold text-amber-600 mb-3 uppercase tracking-widest">Ongelezen ({notifications.length})</p>
                {notifications.map(n => (
                  <div key={n.id} onClick={() => { markAsRead(n.id, n.link); setIsMobileMenuOpen(false); }} className="text-sm text-slate-600 mb-3 pb-3 border-b border-slate-200 last:border-0 last:mb-0 last:pb-0">
                    <strong className="text-slate-900 block">{n.title}</strong>
                    {n.content}
                  </div>
                ))}
             </div>
          )}
          
          {user && <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm font-bold text-amber-600 uppercase tracking-wide flex items-center gap-2"><span>🛡️</span> Naar Mijn Kluis</Link>}
          <Link href="/maak-batch" onClick={() => setIsMobileMenuOpen(false)} className="block text-sm font-bold text-slate-600 hover:text-slate-900 uppercase tracking-wide">+ Oogst Aanbieden</Link>
          
          {user ? (
            <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="block w-full text-left text-sm font-bold text-red-500 pt-5 border-t border-slate-100 uppercase tracking-wide">Uitloggen (Sluit Kluis)</button>
          ) : (
            <Link href="/login" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold py-3.5 rounded-xl mt-4 uppercase tracking-widest shadow-md">Inloggen / Registreren</Link>
          )}
        </div>
      )}
    </nav>
  );
}