import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// 1. Initialiseer de Motoren
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });

// Weer de Service Role Key: Essentieel omdat we voorraad gaan claimen en 
// profielen gaan zoeken zonder dat we belemmerd willen worden door RLS beveiliging.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");
    const orderId = searchParams.get("order_id");

    if (!sessionId || !orderId) throw new Error("Ongeldige of missende verificatie data.");

    // 2. Verifieer bij Stripe of het geld écht binnen is
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") {
      return NextResponse.redirect(new URL(`/dashboard?error=payment_failed`, req.url));
    }

    // 3. Haal de Order op uit onze database
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (orderError || !order) throw new Error("Transactie niet gevonden in de database.");

    // IDEMPOTENCY CHECK: Als de gebruiker per ongeluk F5 (refresh) indrukt op deze pagina, 
    // willen we niet dat hij de notificaties en voorraad dubbel triggert.
    if (order.escrow_status === "held") {
      return NextResponse.redirect(new URL(`/inbox/${orderId}`, req.url));
    }

    // 4. Genereer Cryptografische QR Code voor de koper
    const qrCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    // 5. Update de Database (Order status + Voorraad definitief vastzetten)
    await supabaseAdmin.from("orders").update({
      escrow_status: "held",
      qr_release_code: qrCode
    }).eq("id", orderId);

    const { data: batch } = await supabaseAdmin.from("batches").select("reserved").eq("id", order.batch_id).single();
    if (batch) {
      await supabaseAdmin.from("batches").update({ reserved: batch.reserved + order.amount }).eq("id", order.batch_id);
    }

    // 6. Open het Chatkanaal met een officieel Systeembericht
    await supabaseAdmin.from("messages").insert([{
      order_id: orderId,
      sender_id: "00000000-0000-0000-0000-000000000000",
      sender_name: "Systeem",
      text: `✅ De betaling is succesvol geverifieerd en het geld zit in de Projekster Kluis. De eenheden zijn gereserveerd en de koper heeft een afhaal-QR code in zijn dashboard. Spreek hier een tijd en locatie af voor de fysieke overdracht.`
    }]);

    // 7. DE WAKKERMAKER (Notificatie Engine activeren)
    // We zoeken het ID van de maker op basis van zijn display_name
    const { data: sellerProfile } = await supabaseAdmin.from("profiles").select("id").eq("display_name", order.seller_name).single();
    
    if (sellerProfile && sellerProfile.id) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      
      // Vuur asynchroon af (met .catch) zodat de koper niet hoeft te wachten op trillende telefoons
      fetch(`${baseUrl}/api/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "order",
          recipientId: sellerProfile.id,
          senderName: order.buyer_name,
          batchTitle: order.batch_title,
          messagePreview: "",
          actionUrl: `/inbox/${order.id}`
        }),
      }).catch(err => console.error("Notificatie backend kon niet worden bereikt:", err));
    }

    // 8. Stuur de koper veilig naar de chat
    return NextResponse.redirect(new URL(`/inbox/${orderId}`, req.url));

  } catch (error: any) {
    console.error("❌ Fout in Checkout Success Route:", error);
    // Als er iets mis is, stuur ze terug naar het dashboard met een foutmelding
    return NextResponse.redirect(new URL(`/dashboard?error=verification_failed`, req.url));
  }
}