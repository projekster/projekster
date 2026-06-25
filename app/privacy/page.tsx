import Link from "next/link";

export const metadata = {
  title: "Privacybeleid | Projekster",
  description: "Hoe wij jouw data beschermen en behandelen binnen het Projekster Netwerk.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 py-16 md:py-24">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        
        <div className="mb-12">
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-amber-600 uppercase tracking-widest transition-colors mb-6 inline-block">
            &larr; Terug naar het netwerk
          </Link>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-slate-900 mb-4">Privacybeleid</h1>
          <p className="text-slate-500 font-medium">Laatst gewijzigd: {new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="prose prose-slate prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight max-w-none bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm">
          
          <h3>1. Jouw Data, Jouw Eigendom</h3>
          <p>
            Bij Projekster geloven we in datasouvereiniteit. Wij verzamelen alleen de gegevens die absoluut noodzakelijk zijn om de directe handel tussen jou en lokale netwerken mogelijk te maken. Wij verkopen jouw data <strong>nooit</strong> aan derden of adverteerders.
          </p>

          <h3>2. Gegevens die wij verwerken</h3>
          <p>Wanneer je gebruikmaakt van ons platform, slaan we de volgende gegevens veilig op:</p>
          <ul>
            <li><strong>Accountgegevens:</strong> E-mailadres en (handels)naam of pseudoniem via onze partner Supabase.</li>
            <li><strong>Geografische Data:</strong> De locatie (coördinaten) die je opgeeft bij het aanmaken van een oogst/batch, om de radarfunctionaliteit mogelijk te maken.</li>
            <li><strong>Transactiegeschiedenis:</strong> Communicatie in de chat (versleuteld) en status van orders ter bevordering van geschillenbeslechting.</li>
          </ul>

          <h3>3. Financiële Gegevens & Externe Partners</h3>
          <p>
            Om veilige transacties te garanderen, werken wij samen met betalingsprovider <strong>Stripe Inc.</strong>. 
            Projekster slaat zélf geen bankrekeningnummers, creditcardgegevens of identiteitsbewijzen op. Alle KYC (Know Your Customer) en betalingsdata loopt via de beveiligde servers van Stripe. Hun privacybeleid is hierop van toepassing.
          </p>

          <h3>4. Locatievoorzieningen (Radar)</h3>
          <p>
            Als Koper kun je ervoor kiezen om je GPS-locatie te delen met de browser om aanbod in de buurt te vinden. Deze ruwe GPS-data wordt uitsluitend in jouw browser gebruikt voor wiskundige afstandsmetingen en wordt <strong>niet</strong> op onze servers opgeslagen of getrackt.
          </p>

          <h3>5. Jouw Rechten (AVG / GDPR)</h3>
          <p>
            Je hebt te allen tijde het recht om in te zien welke gegevens wij van je hebben, deze te laten corrigeren, of je account en alle bijbehorende handelsdata definitief te laten wissen. Hiervoor kun je een verzoek indienen via de communicatiekanalen van het platform.
          </p>

          <h3>6. Cookies</h3>
          <p>
            Wij gebruiken enkel functionele cookies en sessie-tokens (via Supabase) om je ingelogd te houden en de website veilig te laten functioneren. Wij maken geen gebruik van tracking of marketing cookies.
          </p>

        </div>
      </div>
    </main>
  );
}