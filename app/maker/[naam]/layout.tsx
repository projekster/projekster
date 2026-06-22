import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { naam: string } }): Promise<Metadata> {
  const decodedNaam = decodeURIComponent(params.naam);

  return {
    title: `De Kluis van ${decodedNaam} | Projekster`,
    description: `Bekijk het soevereine en onafhankelijke aanbod van ${decodedNaam} op de Projekster netwerk-marktplaats.`,
    openGraph: {
      title: `${decodedNaam} | Projekster Producent`,
      description: `Verken het actieve handelswaar van ${decodedNaam}. Direct, lokaal en vrij van fiat-verplichtingen.`,
      url: `https://projekster.nl/maker/${params.naam}`,
      siteName: 'Projekster',
      images: [
        {
          // Fallback image voor als je later een algemene branding foto toevoegt in je /public map
          url: '/icon-512.png', 
          width: 512,
          height: 512,
          alt: `Profiel van ${decodedNaam}`,
        },
      ],
      locale: 'nl_NL',
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title: `Handel direct met ${decodedNaam}`,
      description: 'Geen supermarkt. Geen algoritmes. Alleen echte waarde.',
    },
  };
}

export default function MakerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}