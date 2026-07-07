import { NextResponse } from "next/server";
import Stripe from "stripe";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

// 1. Initialiseer de systemen
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Het geheime wachtwoord tussen Stripe en jouw Vercel server
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
  // Stripe vereist de ruwe tekst van het verzoek om de cryptografische handtekening te controleren
  const body = await req.text();
  const signature = headers().get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Geen Stripe handtekening gevonden." }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    // Verifieer dat dit bericht ÉCHT van Stripe komt en niet van een hacker
    event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
  } catch (err: any) {
    console.error(`⚠️ Webhook handtekening fout: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // ==========================================================
  // DE LOGICA: Luister naar succesvolle kassa-betalingen
  // ==========================================================
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Haal de order_id op die we tijdens het maken van de kassa (in checkout/route.ts) in de metadata hebben gestopt
    const orderId = session.metadata?.order_id;
    
    if (orderId && session.payment_status === "paid") {
      try {
        // 1. Check de huidige status in de database
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .single();

        if (orderError || !order) {
          throw new Error("Order niet gevonden in database.");
        }

        // 2. IDEMPOTENCY CHECK (Voorkom dubbele acties)
        // Als de koper al netjes via de 'success' route is teruggekomen, staat deze al op 'held'. 
        // Dan negeert de webhook dit signaal om dubbele voorraad-reserveringen te voorkomen.
        if (order.escrow_status !== "held") {
          
          const qrCode = Math.random().toString(36).substring(2, 8).toUpperCase();

          // A. Update de transactiestatus naar de Escrow kluis
          await supabaseAdmin.from("orders").update({
            escrow_status: "held",
            qr_release_code: qrCode
          }).eq("id", orderId);

          // B. Reserveer de voorraad definitief voor deze koper
          const { data: batch } = await supabaseAdmin.from("batches").select("reserved").eq("id", order.batch_id).single();
          if (batch) {
            await supabaseAdmin.from("batches").update({ reserved: batch.reserved + order.amount }).eq("id", order.batch_id);
          }

          // C. Plaats het officiële systeembericht in de chat
          await supabaseAdmin.from("messages").insert([{
            order_id: orderId,
            sender_id: "00000000-0000-0000-0000-000000000000",
            sender_name: "Systeem",
            text: `✅ De betaling is op de achtergrond geverifieerd door het netwerk en het geld zit veilig in de Projekster Kluis. De eenheden zijn gereserveerd. Spreek hier een tijd en locatie af voor de fysieke overdracht.`
          }]);
          
          console.log(`✅ Webhook: Order ${orderId} succesvol verwerkt en beveiligd.`);
        } else {
          console.log(`ℹ️ Webhook: Order ${orderId} was al gereserveerd via de frontend.`);
        }
      } catch (dbError) {
        console.error("❌ Fout bij het updaten van de database via webhook:", dbError);
        // We sturen nog steeds een 200 terug naar Stripe, anders blijft Stripe het proberen
      }
    }
  }

  // Vertel Stripe dat we het bericht in goede orde hebben ontvangen
  return NextResponse.json({ received: true }, { status: 200 });
}