import Link from "next/link";

export const metadata = {
  title: "Algemene Voorwaarden | Projekster",
  description: "De juridische afspraken, spelregels en Escrow voorwaarden van het Projekster Netwerk.",
};

export default function VoorwaardenPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 py-16 md:py-24">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        
        <div className="mb-12">
          <Link href="/" className="text-sm font-bold text-slate-500 hover:text-amber-600 uppercase tracking-widest transition-colors mb-6 inline-block">
            &larr; Terug naar het netwerk
          </Link>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-slate-900 mb-4">Algemene Voorwaarden</h1>
          <p className="text-slate-500 font-medium">Laatst gewijzigd: {new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })}</p>
        </div>

        <div className="prose prose-slate prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight max-w-none bg-white p-8 md:p-12 rounded-3xl border border-slate-200 shadow-sm">
          
          <h3>1. Definities en Rol van Projekster</h3>
          <p>
            Projekster ("het Platform", "wij", "ons") faciliteert een digitaal handelsnetwerk waar lokale producenten ("Makers") en afnemers ("Kopers") elkaar kunnen vinden voor de directe uitwisseling van goederen. 
            <strong> Belangrijk: Projekster is uitdrukkelijk geen partij bij de uiteindelijke koop- of ruilovereenkomst.</strong> Wij leveren uitsluitend de technologische infrastructuur, de geografische radar en een beveiligde betalingsmodule (Escrow).
          </p>

          <h3>2. KYC (Know Your Customer) & Registratie</h3>
          <p>
            Om financiële transacties in fiat-geld (Euro's) te kunnen ontvangen, zijn Makers verplicht zich te verifiëren via onze betalingspartner, Stripe Inc. Dit KYC-proces is wettelijk verplicht om witwassen en fraude te voorkomen. Projekster behoudt zich het recht voor om accounts te schorsen of te verwijderen die weigeren aan deze richtlijnen te voldoen of frauduleus handelen.
          </p>

          <h3>3. Betalingen en de Escrow-Kluis</h3>
          <p>
            Wanneer een Koper via iDEAL, Bancontact of Creditcard betaalt, wordt dit geld niet direct naar de Maker overgemaakt, maar veilig vastgehouden door onze betalingspartner Stripe (de Escrow-Kluis).
          </p>
          <ul>
            <li><strong>Vrijgave van fondsen:</strong> Het bedrag wordt pas vrijgegeven en overgemaakt naar de Maker op het moment dat de Maker de unieke QR-code van de Koper fysiek scant bij de overdracht.</li>
            <li><strong>Definitieve actie:</strong> Zodra de QR-code is gescand, wordt de transactie door het systeem als voltooid en onomkeerbaar beschouwd.</li>
            <li><strong>Servicekosten:</strong> Projekster houdt een platform-fee van 5% in op fiat-transacties om de Escrow- en serverkosten te dekken. Deze fee wordt gedragen door de Koper en duidelijk getoond voor afrekenen.</li>
          </ul>

          <h3>4. Annuleringen & Restitutie (Refunds)</h3>
          <p>
            Aangezien Projekster geen eigenaar van de goederen is, verlopen geschillen over kwaliteit direct tussen Maker en Koper. 
            Mocht de overdracht niet plaatsvinden (QR-code wordt niet gescand), dan kan de Koper de transactie via het platform annuleren waarna de Escrow het volledige aankoopbedrag (minus servicekosten) zal terugstorten. Na het scannen van de QR-code is restitutie via het platform <strong>niet meer mogelijk</strong>.
          </p>

          <h3>5. Ruilhandel in Natura</h3>
          <p>
            Projekster biedt de mogelijkheid om goederen te ruilen zonder tussenkomst van fiat-geld. Voor deze transacties treedt Projekster enkel op als communicatiekanaal. Wij bieden geen garanties, Escrow-diensten of kopersbescherming op natura-transacties. Handel in natura valt volledig onder de eigen verantwoordelijkheid en erecode van de gebruikers.
          </p>

          <h3>6. Verboden Goederen</h3>
          <p>
            Het is strikt verboden om via Projekster illegale goederen, wapens, drugs of gestolen waar aan te bieden. Indien dergelijk aanbod wordt geconstateerd, wordt het account onmiddellijk permanent verbannen en kunnen gegevens worden overgedragen aan de bevoegde autoriteiten.
          </p>

          <h3>7. Aansprakelijkheid</h3>
          <p>
            Projekster is nimmer aansprakelijk voor de kwaliteit, veiligheid, of legaliteit van de aangeboden goederen, noch voor het niet nakomen van afspraken tussen Maker en Koper. Gebruik van het netwerk is op eigen risico.
          </p>

        </div>
      </div>
    </main>
  );
}