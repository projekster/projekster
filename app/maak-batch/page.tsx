"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../utils/supabase";

// De Oer-Rubrieken
const CATEGORIE_OPTIES = {
  voedsel: ["Vlees & Vis", "Zuivel & Eieren", "Groente & Fruit", "Graan & Meel", "Dranken & Conserven", "Honing & Zoet"],
  grondstof: ["Brandhout & Pellets", "Veevoer, Hooi & Stro", "Planten & Zaden", "Mest & Compost", "Levend Vee", "Werktuigen & Machines", "Off-Grid & Energie", "Bouwmateriaal"]
};

const EENHEDEN = ["Stuks", "Kilogram (kg)", "Liter (L)", "Kuub (m³)", "Kist/Krat", "Bos/Bussel", "Pallet"];

export default function MaakBatch() {
  const router = useRouter();
  
  // ==========================================
  // STATE: AUTH & STATUS
  // ==========================================
  const [makerName, setMakerName] = useState<string>("");
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // ==========================================
  // STATE: FORMULIER DATA
  // ==========================================
  const [title, setTitle] = useState("");
  const [pillar, setPillar] = useState<"voedsel" | "grondstof" | "">("");
  const [category, setCategory] = useState("");
  const [total, setTotal] = useState("");
  const [unit, setUnit] = useState("Stuks");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [allowsTrade, setAllowsTrade] = useState(false);
  const [tradeValue, setTradeValue] = useState("");
  const [daysLeft, setDaysLeft] = useState("14");
  
  // ==========================================
  // STATE: GEOGRAFIE & FOTO
  // ==========================================
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationResolved, setLocationResolved] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ==========================================
  // IDENTITEIT CHECK
  // ==========================================
  useEffect(() => {
    async function checkIdentity() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      const { data } = await supabase.from("profiles").select("display_name").eq("id", session.user.id).single();
      if (data && data.display_name) {
        setMakerName(data.display_name);
      }
      setIsAuthChecking(false);
    }
    checkIdentity();
  }, [router]);

  // ==========================================
  // LOGICA: LIVE COÖRDINATEN ZOEKEN 
  // ==========================================
  const verifyLocation = async () => {
    if (!location.trim()) return;
    
    setIsLocating(true);
    setLocationResolved(null);
    
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`, {
        headers: { 'User-Agent': 'Projekster_Network/1.0' } // Voorkomt blokkades door de API provider
      });
      const data = await res.json();
      
      if (data && data.length > 0) {
        setLat(parseFloat(data[0].lat));
        setLng(parseFloat(data[0].lon));
        setLocationResolved(data[0].display_name); 
      } else {
        setLocationResolved("Geen exacte coördinaten gevonden. Radar weergave mogelijk beperkt.");
        setLat(null);
        setLng(null);
      }
    } catch (e) {
      console.error("Fout bij geocoding:", e);
      setLocationResolved("Netwerkfout bij het verifiëren van de locatie.");
    } finally {
      setIsLocating(false);
    }
  };

  // ==========================================
  // LOGICA: FOTO PREVIEW & BEVEILIGING
  // ==========================================
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg("");
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // TOP 1% BEVEILIGING: Limiteer bestandsgrootte op 5MB om vastlopers te voorkomen
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg("Deze foto is te groot. Selecteer een afbeelding van maximaal 5MB.");
        return;
      }
      
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // ==========================================
  // DE INJECTIE (INCLUSIEF LAT/LNG & STORAGE)
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      if (!title || !pillar || !category || !total || !price || !location) {
        throw new Error("Vul alle verplichte velden in, inclusief de ophaallocatie.");
      }

      // Geografie Fallback Check
      let finalLat = lat;
      let finalLng = lng;
      if (!finalLat || !finalLng) {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`, {
          headers: { 'User-Agent': 'Projekster_Network/1.0' }
        });
        const data = await res.json();
        if (data && data.length > 0) {
          finalLat = parseFloat(data[0].lat);
          finalLng = parseFloat(data[0].lon);
        }
      }

      let imageUrl = null;

      // Image upload naar Supabase Storage
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${makerName.replace(/\s+/g, '-').toLowerCase()}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('batch-images').upload(filePath, imageFile);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('batch-images').getPublicUrl(filePath);
        imageUrl = publicUrlData.publicUrl;
      }

      // Payload inclusief de Geografische Wiskunde
      const newBatch = {
        title,
        maker: makerName,
        type: pillar,
        category,
        reserved: 0,
        total: parseInt(total),
        unit,
        location,
        lat: finalLat, 
        lng: finalLng, 
        days_left: parseInt(daysLeft),
        price,
        description,
        rules,
        allows_trade: allowsTrade,
        trade_value: allowsTrade ? tradeValue : null,
        image_url: imageUrl,
      };

      const { error } = await supabase.from("batches").insert([newBatch]);
      
      if (error) throw error;
      
      setIsSuccess(true);
      
    } catch (error: any) {
      console.error("Supabase Error:", error);
      setErrorMsg(error.message || "Er is een fout opgetreden bij het publiceren op de markt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // LAADSCHERMEN & SUCCES UX 
  // ==========================================
  if (isAuthChecking) {
    return (
      <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 uppercase tracking-widest font-bold animate-pulse text-sm">Identiteit verifiëren...</p>
      </main>
    );
  }

  if (isSuccess) {
    return (
      <main className="min-h-[80vh] bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-500">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-400"></div>
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-inner">
            <span className="text-5xl">✨</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-3">Oogst Geregistreerd</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed font-medium">
            Jouw batch is succesvol vastgelegd en direct gekoppeld aan de geografische radar van het netwerk.
          </p>
          <div className="space-y-3">
            <button onClick={() => router.push('/')} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest py-4 rounded-xl transition-all shadow-md">
              Bekijk de Markt
            </button>
            <button onClick={() => { 
              setIsSuccess(false); setTitle(""); setCategory(""); setTotal(""); setPrice(""); setDescription(""); setRules(""); setTradeValue(""); setImageFile(null); setImagePreview(null); setLocation(""); setLat(null); setLng(null); setLocationResolved(null);
            }} className="w-full bg-white hover:bg-slate-50 border-2 border-slate-200 text-slate-600 font-bold py-4 rounded-xl transition-all uppercase tracking-widest text-sm shadow-sm">
              Nog een batch aanmaken
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 py-12 pb-24">
      <div className="max-w-[800px] mx-auto px-4 md:px-6">
        
        <div className="mb-10 text-center md:text-left">
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Nieuwe Batch Aanmaken</h1>
          <p className="text-slate-500 font-medium flex items-center justify-center md:justify-start gap-2 mt-3 text-sm">
            <span>🛡️</span> Geverifieerde Maker: <strong className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{makerName}</strong>
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 text-red-600 border border-red-200 font-medium text-sm flex items-center gap-3 shadow-sm animate-in shake">
            <span>⚠️</span> {errorMsg}
          </div>
        )}

        <form className="space-y-8" onSubmit={handleSubmit}>
          
          {/* SECTIE 1: DE FUNDERING & FOTO */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-sm space-y-8">
            <h2 className="text-xl font-black text-slate-900 border-b border-slate-100 pb-4 flex items-center justify-between">
              1. Wat ga je aanbieden?
            </h2>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                Visueel Bewijs 
                <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[10px]">Max 5MB</span>
              </label>
              <div className="w-full relative">
                {imagePreview ? (
                  <div className="relative w-full h-56 rounded-2xl overflow-hidden border border-slate-200 group shadow-inner">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <label className="bg-white hover:bg-slate-50 text-slate-900 text-sm font-bold py-3 px-6 rounded-xl cursor-pointer transition-all shadow-lg flex items-center gap-2">
                        <span>🔄</span> Wijzig Foto
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 border-dashed rounded-2xl cursor-pointer bg-slate-50 hover:bg-slate-100 hover:border-amber-400 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <span className="text-3xl mb-3 opacity-40 group-hover:opacity-100 transition-opacity group-hover:-translate-y-1 transform duration-300">📸</span>
                      <p className="text-sm text-slate-500 group-hover:text-slate-700 font-medium"><span className="font-bold text-amber-600">Klik om een foto toe te voegen</span> of sleep bestanden hierheen</p>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titel van je Batch *</label>
              <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Hooibalen Eerste Snee (Kruidenrijk)" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-inner" />
            </div>

            <div className="space-y-3 pt-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kies de Hoofdzuil *</label>
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => { setPillar("voedsel"); setCategory(""); }} className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 ${pillar === "voedsel" ? "bg-amber-50 border-amber-500 text-amber-900 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                  <span className="block text-2xl mb-2">🌾</span><span className="font-black tracking-wide">De Provisiekast</span>
                </button>
                <button type="button" onClick={() => { setPillar("grondstof"); setCategory(""); }} className={`p-5 rounded-2xl border-2 text-left transition-all duration-300 ${pillar === "grondstof" ? "bg-slate-800 border-slate-900 text-white shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                  <span className="block text-2xl mb-2">🪵</span><span className="font-black tracking-wide">Het Erf</span>
                </button>
              </div>
            </div>

            {pillar && (
              <div className="space-y-3 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Specifieke Categorie *</label>
                <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer shadow-inner">
                  <option value="" disabled>Kies de juiste rubriek...</option>
                  {CATEGORIE_OPTIES[pillar].map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* SECTIE 2: GEOGRAFIE & CONTEXT */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-sm space-y-8">
            <h2 className="text-xl font-black text-slate-900 border-b border-slate-100 pb-4">2. Geografie & Afhandeling</h2>
            
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex justify-between">
                Ophaallocatie / Regio *
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  required 
                  value={location} 
                  onChange={(e) => {
                    setLocation(e.target.value);
                    setLocationResolved(null);
                    setLat(null);
                    setLng(null);
                  }} 
                  onBlur={verifyLocation}
                  placeholder="Bijv. Schagen, Nederland" 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 px-4 pr-12 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-inner font-medium" 
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isLocating ? (
                    <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin block"></span>
                  ) : lat && lng ? (
                    <span className="text-emerald-500 text-lg">✓</span>
                  ) : (
                    <span className="text-slate-400 text-lg opacity-50">📍</span>
                  )}
                </div>
              </div>
              
              {locationResolved && lat && lng && (
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest mt-2 flex items-center gap-1 animate-in fade-in bg-emerald-50 w-fit px-2 py-1 rounded border border-emerald-100">
                  <span>🛰️</span> Radar Lock: {locationResolved}
                </p>
              )}
              {locationResolved && (!lat || !lng) && (
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-2 flex items-center gap-1 animate-in fade-in bg-amber-50 w-fit px-2 py-1 rounded border border-amber-100">
                  <span>⚠️</span> {locationResolved}
                </p>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Beschrijving (Optioneel)</label>
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vertel het verhaal achter de oogst..." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-inner resize-none" />
            </div>
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Spelregels / Ophaalinformatie</label>
              <textarea rows={2} value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Bijv. Ophalen op zaterdagochtend of neem zelf een aanhanger mee." className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-inner resize-none" />
            </div>
          </div>

          {/* SECTIE 3: VOLUME & PRIJS */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-sm space-y-8">
            <h2 className="text-xl font-black text-slate-900 border-b border-slate-100 pb-4">3. Volume, Waarde & Looptijd</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-5 space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Totaal Aantal *</label>
                <input type="number" required min="1" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Bijv. 20" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-black focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-inner" />
              </div>

              <div className="md:col-span-7 space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Maateenheid *</label>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer shadow-inner">
                  {EENHEDEN.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div className="md:col-span-6 space-y-3 relative">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fiat Waarde *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">€</span>
                  <input type="text" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="5,00 p/stuk" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 pl-8 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-inner" />
                </div>
                <p className="text-[10px] text-slate-500 font-bold tracking-wider pt-1">
                  Jij ontvangt 100%. De koper betaalt een kleine fee.
                </p>
              </div>

              <div className="md:col-span-6 space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Looptijd (Dagen) *</label>
                <select value={daysLeft} onChange={(e) => setDaysLeft(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 appearance-none cursor-pointer shadow-inner">
                  <option value="7">7 dagen (Korte termijn)</option>
                  <option value="14">14 dagen (Standaard)</option>
                  <option value="30">30 dagen (Lange termijn)</option>
                  <option value="60">60 dagen (Seizoensaanbod)</option>
                </select>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100">
              <div className="flex items-center justify-between cursor-pointer group" onClick={() => setAllowsTrade(!allowsTrade)}>
                <div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-amber-600 transition-colors">Ruilen in Natura toestaan?</h3>
                  <p className="text-sm text-slate-500 font-medium mt-1">Accepteer fysieke goederen in plaats van fiat-geld.</p>
                </div>
                <div className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors duration-300 shadow-inner border ${allowsTrade ? "bg-amber-500 border-amber-600" : "bg-slate-200 border-slate-300"}`}>
                  <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform duration-300 ${allowsTrade ? "translate-x-6" : ""}`}></div>
                </div>
              </div>
              {allowsTrade && (
                <div className="mt-6 space-y-3 animate-in fade-in slide-in-from-top-4 duration-300 bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
                  <label className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center gap-2"><span>🔄</span> Wat zoek je in ruil?</label>
                  <input type="text" value={tradeValue} onChange={(e) => setTradeValue(e.target.value)} placeholder="Bijv. Ik zoek voornamelijk brandhout of laswerk" className="w-full bg-white border border-amber-200 rounded-xl p-4 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400 transition-all shadow-sm" />
                </div>
              )}
            </div>
          </div>

          {/* SUBMIT */}
          <div className="pt-4 pb-12">
            <button disabled={isSubmitting || (!lat || !lng && locationResolved !== null)} className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-300 disabled:text-slate-500 text-white font-black uppercase tracking-widest text-lg py-5 rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 flex justify-center items-center">
              {isSubmitting ? (
                <span className="flex items-center gap-3"><span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span> Verwerken...</span>
              ) : "Activeer Oogst op de Radar"}
            </button>
          </div>

        </form>
      </div>
    </main>
  );
}