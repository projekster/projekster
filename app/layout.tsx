import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import Navbar from "./components/Navbar";
import PWARegistrar from "./components/PWARegistrar"; // <-- De Ontstekingsmodule

const geistSans = Geist({
  variable: "--font-slate-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-slate-mono",
  subsets: ["latin"],
});

// =======================================
// DE VIRAL/PWA META-DATA (HET GLOBALE VANGNET)
// =======================================
export const metadata: Metadata = {
  title: "Projekster | Onafhankelijke Oogst. Vrije Handel.",
  description: "De directe verbinding tussen vrije boeren, makers en de lokale gemeenschap. Elimineer de supermarkt. Herwin je waarde.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Projekster",
  },
  // De tags die WhatsApp, Telegram, Facebook en Twitter standaard uitlezen:
  openGraph: {
    title: "Projekster | De Vrije Markt",
    description: "Lokaal verbouwd, direct geleverd. Herwin je waarde op de vrije markt.",
    url: "https://projekster.com", // Straks vervangen door je echte domein
    siteName: "Projekster",
    images: [
      {
        url: "/og-image.png", // De standaard foto voor de homepagina
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
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
  }
};

export const viewport: Viewport = {
  themeColor: "#0f172a", // Maakt de randen van de telefoon strak donker
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // Voorkomt inzoomen bij typen op iPhones
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 selection:bg-amber-500/30 selection:text-amber-100" suppressHydrationWarning>
        
        {/* De onzichtbare motor voor de native app installatie */}
        <PWARegistrar />
        
        <Navbar />

        <main className="flex-grow flex flex-col">
          {children}
        </main>

        <footer className="w-full border-t border-slate-900 bg-black pt-16 pb-8 mt-auto">
          <div className="max-w-[1400px] mx-auto px-4 md:px-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-6 mb-12 border-b border-slate-900 pb-12">
              
              <div className="md:col-span-2 space-y-4">
                <Link href="/" className="text-2xl font-black tracking-tighter text-white uppercase flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
                  <span className="bg-slate-800 text-white w-6 h-6 flex items-center justify-center rounded text-xs">P</span>
                  Projekster.
                </Link>
                <p className="text-slate-500 text-sm leading-relaxed max-w-sm">
                  De infrastructuur voor een parallelle economie. Wij faciliteren de directe handel tussen de vrije producent en de autonome burger. Geen tussenpartijen, geen fiat-verplichting, absolute soevereiniteit.
                </p>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-4">De Markt</h4>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li><Link href="/" className="hover:text-amber-500 transition-colors">Actueel Aanbod</Link></li>
                  <li><Link href="/maak-batch" className="hover:text-amber-500 transition-colors">Zelf Aanbieden</Link></li>
                  <li><Link href="#" className="hover:text-amber-500 transition-colors">Hoe Ruilhandel Werkt</Link></li>
                </ul>
              </div>

              <div>
                <h4 className="text-white font-bold uppercase tracking-widest text-xs mb-4">Netwerk</h4>
                <ul className="space-y-2 text-sm text-slate-500">
                  <li><Link href="/dashboard" className="hover:text-amber-500 transition-colors">Mijn Kluis</Link></li>
                  <li><Link href="#" className="hover:text-amber-500 transition-colors">Verificatieproces</Link></li>
                  <li><Link href="#" className="hover:text-amber-500 transition-colors">Manifest</Link></li>
                </ul>
              </div>

            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-slate-600 font-medium">
              <p>&copy; {new Date().getFullYear()} Projekster Netwerk. Gebouwd voor onafhankelijkheid.</p>
              <div className="flex gap-4">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Netwerk Status: Operationeel</span>
              </div>
            </div>
          </div>
        </footer>

      </body>
    </html>
  );
}