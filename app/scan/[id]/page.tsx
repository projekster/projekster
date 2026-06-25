"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Scanner } from "@yudiel/react-qr-scanner";
import { supabase } from "../../utils/supabase";

export default function ScanPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;

  // States voor Scanner & Transactie
  const [manualCode, setManualCode] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [cameraActive, setCameraActive] = useState(true);

  // States voor Order Context
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [isLoadingContext, setIsLoadingContext] = useState(true);

  // ==========================================
  // 1. HAAL CONTEXT OP (Voorkomt blinde scans)
  // ==========================================
  useEffect(() => {
    async function fetchOrderContext() {
      if (!orderId) return;
      try {
        const { data, error } = await supabase
          .from("orders")
          .select("batch_title, buyer_name, amount, escrow_status")
          .eq("id", orderId)
          .single();
          
        if (error) throw error;
        setOrderDetails(data);

        // Als de order al is vrijgegeven, direct naar succes scherm
        if (data.escrow_status === "released") {
          setSuccess(true);
          setCameraActive(false);
        }
      } catch (error) {
        console.error("Kon order niet vinden:", error);
        setErrorMsg("Ordergegevens konden niet worden geladen.");
      } finally {
        setIsLoadingContext(false);
      }
    }
    fetchOrderContext();
  }, [orderId]);

  // ==========================================
  // 2. SCAN & VERIFICATIE LOGICA
  // ==========================================
  const handleScan = async (detectedCode: string) => {
    if (isProcessing || success) return;
    setCameraActive(false); // Blokkeer de camera direct om dubbele calls te voorkomen
    processRelease(detectedCode);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim() || isProcessing) return;
    processRelease(manualCode.trim().toUpperCase());
  };

  const processRelease = async (code: string) => {
    setIsProcessing(true);
    setErrorMsg("");

    try {
      const response = await fetch("/api/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, qrCode: code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Fout bij communicatie met het netwerk.");
      }

      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(err.message);
      setCameraActive(true); // Activeer vizier weer als de code fout was
    } finally {
      setIsProcessing(false);
    }
  };

  // ==========================================
  // VIEW 1: LAADSCHERM
  // ==========================================
  if (isLoadingContext) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-emerald-500 font-bold uppercase tracking-widest text-xs animate-pulse">Beveiligde omgeving laden...</p>
      </main>
    );
  }

  // ==========================================
  // VIEW 2: SUCCES SCHERM (Geld is overgemaakt)
  // ==========================================
  if (success) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border-2 border-emerald-500 rounded-3xl p-8 md:p-12 max-w-md w-full shadow-[0_20px_60px_-15px_rgba(16,185,129,0.3)] text-center animate-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center text-5xl mx-auto mb-6 shadow-inner border border-emerald-100">
            ✅
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight mb-2">Geld Vrijgegeven!</h1>
          <p className="text-slate-600 font-medium mb-8 leading-relaxed">
            De code is geverifieerd. 100% van het afgesproken bedrag is direct uit de Projekster Escrow naar je bankrekening overgemaakt. 
            <br/><br/>Je kunt de goederen nu met een gerust hart overhandigen.
          </p>
          <button 
            onClick={() => router.push("/dashboard")} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black uppercase tracking-widest py-4 rounded-xl shadow-md transition-all"
          >
            Terug naar Mijn Handel
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // VIEW 3: SCANNER & VIZIER
  // ==========================================
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col">
      
      {/* HEADER TACTICAL */}
      <div className="p-4 md:p-6 flex items-center justify-between border-b border-slate-800 bg-slate-950/80 backdrop-blur-md z-10 sticky top-0">
        <h1 className="text-lg font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2 drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]">
          <span>📷</span> Koper Verifiëren
        </h1>
        <Link href="/dashboard" className="text-xs font-bold text-slate-400 hover:text-white uppercase tracking-widest bg-slate-800 hover:bg-slate-700 px-5 py-2.5 rounded-lg transition-colors">
          Afbreken
        </Link>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center p-4 max-w-md mx-auto w-full">
        
        {/* ORDER CONTEXT */}
        <div className="text-center mb-6 w-full">
          <h2 className="text-2xl font-black uppercase tracking-tight text-white mb-3">Scan Afhaalbewijs</h2>
          
          {orderDetails ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 inline-block text-left shadow-lg w-full max-w-sm">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Je staat op het punt te leveren aan:</p>
              <p className="text-emerald-400 font-black mb-2 text-lg">{orderDetails.buyer_name}</p>
              <p className="text-sm font-medium text-slate-300">
                Oogst: <strong className="text-white">{orderDetails.batch_title}</strong>
              </p>
              <p className="text-sm font-medium text-slate-300">
                Aantal: <strong className="text-white">{orderDetails.amount} eenheden</strong>
              </p>
            </div>
          ) : (
             <p className="text-slate-400 text-sm font-medium">Vraag de koper om de QR-code in zijn dashboard te openen.</p>
          )}
        </div>

        {/* CAMERA VIEWPORT MET VIZIER */}
        <div className="w-full aspect-square bg-black rounded-3xl overflow-hidden border-4 border-slate-800 relative shadow-2xl mb-8">
          {cameraActive ? (
            <Scanner 
              onScan={(result) => handleScan(result[0].rawValue)} 
              onError={(error) => console.log("Camera error:", error?.message)}
              components={{ finder: false }} 
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-50">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-emerald-500 font-bold uppercase tracking-widest text-xs animate-pulse">Code ontcijferen & Netwerk verifiëren...</p>
            </div>
          )}
          
          {/* Donkere overlay randen */}
          <div className="absolute inset-0 pointer-events-none border-[50px] border-black/50 z-20"></div>
          
          {/* Het Sniper Vizier */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-30">
            <div className="w-48 h-48 border-2 border-emerald-500/30 rounded-xl relative shadow-[0_0_30px_rgba(16,185,129,0.2)]">
               <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
               <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
               <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
               <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>
               {/* De rode laserscanner lijn */}
               {cameraActive && <div className="absolute top-0 left-0 w-full h-0.5 bg-red-500 shadow-[0_0_10px_red] opacity-60 animate-[scan_2s_ease-in-out_infinite]"></div>}
            </div>
          </div>
        </div>

        {/* FOUTMELDING */}
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 w-full p-4 rounded-xl text-center text-sm font-bold mb-6 animate-in shake shadow-lg">
            ❌ {errorMsg}
          </div>
        )}

        {/* HANDMATIGE INVOER (Fallback) */}
        <div className="w-full bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mb-3 text-center">Lukt scannen niet?</p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input 
              type="text" 
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="VUL DE 6-CIJFERIGE CODE IN"
              maxLength={6}
              disabled={isProcessing}
              className="w-2/3 bg-black border border-slate-700 rounded-xl px-4 text-center text-lg font-black tracking-[0.2em] text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase transition-colors"
            />
            <button 
              type="submit"
              disabled={isProcessing || manualCode.length < 6}
              className="w-1/3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold uppercase tracking-widest text-xs rounded-xl shadow-md transition-colors"
            >
              Check
            </button>
          </form>
        </div>
        
        <p className="text-[10px] text-slate-500 font-medium mt-8 text-center max-w-xs leading-relaxed">
          Controleer altijd of de goederen fysiek in orde zijn voordat je de scan uitvoert. Na de scan is de betaling definitief en onomkeerbaar.
        </p>

      </div>
    </main>
  );
}