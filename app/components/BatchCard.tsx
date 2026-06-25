import Link from "next/link";
import Image from "next/image";

// ==========================================
// 1. DE BLAUWDRUK (Inclusief Prijs & Ruil)
// ==========================================
interface BatchCardProps {
  id: string;
  title: string;
  maker: string;
  reserved: number;
  total: number;
  category: string;
  daysLeft: number;    
  price?: string;          // NIEUW: Direct de prijs tonen
  allows_trade?: boolean;  // NIEUW: Visuele indicator voor ruilen
  image_url?: string;
  location?: string;
  unit?: string;
  distance?: number;   
  created_at?: string; 
}

export default function BatchCard({ 
  id, title, maker, reserved, total, category, daysLeft, price, allows_trade, image_url, location, unit, distance, created_at
}: BatchCardProps) {
  
  // ==========================================
  // LOGICA 1: DE LIVE TIMER & VERLOOP-STATUS
  // ==========================================
  let isExpired = false;
  let actualDaysLeft = daysLeft;

  if (created_at) {
    const createdDate = new Date(created_at);
    const expiryDate = new Date(createdDate.getTime() + daysLeft * 24 * 60 * 60 * 1000);
    const diffTime = expiryDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      isExpired = true;
      actualDaysLeft = 0;
    } else {
      actualDaysLeft = diffDays;
    }
  }

  // ==========================================
  // LOGICA 2: DATA FORMATTERING & STATUSSEN
  // ==========================================
  const isSoldOut = reserved >= total;
  const isDisabled = isExpired || isSoldOut;
  const percentage = Math.min((reserved / total) * 100, 100);
  
  const isFood = ["Vlees & Vis", "Zuivel & Eieren", "Groente & Fruit", "Graan & Meel", "Dranken & Conserven", "Honing & Zoet"].includes(category);
  const fallbackEmoji = isFood ? "🌾" : "🪵";

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <Link href={`/batch/${id}`} className={`block group h-full ${isDisabled ? 'cursor-not-allowed' : ''}`}>
      <div className={`bg-white border ${isDisabled ? 'border-slate-200 bg-slate-50/50' : 'border-slate-200 hover:border-amber-300'} rounded-2xl overflow-hidden transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 flex flex-col h-full relative`}>
        
        {/* BOVENKANT: VISUEEL BEWIJS & BADGES */}
        <div className="h-48 w-full relative bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100">
          
          {image_url ? (
            <Image 
              src={image_url} 
              alt={title} 
              fill
              unoptimized={true} 
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
              className={`object-cover transition-transform duration-700 ${isDisabled ? 'grayscale-[0.5] opacity-80' : 'group-hover:scale-105'}`} 
            />
          ) : (
            <span className={`text-6xl relative z-10 transition-transform duration-300 drop-shadow-sm ${isDisabled ? 'grayscale-[0.5] opacity-60' : 'group-hover:scale-110'}`}>
              {fallbackEmoji}
            </span>
          )}
          
          <div className="absolute top-3 left-3 z-20">
            <span className="bg-white/95 backdrop-blur-md text-slate-900 border border-slate-200 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest shadow-sm">
              {category}
            </span>
          </div>

          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2 items-end">
            {isSoldOut ? (
              <span className="bg-slate-900/95 backdrop-blur-md border border-slate-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md shadow-sm">
                🔒 Uitverkocht
              </span>
            ) : isExpired ? (
              <span className="bg-red-50/95 backdrop-blur-md border border-red-200 text-red-700 text-[9px] font-black uppercase tracking-widest px-2 py-1.5 rounded-md shadow-sm flex items-center gap-1">
                🚨 Verlopen
              </span>
            ) : (
              <span className="bg-white/95 backdrop-blur-md border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest px-2 py-1.5 rounded-md shadow-sm flex items-center gap-1">
                ⏳ {actualDaysLeft}d
              </span>
            )}
          </div>
        </div>

        {/* ONDERKANT: DATA & CONVERSIE METERS */}
        <div className="p-5 flex flex-col flex-grow">
          
          <div className="flex justify-between items-start gap-2 mb-3">
            <h3 className={`text-lg font-black leading-tight transition-colors line-clamp-2 ${isDisabled ? 'text-slate-500' : 'text-slate-900 group-hover:text-amber-600'}`}>
              {title}
            </h3>
          </div>
          
          <div className="text-xs text-slate-600 font-medium mb-5 space-y-2.5">
            <p className="flex items-center gap-2">
              <span className="text-sm">👨‍🌾</span> <span className="truncate text-slate-900 font-bold">{maker}</span>
            </p>
            {location && (
              <div className="flex items-center gap-2">
                <span className="text-sm">📍</span> 
                <span className="truncate flex items-center text-slate-500">
                  {location} 
                  {distance !== undefined && (
                    <span className="ml-2 text-amber-700 font-black tracking-widest bg-amber-50 px-2 py-0.5 rounded shadow-sm border border-amber-200 text-[9px] uppercase">
                      {formatDistance(distance)}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100">
            {/* PRIJS & RUIL INDICATOR */}
            <div className="flex justify-between items-center mb-4">
               {price ? (
                 <span className={`text-lg font-black ${isDisabled ? 'text-slate-400' : 'text-slate-900'}`}>{price}</span>
               ) : (
                 <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Waarde Onbekend</span>
               )}
               {allows_trade && (
                 <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded border shadow-sm flex items-center gap-1 ${isDisabled ? 'bg-slate-50 text-slate-400 border-slate-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                   <span>🔄</span> Ruilen
                 </span>
               )}
            </div>

            {/* VOORRAAD BALK */}
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gereserveerd</span>
              <span className={`text-sm font-black ${isSoldOut ? 'text-slate-400' : 'text-amber-600'}`}>
                {reserved} <span className="text-xs text-slate-400 font-bold">/ {total} <span className="uppercase text-[9px] tracking-wider">{unit || ""}</span></span>
              </span>
            </div>
            
            <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden shadow-inner p-[1px]">
              <div 
                className={`h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden ${isDisabled ? 'bg-slate-300' : 'bg-gradient-to-r from-amber-500 to-amber-400'}`}
                style={{ width: `${percentage}%` }}
              >
                {!isDisabled && <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>}
              </div>
            </div>
          </div>

        </div>
      </div>
    </Link>
  );
}