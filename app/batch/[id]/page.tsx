import type { Metadata, ResolvingMetadata } from 'next';
import { supabase } from '../../utils/supabase';
import BatchDetailClient from './BatchDetailClient';

type Props = {
  params: { id: string }
};

// ==========================================
// 1. DYNAMIC OPENGRAPH GENERATOR (SEO & Virale Motor)
// Draait 100% op de Server
// ==========================================
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
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
// 2. DE SERVER RENDERER (Doorgeefluik)
// ==========================================
export default function Page({ params }: Props) {
  // We forceren de ID prop hier direct naar binnen, geen haperingen meer.
  return <BatchDetailClient id={params.id} />;
}