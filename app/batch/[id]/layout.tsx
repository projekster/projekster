import { Metadata } from 'next';
import { supabase } from '../../utils/supabase';

// Deze code draait 100% op de server, speciaal voor web-scrapers en chat-apps (Telegram/WhatsApp)
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  // We halen bliksemsnel de data van deze specifieke batch op
  const { data: batch } = await supabase
    .from('batches')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!batch) {
    return {
      title: 'Aanbod Niet Gevonden | Projekster',
    };
  }

  // De Viral Meta-Tags
  return {
    title: `${batch.title} | Projekster`,
    description: `Lokaal aangeboden door ${batch.maker} in ${batch.location || 'de regio'}. Voorraad: ${batch.total} ${batch.unit || 'stuks'}. Prijs: ${batch.price}. Bekijk en reserveer direct.`,
    openGraph: {
      title: `${batch.title} | Projekster Vrije Markt`,
      description: `Lokaal aanbod van ${batch.maker}. Klik om direct via de kluis te reserveren.`,
      url: `https://projekster.nl/batch/${batch.id}`,
      siteName: 'Projekster',
      images: batch.image_url ? [
        {
          url: batch.image_url,
          width: 1200,
          height: 630,
          alt: batch.title,
        },
      ] : [],
      locale: 'nl_NL',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${batch.title} | Projekster`,
      description: `Sovereign aanbod van ${batch.maker} uit ${batch.location || 'jouw regio'}.`,
      images: batch.image_url ? [batch.image_url] : [],
    },
  };
}

export default function BatchLayout({ children }: { children: React.ReactNode }) {
  // We renderen hier gewoon jouw bestaande page.tsx (de kinderen van deze layout)
  return <>{children}</>;
}