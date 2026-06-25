import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// 1. Initialiseer de Motoren
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });

// We gebruiken weer de Admin Key, want deze noodrem moet altijd werken
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { orderId, actionBy } = await req.json();

    if (!orderId) throw new Error("Geen order ID meegegeven.");

    // 2. Haal de ordergegevens op uit de kluis
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("Order niet gevonden.");
    
    if (order.status === 'cancelled' || order.status === 'refunded') {
        return NextResponse.json({ error: "Deze transactie is al geannuleerd." }, { status: 400 });
    }

    // 3. FIAT SPOOR: Zoek het geld en stort het terug via Stripe
    if (order.trade_type === "fiat" && order.escrow_status === "held") {
       // We zoeken de specifieke betaalsessie in Stripe op basis van jouw Order ID
       const sessions = await stripe.checkout.sessions.list({ limit: 100 });
       const session = sessions.data.find(s => s.metadata?.order_id === orderId);
       
       if (session && session.payment_intent) {
           // Geef Stripe de opdracht: Stort 100% terug naar de koper
           await stripe.refunds.create({
               payment_intent: session.payment_intent as string,
           });
       } else {
           console.error("⚠️ Kon de Stripe betaling niet direct vinden. Handmatige refund vereist in dashboard.");
       }
    }

    // 4. VOORRAAD SPOOR: Geef de eenheden terug aan de boer
    const { data: batch } = await supabaseAdmin.from("batches").select("reserved").eq("id", order.batch_id).single();
    if (batch) {
      // Voorkom dat de gereserveerde voorraad onder de 0 duikt
      const newReserved = Math.max(0, batch.reserved - order.amount);
      await supabaseAdmin.from("batches").update({ reserved: newReserved }).eq("id", order.batch_id);
    }

    // 5. DATABASE UPDATE: Sluit het dossier
    await supabaseAdmin.from("orders").update({
      status: "cancelled",
      escrow_status: order.trade_type === 'fiat' ? "refunded" : "cancelled",
      qr_release_code: null // Maak de afhaalcode direct ongeldig
    }).eq("id", orderId);

    // 6. CHAT UPDATE: Systeembericht plaatsen
    const refundText = order.trade_type === 'fiat' 
      ? "Het aankoopbedrag wordt automatisch door Stripe teruggestort op de rekening van de koper (dit kan 1-3 werkdagen duren)." 
      : "Deze Natura-ruil is afgebroken.";

    await supabaseAdmin.from("messages").insert([{
      order_id: orderId,
      sender_id: "00000000-0000-0000-0000-000000000000",
      sender_name: "Systeem",
      text: `🚨 Transactie afgebroken door ${actionBy || 'een van de partijen'}. De voorraad is vrijgegeven. ${refundText}`
    }]);

    return NextResponse.json({ success: true, message: "Refund en annulering succesvol verwerkt." });

  } catch (error: any) {
    console.error("❌ Fout in Refund API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}