import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Navbar from "./components/Navbar";
import PWARegistrar from "./components/PWARegistrar";
import Image from "next/image";

// We gebruiken Inter voor een superstrakke, universele en zakelijke typografie
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Projekster | De Vrije Markt",
  description: "De directe verbinding tussen vrije boeren, makers en de lokale gemeenschap. Elimineer de supermarkt. Herwin je waarde.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Projekster",
  },
  openGraph: {
    title: "Projekster | De Vrije Markt",
    description: "Lokaal verbouwd, direct geleverd. Herwin je waarde op de vrije markt.",
    url: "https://projekster.com",
    siteName: "Projekster",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Projekster Marktplaats",
      },
    ],
    locale: "nl_NL",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Projekster | Vrije Handel",
    description: "Elimineer de tussenlaag. Verbind direct met lokale makers.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff", // Heldere, schone statusbar op mobiel
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full antialiased scroll-smooth">
      <body className={`${inter.className} min-h-full flex flex-col bg-slate-50 text-slate-900 selection:bg-amber-100 selection:text-amber-900`}>
        
        {/* De onzichtbare PWA motor */}
        <PWARegistrar />
        
        {/* De Navigatiebalk */}
        <Navbar />

        {/* Het centrale canvas */}
        <main className="flex-grow flex flex-col">
          {children}
        </main>

        {/* De Gezuiverde Footer: Rustig, overzichtelijk, institutioneel */}
        <footer className="w-full border-t border-slate-200 bg-white pt-16 pb-12 mt-auto">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8 mb-12 border-b border-slate-100 pb-12">
              
              <div className="md:col-span-2 space-y-4">
                <Link href="/" className="inline-flex items-center gap-3 group">
                  <Image 
                    src="/icon-192x192.png" 
                    alt="Projekster Logo" 
                    width={32} 
                    height={32} 
                    className="rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-105" 
                  />
                  <span className="text-xl font-black tracking-tight text-slate-900 uppercase">Projekster</span>
                </Link>
                <p className="text-slate-500 text-sm leading-relaxed max-w-sm font-normal">
                  De onafhankelijke infrastructuur voor directe handel. Wij faciliteren de frictieloze verbinding tussen de vrije producent en de bewuste burger. Transparant, lokaal en soeverein.
                </p>
              </div>

              <div>
                <h4 className="text-slate-900 font-bold uppercase tracking-wider text-xs mb-4">De Markt</h4>
                <ul className="space-y-3 text-sm font-medium">
                  <li><Link href="/#aanbod" className="text-slate-500 hover:text-amber-600 transition-colors">Actueel Aanbod</Link></li>
                  <li><Link href="/maak-batch" className="text-slate-500 hover:text-amber-600 transition-colors">+ Oogst Aanbieden</Link></li>
                  <li><Link href="#" className="text-slate-500 hover:text-amber-600 transition-colors">Hoe Ruilhandel Werkt</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-slate-900 font-bold uppercase tracking-wider text-xs mb-4">Netwerk</h4>
                <ul className="space-y-3 text-sm font-medium">
                  <li><Link href="/dashboard" className="text-slate-500 hover:text-amber-600 transition-colors">Mijn Kluis</Link></li>
                  <li><Link href="#" className="text-slate-500 hover:text-amber-600 transition-colors">Verificatieproces</Link></li>
                  <li><Link href="#" className="text-slate-500 hover:text-amber-600 transition-colors">Ons Manifest</Link></li>
                </ul>
              </div>

            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-400 font-medium">
              <p>&copy; {new Date().getFullYear()} Projekster Netwerk. Alle rechten voorbehouden aan de makers.</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span> 
                  Netwerk Status: Actief & Stabiel
                </span>
              </div>
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}