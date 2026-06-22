import Link from "next/link";
import Image from "next/image"; // <-- De Top 1% Compressie Engine

// ==========================================
// 1. DE BLAUWDRUK (Inclusief Radar & Expiration)
// ==========================================
interface BatchCardProps {
  id: string;
  title: string;
  maker: string;
  reserved: number;
  total: number;
  category: string;
  daysLeft: number;    // Dit is de originele looptijd (bijv. 7 of 14)
  image_url?: string;
  location?: string;
  unit?: string;
  distance?: number;   // Wiskundige afstand van de radar
  created_at?: string; // Optioneel de aanmaakdatum doorgeven voor de live timer
}

export default function BatchCard({ 
  id, title, maker, reserved, total, category, daysLeft, image_url, location, unit, distance, created_at
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
  // LOGICA 2: DATA FORMATTERING
  // ==========================================
  const percentage = Math.min((reserved / total) * 100, 100);
  const isFood = ["Vlees & Vis", "Zuivel & Eieren", "Groente & Fruit", "Graan & Meel", "Dranken & Conserven", "Honing & Zoet"].includes(category);
  const fallbackEmoji = isFood ? "🌾" : "🪵";

  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };

  return (
    <Link href={`/batch/${id}`} className="block group h-full">
      <div className={`bg-slate-900 border ${isExpired ? 'border-red-900/30 opacity-75 grayscale-[0.5]' : 'border-slate-800 hover:border-amber-500/50'} rounded-2xl overflow-hidden transition-all duration-300 shadow-lg hover:shadow-amber-900/20 flex flex-col h-full relative`}>
        
        {/* BOVENKANT: VISUEEL BEWIJS & BADGES */}
        <div className="h-44 w-full relative bg-slate-950 flex items-center justify-center overflow-hidden">
          
          {image_url ? (
            // De Grote Upgrade: Next.js Image met automatische WebP compressie
            <Image 
              src={image_url} 
              alt={title} 
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
              className={`object-cover transition-transform duration-700 ${isExpired ? '' : 'group-hover:scale-105'}`} 
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-800/50 to-slate-950"></div>
              <span className={`text-5xl relative z-10 transition-transform duration-300 drop-shadow-xl ${isExpired ? '' : 'group-hover:scale-110'}`}>
                {fallbackEmoji}
              </span>
            </>
          )}
          
          <div className="absolute top-3 left-3 z-20">
            <span className="bg-amber-600/90 backdrop-blur-md text-white text-[10px] font-black px-3 py-1.5 rounded-md uppercase tracking-widest shadow-lg">
              {category}
            </span>
          </div>

          <div className="absolute top-3 right-3 z-20">
            {isExpired ? (
              <span className="bg-red-900/90 backdrop-blur-md border border-red-700 text-red-100 text-[9px] font-bold px-2 py-1.5 rounded-md shadow-lg flex items-center gap-1 animate-pulse">
                🚨 Verlopen (Wacht op afronding)
              </span>
            ) : (
              <span className="bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-300 text-[10px] font-bold px-2 py-1.5 rounded-md shadow-lg flex items-center gap-1">
                ⏳ {actualDaysLeft}d
              </span>
            )}
          </div>
        </div>

        {/* ONDERKANT: DATA & CONVERSIE METERS */}
        <div className="p-5 flex flex-col flex-grow">
          <h3 className={`text-lg font-black leading-tight mb-2 transition-colors line-clamp-2 ${isExpired ? 'text-slate-400' : 'text-white group-hover:text-amber-500'}`}>
            {title}
          </h3>
          
          <div className="text-xs text-slate-500 font-medium mb-5 space-y-2">
            <p className="flex items-center gap-2">
              <span className="text-sm">👨‍🌾</span> <span className="truncate text-slate-300 font-bold">{maker}</span>
            </p>
            {location && (
              <div className="flex items-center gap-2">
                <span className="text-sm">📍</span> 
                <span className="truncate text-slate-400">
                  {location} 
                  {distance !== undefined && (
                    <span className="ml-2 text-amber-500 font-black tracking-widest bg-amber-500/10 px-2 py-0.5 rounded shadow-sm border border-amber-500/20">
                      {formatDistance(distance)}
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-800/60">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Gereserveerd</span>
              <span className="text-sm font-black text-amber-500">
                {reserved} <span className="text-xs text-slate-500 font-bold">/ {total} <span className="uppercase text-[9px] tracking-wider">{unit || ""}</span></span>
              </span>
            </div>
            
            <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden shadow-inner border border-slate-800/80 p-[1px]">
              <div 
                className={`h-full rounded-full transition-all duration-700 ease-out relative overflow-hidden ${isExpired ? 'bg-slate-700' : 'bg-gradient-to-r from-amber-600 to-amber-400'}`}
                style={{ width: `${percentage}%` }}
              >
                {!isExpired && <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>}
              </div>
            </div>
          </div>

        </div>
      </div>
    </Link>
  );
}