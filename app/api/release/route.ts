import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// 1. Start de Motoren
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: Request) {
  try {
    const { orderId, qrCode } = await req.json();

    // 2. Haal de Order en de Batch op
    const { data: order, error: orderError } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (orderError || !order) throw new Error("Transactie niet gevonden.");

    // DE FIX: title toegevoegd aan de selectie!
    const { data: batch, error: batchError } = await supabase.from("batches").select("price, maker, title").eq("id", order.batch_id).single();
    if (batchError || !batch) throw new Error("Oorspronkelijke oogst niet gevonden.");

    // 3. Beveiligingscheck: Klopt de code en zit het geld in de kluis?
    if (order.escrow_status !== "held") {
      return NextResponse.json({ error: "Geld zit niet in de kluis of is al uitbetaald." }, { status: 400 });
    }
    if (order.qr_release_code !== qrCode.toUpperCase()) {
      return NextResponse.json({ error: "Ongeldige afhaalcode! De kluis blijft gesloten." }, { status: 400 });
    }

    // 4. Haal de bankgegevens van de Maker op
    const { data: makerProfile } = await supabase.from("profiles").select("stripe_account_id").eq("display_name", batch.maker).single();
    if (!makerProfile || !makerProfile.stripe_account_id) {
      throw new Error("Maker heeft geen actieve bankkoppeling.");
    }

    // 5. De Wiskunde: Bereken EXACT de vraagprijs (100% voor de boer)
    const rawPrice = parseFloat(batch.price.toString().replace(',', '.').replace(/[^0-9.]/g, ''));
    const payoutInCents = Math.round(rawPrice * 100) * order.amount;

    // 6. De Transactie: Pomp het geld van de Kluis naar de Maker
    await stripe.transfers.create({
      amount: payoutInCents,
      currency: "eur",
      destination: makerProfile.stripe_account_id,
      description: `Uitbetaling Projekster: ${batch.title} (${order.amount} eenheden)`,
    });

    // 7. Werk de database bij (Kluis is leeg, order afgerond)
    await supabase.from("orders").update({
      escrow_status: "released",
      status: "completed"
    }).eq("id", orderId);

    return NextResponse.json({ success: true, message: "Betaling succesvol vrijgegeven!" });

  } catch (error: any) {
    console.error("⚠️ Fout bij vrijgeven kluis:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}