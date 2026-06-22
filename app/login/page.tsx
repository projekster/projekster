"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";
import Image from "next/image"; // <-- Toegevoegd voor het officiële logo

export default function Login() {
  const router = useRouter();
  
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      if (isRegister) {
        // MAAK EEN NIEUW ACCOUNT AAN
        if (!displayName.trim()) throw new Error("Een weergavenaam is verplicht.");
        
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName.trim() }
          }
        });
        
        if (error) {
          if (error.message.includes("already registered")) throw new Error("Dit digitaal adres (e-mail) is al geregistreerd.");
          throw error;
        }
        
        setMessage({ type: "success", text: "Identiteit gesmeed. Controleer je e-mail om de kluis definitief te openen." });
      } else {
        // LOG IN MET BESTAAND ACCOUNT
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          if (error.message.includes("Invalid login credentials")) throw new Error("Verkeerde sleutel of digitaal adres.");
          throw error;
        }
        
        setMessage({ type: "success", text: "Verificatie succesvol. Toegang tot de kluis wordt verleend..." });
        
        // Vloeibare overgang naar het Dashboard
        router.refresh(); // Forceer de Navbar om de nieuwe status te zien
        setTimeout(() => router.push("/dashboard"), 800);
      }
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "De verbinding met de kluis is verbroken." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex w-full bg-white">
      
      {/* ======================================= */}
      {/* LINKER KOLOM: HET PORTAAL (FORMULIER)   */}
      {/* ======================================= */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 lg:p-24 relative z-10 bg-white">
        
        {/* Terug naar Home Link */}
        <div className="absolute top-8 left-8">
          <Link href="/" className="text-slate-500 hover:text-amber-600 flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors bg-slate-50 hover:bg-amber-50 py-2.5 px-4 rounded-lg border border-slate-200 shadow-sm">
            <span>&larr;</span> Terug naar de markt
          </Link>
        </div>

        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          <div className="mb-10 text-center lg:text-left pt-12 lg:pt-0">
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 uppercase tracking-tight mb-3">
              {isRegister ? "Smeed je Identiteit" : "Betreed de Markt"}
            </h1>
            <p className="text-slate-500 text-sm md:text-base leading-relaxed font-medium">
              {isRegister 
                ? "Sluit je aan bij het soevereine netwerk van vrije makers, boeren en autonome burgers." 
                : "Verifieer je cryptografische sleutels om toegang te krijgen tot jouw kluis."}
            </p>
          </div>

          {/* Meldingen balk (Fouten of Succes - Nu in de strakke White Cube stijl) */}
          {message.text && (
            <div className={`mb-8 p-5 rounded-xl text-sm font-bold border animate-in fade-in slide-in-from-top-2 shadow-sm ${
              message.type === "error" 
                ? "bg-red-50 text-red-600 border-red-200" 
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{message.type === "error" ? "⚠️" : "✅"}</span>
                <p>{message.text}</p>
              </div>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleAuth}>
            
            {isRegister && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hoe noemt de markt je?</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required={isRegister}
                    disabled={loading}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Bijv. Boerderij De Vrije Grond" 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50 shadow-inner"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Digitaal Adres (E-mail)</label>
              <input 
                type="email" 
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jouw@email.com" 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50 shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sleutel (Wachtwoord)</label>
                {!isRegister && (
                  <Link href="#" className="text-[10px] font-bold text-slate-500 hover:text-amber-600 transition-colors uppercase tracking-wide">
                    Sleutel vergeten?
                  </Link>
                )}
              </div>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"} 
                  required
                  disabled={loading}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pr-12 text-slate-900 placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all disabled:opacity-50 shadow-inner"
                />
                <button 
                  type="button"
                  disabled={loading}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all shadow-md hover:shadow-lg mt-4 flex justify-center items-center group"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Sleutels verifiëren...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {isRegister ? "Identiteit Smeden" : "Ontgrendel Kluis"}
                  <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
                </span>
              )}
            </button>
          </form>

          <div className="mt-10 text-center text-xs text-slate-500 border-t border-slate-100 pt-8 font-medium">
            {isRegister ? "Al bekend bij het netwerk?" : "Nog geen toegang tot de markt?"}
            <button 
              type="button"
              disabled={loading}
              onClick={() => {
                setIsRegister(!isRegister);
                setMessage({ type: "", text: "" }); 
              }}
              className="ml-2 text-amber-600 hover:text-amber-700 font-black uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {isRegister ? "Log hier in" : "Sluit je aan"}
            </button>
          </div>

        </div>
      </div>

      {/* ======================================= */}
      {/* RECHTER KOLOM: HET MANIFESTO (VISUEEL)  */}
      {/* ======================================= */}
      <div className="hidden lg:flex w-1/2 bg-slate-50 relative border-l border-slate-200 items-center justify-center overflow-hidden">
        
        {/* Sfeervolle achtergrond gloed - Lichte variant */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-amber-100/50 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-emerald-50/50 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="relative z-10 max-w-lg px-12">
          
          {/* Het Officiële Logo in plaats van een "P" */}
          <div className="mb-8">
            <Image 
              src="/icon-192x192.png" 
              alt="Projekster Logo" 
              width={72} 
              height={72} 
              className="rounded-2xl shadow-lg border border-slate-200" 
            />
          </div>

          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-tight mb-6">
            Onafhankelijkheid is geen theorie.<br/>
            <span className="text-amber-600">Het is een ecosysteem.</span>
          </h2>
          <div className="space-y-6 text-lg text-slate-600 font-light leading-relaxed">
            <p>
              Je betreedt nu een infrastructuur gebouwd voor de vrije mens. Wij geloven in de directe uitwisseling van waarde, zonder censuur, zonder onzichtbare marges en zonder afhankelijkheid van megacorporaties.
            </p>
            <ul className="space-y-4 pt-6 border-t border-slate-200 font-medium text-sm">
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600 font-black">1</span> 
                100% eigenaarschap over je data en aanbod.
              </li>
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600 font-black">2</span> 
                Vrijheid om te handelen in fiat of natura.
              </li>
              <li className="flex items-center gap-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600 font-black">3</span> 
                Een decentraal netwerk van ware producenten.
              </li>
            </ul>
          </div>
        </div>
      </div>

    </main>
  );
}