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
  // LOGICA: LIVE COÖRDINATEN ZOEKEN (NOMINATIM API)
  // ==========================================
  const verifyLocation = async () => {
    if (!location.trim()) return;
    
    setIsLocating(true);
    setLocationResolved(null);
    
    try {
      // Roep de open-source geografische vertaler aan
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        setLat(parseFloat(data[0].lat));
        setLng(parseFloat(data[0].lon));
        setLocationResolved(data[0].display_name); // Toon de exact gevonden naam
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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  // ==========================================
  // DE INJECTIE (NU INCLUSIEF LAT/LNG)
  // ==========================================
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      if (!title || !pillar || !category || !total || !price || !location) {
        throw new Error("Vul alle verplichte velden in, inclusief de ophaallocatie.");
      }

      // Als de locatie nog niet vertaald is (bijv. als de gebruiker heel snel op opslaan klikt),
      // forceren we nog één keer een snelle zoekopdracht.
      let finalLat = lat;
      let finalLng = lng;
      if (!finalLat || !finalLng) {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
        const data = await res.json();
        if (data && data.length > 0) {
          finalLat = parseFloat(data[0].lat);
          finalLng = parseFloat(data[0].lon);
        }
      }

      let imageUrl = null;

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
        lat: finalLat, // De wiskundige X
        lng: finalLng, // De wiskundige Y
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
      setErrorMsg(error.message || "Er is een fout opgetreden bij het opslaan in de kluis.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ==========================================
  // LAADSCHERMEN & SUCCES UX
  // ==========================================
  if (isAuthChecking) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-amber-500 uppercase tracking-widest font-bold animate-pulse">Sleutels verifiëren...</p>
      </main>
    );
  }

  if (isSuccess) {
    return (
      <main className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-emerald-900/50 rounded-2xl p-8 text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-600 to-emerald-400"></div>
          <div className="w-20 h-20 bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-800">
            <span className="text-4xl">✨</span>
          </div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Oogst Geregistreerd</h2>
          <p className="text-slate-400 text-sm mb-8">
            Jouw batch ligt veilig in de kluis en is gekoppeld aan de geografische radar.
          </p>
          <div className="space-y-3">
            <button onClick={() => router.push('/')} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase tracking-widest py-3.5 rounded-lg transition-all shadow-lg">
              Bekijk de Markt
            </button>
            <button onClick={() => { 
              setIsSuccess(false); setTitle(""); setCategory(""); setTotal(""); setPrice(""); setDescription(""); setRules(""); setTradeValue(""); setImageFile(null); setImagePreview(null); setLocation(""); setLat(null); setLng(null); setLocationResolved(null);
            }} className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-bold py-3.5 rounded-lg transition-all">
              Nog een batch aanmaken
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-[800px] mx-auto px-4 md:px-6 py-10 pb-20">
      
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tighter text-white uppercase">Nieuwe Batch Aanmaken</h1>
        <p className="text-slate-400 flex items-center gap-2 mt-2">
          <span>🛡️</span> Geverifieerd als: <strong className="text-amber-500">{makerName}</strong>
        </p>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 text-red-400 border border-red-800 font-medium text-sm flex items-center gap-3">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      <form className="space-y-8" onSubmit={handleSubmit}>
        
        {/* SECTIE 1: DE FUNDERING & FOTO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-4 flex items-center justify-between">
            1. Wat ga je aanbieden?
          </h2>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
              Visueel Bewijs 
              <span className="text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded text-[10px]">Aanbevolen</span>
            </label>
            <div className="w-full relative">
              {imagePreview ? (
                <div className="relative w-full h-48 rounded-xl overflow-hidden border border-slate-700 group">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors border border-slate-600">
                      Wijzig Foto
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-800 border-dashed rounded-xl cursor-pointer bg-slate-950/50 hover:bg-slate-900 hover:border-amber-500/50 transition-all group">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <span className="text-2xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity group-hover:-translate-y-1 transform duration-300">📸</span>
                    <p className="text-sm text-slate-400 group-hover:text-slate-300"><span className="font-bold text-amber-500">Klik om een foto toe te voegen</span> of sleep bestanden hierheen</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titel van je Batch *</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bijv. Hooibalen Eerste Snee (Kruidenrijk)" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 transition-colors" />
          </div>

          <div className="space-y-2 pt-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Kies de Hoofdzuil *</label>
            <div className="grid grid-cols-2 gap-4">
              <button type="button" onClick={() => { setPillar("voedsel"); setCategory(""); }} className={`p-4 rounded-xl border text-left transition-all ${pillar === "voedsel" ? "bg-amber-600/10 border-amber-500 text-white shadow-inner" : "bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                <span className="block text-xl mb-1">🌾</span><span className="font-bold">De Provisiekast</span>
              </button>
              <button type="button" onClick={() => { setPillar("grondstof"); setCategory(""); }} className={`p-4 rounded-xl border text-left transition-all ${pillar === "grondstof" ? "bg-slate-700 border-slate-400 text-white shadow-inner" : "bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500"}`}>
                <span className="block text-xl mb-1">🪵</span><span className="font-bold">Het Erf</span>
              </button>
            </div>
          </div>

          {pillar && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-4 duration-300">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Specifieke Categorie *</label>
              <select required value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 appearance-none cursor-pointer">
                <option value="" disabled>Kies de juiste rubriek...</option>
                {CATEGORIE_OPTIES[pillar].map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* SECTIE 2: GEOGRAFIE & CONTEXT */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-4">2. Geografie & Afhandeling</h2>
          
          <div className="space-y-2">
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
                onBlur={verifyLocation} // TOP 1% UX: Zoekt automatisch bij het verlaten van het veld
                placeholder="Bijv. Schagen, Nederland" 
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-4 px-4 pr-12 text-white focus:outline-none focus:border-amber-500 transition-colors" 
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                {isLocating ? (
                  <span className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin block"></span>
                ) : lat && lng ? (
                  <span className="text-emerald-500 text-lg">✓</span>
                ) : (
                  <span className="text-slate-600 text-lg">📍</span>
                )}
              </div>
            </div>
            
            {/* Respons-bericht van de Geografische Radar */}
            {locationResolved && lat && lng && (
              <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1 animate-in fade-in">
                <span>🛰️</span> Radar Lock: {locationResolved}
              </p>
            )}
            {locationResolved && (!lat || !lng) && (
              <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest mt-2 flex items-center gap-1 animate-in fade-in">
                <span>⚠️</span> {locationResolved}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Beschrijving (Optioneel)</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vertel het verhaal achter de oogst..." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Spelregels / Ophaalinformatie</label>
            <textarea rows={2} value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Bijv. Ophalen op zaterdagochtend." className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 transition-colors" />
          </div>
        </div>

        {/* SECTIE 3: VOLUME & PRIJS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-4">3. Volume, Waarde & Looptijd</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Totaal Aantal *</label>
              <input type="number" required min="1" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="Bijv. 20" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 transition-colors" />
            </div>

            <div className="md:col-span-7 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Maateenheid *</label>
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 appearance-none cursor-pointer">
                {EENHEDEN.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="md:col-span-6 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Fiat Waarde (Prijs) *</label>
              <input type="text" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Bijv. € 5,- p/stuk" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 transition-colors" />
            </div>

            <div className="md:col-span-6 space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Looptijd (Dagen) *</label>
              <select value={daysLeft} onChange={(e) => setDaysLeft(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 appearance-none cursor-pointer">
                <option value="7">7 dagen (Korte termijn)</option>
                <option value="14">14 dagen (Standaard)</option>
                <option value="30">30 dagen (Lange termijn)</option>
                <option value="60">60 dagen (Seizoensaanbod)</option>
              </select>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setAllowsTrade(!allowsTrade)}>
              <div>
                <h3 className="text-lg font-bold text-white">Ruilen in Natura toestaan?</h3>
                <p className="text-sm text-slate-400">Accepteer goederen in plaats van fiat-geld.</p>
              </div>
              <div className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors ${allowsTrade ? "bg-amber-600" : "bg-slate-700"}`}>
                <div className={`bg-white w-6 h-6 rounded-full shadow-md transform transition-transform ${allowsTrade ? "translate-x-6" : ""}`}></div>
              </div>
            </div>
            {allowsTrade && (
              <div className="mt-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <label className="text-xs font-bold text-amber-500 uppercase tracking-widest">Wat zoek je in ruil?</label>
                <input type="text" value={tradeValue} onChange={(e) => setTradeValue(e.target.value)} placeholder="Bijv. Ik zoek voornamelijk brandhout of laswerk" className="w-full bg-slate-950 border border-amber-600/50 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
            )}
          </div>
        </div>

        {/* SUBMIT */}
        <div className="pt-2">
          <button disabled={isSubmitting} className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white font-black uppercase tracking-widest text-lg py-5 rounded-xl transition-all duration-300 shadow-xl shadow-amber-900/20 flex justify-center items-center">
            {isSubmitting ? "Data versleutelen en opslaan..." : "Activeer Batch op de Marktplaats"}
          </button>
        </div>

      </form>
    </main>
  );
}