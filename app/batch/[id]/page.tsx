import type { Metadata, ResolvingMetadata } from 'next';
import { supabase } from '../../utils/supabase';
import BatchDetailClient from './BatchDetailClient';

type Props = {
  params: Promise<{ id: string }>
};

// ==========================================
// 1. DYNAMIC OPENGRAPH GENERATOR (SEO & Virale Motor)
// ==========================================
export async function generateMetadata(
  props: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const params = await props.params;

  const { data: batch } = await supabase
    .from('batches')
    .select('title, maker, description, image_url, price, location')
    .eq('id', params.id)
    .single();

  if (!batch) {
    return { title: 'Aanbod Niet Gevonden | Projekster' }
  }

  const dynamicDescription = `${batch.maker} biedt aan uit ${batch.location || 'de regio'}: ${batch.price}. ${batch.description ? batch.description.substring(0, 100) + '...' : 'Bekijk dit op de Vrije Markt.'}`;
  const ogImage = batch.image_url || "/og-image.png";

  return {
    title: `${batch.title} | Projekster`,
    description: dynamicDescription,
    openGraph: {
      title: `${batch.title} - Aangeboden door ${batch.maker}`,
      description: dynamicDescription,
      images: [{ url: ogImage, width: 1200, height: 630, alt: batch.title }],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${batch.title} - Aangeboden door ${batch.maker}`,
      description: dynamicDescription,
      images: [ogImage],
    },
  }
}

// ==========================================
// 2. DE SERVER RENDERER & JSON-LD INJECTOR
// ==========================================
export default async function Page(props: Props) {
  const params = await props.params;
  
  // Haal data op speciaal voor Google's JSON-LD robot
  const { data: batch } = await supabase
    .from('batches')
    .select('title, maker, description, image_url, price, category, reserved, total')
    .eq('id', params.id)
    .single();

  // Bouw de onzichtbare Schema voor Google Rich Snippets
  let jsonLd = null;
  if (batch) {
    const rawPrice = parseFloat(batch.price?.toString().replace(',', '.').replace(/[^0-9.]/g, '')) || 0;
    const isAvailable = (batch.total - batch.reserved) > 0;

    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": batch.title,
      "image": batch.image_url ? [batch.image_url] : [],
      "description": batch.description || `Lokaal aanbod van ${batch.maker} op Projekster.`,
      "category": batch.category,
      "brand": {
        "@type": "Brand",
        "name": batch.maker
      },
      "offers": {
        "@type": "Offer",
        "url": `https://projekster.com/batch/${params.id}`,
        "priceCurrency": "EUR",
        "price": rawPrice.toFixed(2),
        "itemCondition": "https://schema.org/NewCondition",
        "availability": isAvailable ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        "seller": {
          "@type": "Organization",
          "name": batch.maker
        }
      }
    };
  }

  return (
    <>
      {/* Injecteer de Google Robot Code onzichtbaar in de HTML */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      
      {/* Laad de visuele interface in */}
      <BatchDetailClient id={params.id} />
    </>
  );
}