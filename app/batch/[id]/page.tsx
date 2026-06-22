import type { Metadata, ResolvingMetadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import BatchDetailClient from './BatchDetailClient'; // De UI die we hierna maken

// ==========================================
// 1. SERVER-SIDE SUPABASE CLIENT (Voor OpenGraph)
// ==========================================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const supabaseAdmin = createClient(supabaseUrl, supabaseAnonKey);

type Props = {
  params: { id: string }
};

// ==========================================
// 2. DYNAMIC OPENGRAPH GENERATOR (De Virale Motor)
// Draait 100% op de Server
// ==========================================
export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { data: batch } = await supabaseAdmin
    .from('batches')
    .select('title, maker, description, image_url, price, location')
    .eq('id', params.id)
    .single();

  if (!batch) {
    return { title: 'Batch Niet Gevonden | Projekster' }
  }

  const dynamicDescription = `${batch.maker} biedt aan uit ${batch.location || 'de regio'}: ${batch.price}. ${batch.description ? batch.description.substring(0, 100) + '...' : 'Bekijk deze Oogst op Projekster.'}`;
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
// 3. DE SERVER RENDERER
// Geeft het ID door aan de Client UI
// ==========================================
export default function Page({ params }: Props) {
  return <BatchDetailClient id={params.id} />;
}