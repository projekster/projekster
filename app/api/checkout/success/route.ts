import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// 1. Initialiseer de Motoren
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });

// TOP 1% FIX: Gebruik de Service Role Key. Dit garandeert dat de order altijd
// succesvol in de database wordt geschreven, ongeacht strikte RLS beveiligingsregels.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { batchId, buyerId, buyerName, reserveAmount } = await req.json();

    // 2. Haal de batch veilig op vanuit de server (voorkomt prijs-hacking door de koper)
    const { data: batch, error: batchError } = await supabaseAdmin.from("batches").select("*").eq("id", batchId).single();
    if (batchError || !batch) throw new Error("Oogst niet gevonden of geblokkeerd door de maker.");

    // 3. Spookvoorraad Check (Nieuw in 2.0!)
    // Voorkom dat iemand de kassa in gaat voor meer eenheden dan er fysiek nog zijn.
    const availableAmount = batch.total - (batch.reserved || 0);
    if (reserveAmount > availableAmount) {
      return NextResponse.json({ error: `Er zijn nog maar ${availableAmount} eenheden beschikbaar.` }, { status: 400 });
    }

    // 4. De Wiskunde (Het 0/5 Model)
    // Converteer de prijs (bijv "50,00" of "50") naar zuivere centen voor Stripe
    const rawPrice = parseFloat(batch.price.toString().replace(',', '.').replace(/[^0-9.]/g, ''));
    const unitPriceInCents = Math.round(rawPrice * 100); 
    const subTotalInCents = unitPriceInCents * reserveAmount;
    
    // 5% Platform Fee (Jouw netwerk winst)
    const platformFeeInCents = Math.round(subTotalInCents * 0.05);

    // 5. Maak de Order aan in Supabase (Status: Wachtend op de kluis)
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

    // 6. Bouw de Stripe Checkout Sessie (iDEAL, Bancontact, Creditcard)
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
              name: "Projekster Kluis & Netwerk Garantie",
              description: "Beveiligde Escrow tot QR-overdracht & 100% lokaal netwerkbehoud."
            },
            unit_amount: platformFeeInCents,
          },
          quantity: 1, 
        }
      ],
      mode: 'payment',
      // We koppelen het Order ID aan de URL zodat de success-route hem kan verzegelen
      success_url: `${origin}/api/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`,
      cancel_url: `${origin}/batch/${batch.id}?payment=cancelled`, // Stuur netjes terug als ze annuleren
      metadata: { order_id: order.id, batch_id: batch.id }
    });

    return NextResponse.json({ url: session.url });
    
  } catch (error: any) {
    console.error("⚠️ Stripe Checkout Fout:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}