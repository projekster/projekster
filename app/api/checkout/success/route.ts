import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// Genereer een onbreekbare, 6-cijferige cryptografische afhaalcode
function generateQRReleaseCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase(); // Bijv: 'A7F9B2'
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session_id = url.searchParams.get("session_id");
  const order_id = url.searchParams.get("order_id");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  if (!session_id || !order_id) return NextResponse.redirect(new URL("/dashboard?error=missing_data", origin));

  try {
    // 1. Verifieer bij de Bank (Stripe) of het geld daadwerkelijk binnen is
    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (session.payment_status === "paid") {
      
      const qrCode = generateQRReleaseCode();

      // 2. Haal de order op om de voorraad wiskunde te doen
      const { data: order } = await supabase.from("orders").select("*").eq("id", order_id).single();
      const { data: batch } = await supabase.from("batches").select("reserved").eq("id", order?.batch_id).single();

      // 3. Vergrendel de order en genereer de QR in de kluis
      await supabase.from("orders").update({
        status: "completed",       // Voor Fiat is betaling = geaccepteerd
        escrow_status: "held",     // Geld zit veilig in de kluis!
        stripe_payment_intent_id: session.payment_intent as string,
        qr_release_code: qrCode
      }).eq("id", order_id);

      // 4. Reserveer de eenheden definitief in de hoofddatabase
      if (batch && order) {
        await supabase.from("batches").update({ reserved: batch.reserved + order.amount }).eq("id", order.batch_id);
      }

      // 5. Stuur de koper naar zijn Dashboard om zijn verse QR-code te zien
      return NextResponse.redirect(new URL("/dashboard?payment=success", origin));
    }

    return NextResponse.redirect(new URL("/dashboard?payment=failed", origin));

  } catch (error) {
    console.error("⚠️ Fout bij afhandelen succesvolle betaling:", error);
    return NextResponse.redirect(new URL("/dashboard?error=system_fault", origin));
  }
}