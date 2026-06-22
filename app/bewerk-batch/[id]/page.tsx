"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "../../utils/supabase";

const CATEGORIE_OPTIES = {
  voedsel: ["Vlees & Vis", "Zuivel & Eieren", "Groente & Fruit", "Graan & Meel", "Dranken & Conserven", "Honing & Zoet"],
  grondstof: ["Brandhout & Pellets", "Veevoer, Hooi & Stro", "Planten & Zaden", "Mest & Compost", "Levend Vee", "Werktuigen & Machines", "Off-Grid & Energie", "Bouwmateriaal"]
};

const EENHEDEN = ["Stuks", "Kilogram (kg)", "Liter (L)", "Kuub (m³)", "Kist/Krat", "Bos/Bussel", "Pallet"];

export default function BewerkBatch() {
  const router = useRouter();
  const params = useParams();
  
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentReserved, setCurrentReserved] = useState(0);

  // Formulier Data
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
  
  // Geografie & Foto
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationResolved, setLocationResolved] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // 1. Data Inladen & Identiteit Checken
  useEffect(() => {
    async function fetchBatchData() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      try {
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session.user.id).single();
        const makerName = profile?.display_name;

        const { data: batch, error } = await supabase.from("batches").select("*").eq("id", params.id).single();
        if (error || !batch) throw new Error("Batch niet gevonden.");

        // Beveiliging: Alleen de originele maker mag deze pagina openen
        if (batch.maker !== makerName) {
          router.push("/dashboard");
          return;
        }

        // Velden vullen
        setTitle(batch.title);
        setPillar(batch.type as "voedsel" | "grondstof");
        setCategory(batch.category);
        setTotal(batch.total.toString());
        setUnit(batch.unit || "Stuks");
        setPrice(batch.price);
        setDescription(batch.description || "");
        setRules(batch.rules || "");
        setAllowsTrade(batch.allows_trade);
        setTradeValue(batch.trade_value || "");
        setDaysLeft(batch.days_left.toString());
        setLocation(batch.location || "");
        setLat(batch.lat);
        setLng(batch.lng);
        setExistingImageUrl(batch.image_url);
        setCurrentReserved(batch.reserved);

      } catch (error) {
        console.error("Fout bij laden batch:", error);
        router.push("/dashboard");
      } finally {
        setIsAuthChecking(false);
      }
    }

    if (params.id) fetchBatchData();
  }, [params.id, router]);

  const verifyLocation = async () => {
    if (!location.trim()) return;
    setIsLocating(true);
    setLocationResolved(null);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        setLat(parseFloat(data[0].lat));
        setLng(parseFloat(data[0].lon));
        setLocationResolved(data[0].display_name);
      } else {
        setLocationResolved("Geen exacte coördinaten gevonden.");
      }
    } catch (e) {
      console.error(e);
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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const totalNum = parseInt(total);
      
      // LOGICA SAFEGUARD: Totaal mag nooit lager zijn dan wat al gereserveerd is!
      if (totalNum < currentReserved) {
        throw new Error(`Je kunt de voorraad niet verlagen naar ${totalNum}. Er zijn al ${currentReserved} eenheden gereserveerd door kopers.`);
      }

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

      let imageUrl = existingImageUrl;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `updates/${fileName}`;

        const { error: uploadError } = await supabase.storage.from('batch-images').upload(filePath, imageFile);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('batch-images').getPublicUrl(filePath);
        imageUrl = publicUrlData.publicUrl;
      }

      const updatedBatch = {
        title,
        type: pillar,
        category,
        total: totalNum,
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

      const { error } = await supabase.from("batches").update(updatedBatch).eq("id", params.id);
      if (error) throw error;
      
      router.push("/dashboard");
      
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || "Fout bij updaten van de kluis.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isAuthChecking) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-amber-500 uppercase tracking-widest font-bold animate-pulse">Sleutels verifiëren...</p>
      </main>
    );
  }

  return (
    <main className="max-w-[800px] mx-auto px-4 md:px-6 py-10 pb-20">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase">Batch Aanpassen</h1>
          <p className="text-slate-400 mt-2">Breng wijzigingen aan in je live aanbod.</p>
        </div>
        <button onClick={() => router.push('/dashboard')} className="text-xs font-bold text-slate-500 hover:text-white uppercase tracking-widest">
          Annuleren
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 text-red-400 border border-red-800 font-medium text-sm flex items-center gap-3">
          <span>⚠️</span> {errorMsg}
        </div>
      )}

      {currentReserved > 0 && (
        <div className="mb-6 p-5 rounded-xl bg-amber-900/20 border border-amber-900/50 text-amber-500 text-sm">
          <p className="font-bold mb-1 flex items-center gap-2"><span>🔒</span> Voorraad Vergrendeld</p>
          <p className="text-amber-500/80">Omdat er al <strong>{currentReserved} eenheden</strong> zijn geclaimd door kopers, kun je het totaal aantal niet lager zetten dan {currentReserved}.</p>
        </div>
      )}

      <form className="space-y-8" onSubmit={handleUpdate}>
        
        {/* SECTIE 1: DE FUNDERING & FOTO */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-4">1. Wat ga je aanbieden?</h2>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Visueel Bewijs</label>
            <div className="w-full relative">
              {imagePreview || existingImageUrl ? (
                <div className="relative w-full h-48 rounded-xl overflow-hidden border border-slate-700 group">
                  <img src={imagePreview || existingImageUrl || ""} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold py-2 px-4 rounded-lg cursor-pointer transition-colors border border-slate-600">
                      Vervang Foto
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-800 border-dashed rounded-xl cursor-pointer bg-slate-950/50 hover:bg-slate-900 hover:border-amber-500/50 transition-all group">
                  <span className="text-2xl mb-2 opacity-50 group-hover:opacity-100 transition-opacity">📸</span>
                  <p className="text-sm text-slate-400 group-hover:text-slate-300"><span className="font-bold text-amber-500">Klik om een foto toe te voegen</span></p>
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                </label>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Titel van je Batch</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500" />
          </div>
        </div>

        {/* SECTIE 2: GEOGRAFIE & CONTEXT */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-4">2. Geografie & Afhandeling</h2>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ophaallocatie</label>
            <input type="text" required value={location} onChange={(e) => { setLocation(e.target.value); setLocationResolved(null); setLat(null); setLng(null); }} onBlur={verifyLocation} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Beschrijving</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Spelregels</label>
            <textarea rows={2} value={rules} onChange={(e) => setRules(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500" />
          </div>
        </div>

        {/* SECTIE 3: VOLUME & PRIJS */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
          <h2 className="text-xl font-bold text-white border-b border-slate-800 pb-4">3. Volume & Waarde</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Totaal Aantal (Minimaal {currentReserved})</label>
              <input type="number" required min={Math.max(1, currentReserved)} value={total} onChange={(e) => setTotal(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Prijs</label>
              <input type="text" required value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-white focus:outline-none focus:border-amber-500" />
            </div>
          </div>
        </div>

        <button disabled={isSubmitting} className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 text-white font-black uppercase tracking-widest py-5 rounded-xl transition-all shadow-xl">
          {isSubmitting ? "Wijzigingen Versleutelen..." : "Opslaan & Updaten"}
        </button>

      </form>
    </main>
  );
}