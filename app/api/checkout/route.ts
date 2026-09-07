import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// 1. Initialiseer Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });

// TOP 1% FIX: Hier zit het geheim! We gebruiken de ADMIN key in plaats van de ANON key.
// Hiermee omzeilt de server de RLS blokkade en kan de kassa ALTIJD de order opslaan.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { batchId, buyerId, buyerName, reserveAmount } = await req.json();

    const { data: batch, error: batchError } = await supabaseAdmin.from("batches").select("*").eq("id", batchId).single();
    if (batchError || !batch) throw new Error("Batch niet gevonden of geblokkeerd.");

    // AFRONDINGS-VEILIGE WISKUNDE (Fase 2.2)
    const rawPrice = parseFloat(batch.price.toString().replace(',', '.').replace(/[^0-9.]/g, ''));
    const unitPriceInCents = Math.round(rawPrice * 100); 
    const subTotalInCents = unitPriceInCents * reserveAmount;
    
    // SOVEREIGN MODEL: 0% Winst. Alleen harde Stripe kosten (1.5% + 35 cent)
    // We gebruiken Math.round om te voorkomen dat er halve centen naar Stripe worden gestuurd (wat een crash veroorzaakt)
    const stripeFeeInCents = Math.round((subTotalInCents * 0.015) + 35);

    // Let op: We gebruiken hier supabaseAdmin om de RLS beveiliging te passeren
    const { data: order, error: orderError } = await supabaseAdmin.from("orders").insert([{
      batch_id: batch.id,
      buyer_id: buyerId,
      buyer_name: buyerName,
      seller_name: batch.maker,
      batch_title: batch.title,
      amount: reserveAmount,
      trade_type: "fiat",
      status: "pending", 
      escrow_status: "awaiting_payment"
    }]).select().single();

    if (orderError) throw orderError;

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.projekster.com';
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['ideal', 'bancontact', 'card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: `Oogst: ${batch.title} (${reserveAmount} ${batch.unit || 'stuks'})` },
            unit_amount: unitPriceInCents,
          },
          quantity: reserveAmount,
        },
        {
          price_data: {
            currency: 'eur',
            product_data: { 
              name: "Onafhankelijke Infrastructuur",
              description: "0% Winstmarge. Enkel de harde externe bankkosten voor de Escrow kluis."
            },
            unit_amount: stripeFeeInCents,
          },
          quantity: 1, 
        }
      ],
      mode: 'payment',
      success_url: `${origin}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancel_url: `${origin}/batch/${batch.id}`,
      metadata: { order_id: order.id, batch_id: batch.id }
    });

    return NextResponse.json({ url: session.url });
    
  } catch (error: any) {
    console.error("⚠️ Stripe Checkout Fout:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}