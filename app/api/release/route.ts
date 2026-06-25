import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// 1. Initialiseer de systemen
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // We gebruiken de admin key om veilig de hele tabel te mogen updaten
);

export async function POST(req: Request) {
  try {
    const { orderId, qrCode, makerId } = await req.json();

    if (!orderId || !qrCode) throw new Error("Ongeldige scan data.");

    // 2. Haal de Order en de Batch veilig op
    const { data: order, error: orderError } = await supabaseAdmin.from("orders").select("*").eq("id", orderId).single();
    if (orderError || !order) throw new Error("Transactie niet gevonden.");

    const { data: batch, error: batchError } = await supabaseAdmin.from("batches").select("price, maker, title").eq("id", order.batch_id).single();
    if (batchError || !batch) throw new Error("Oorspronkelijke oogst niet gevonden.");

    // 3. Beveiligingscheck 1: Is deze code wel van deze order?
    if (order.qr_release_code !== qrCode.toUpperCase()) {
      return NextResponse.json({ error: "Ongeldige afhaalcode! De kluis blijft gesloten." }, { status: 400 });
    }

    // 4. Beveiligingscheck 2: Zorg dat we niet dubbel afhandelen
    if (order.status === "completed" || order.status === "disputed" || order.status === "cancelled") {
      return NextResponse.json({ error: "Deze order is al afgesloten of geannuleerd." }, { status: 400 });
    }

    // ==============================================
    // SPOOR A: DE FIAT AFHANDELING (STRIPE)
    // ==============================================
    if (order.trade_type === "fiat") {
      if (order.escrow_status !== "held") {
        return NextResponse.json({ error: "Geld zit niet in de kluis of is al uitbetaald." }, { status: 400 });
      }

      // Haal bankgegevens maker op
      const { data: makerProfile } = await supabaseAdmin.from("profiles").select("stripe_account_id").eq("display_name", batch.maker).single();
      if (!makerProfile || !makerProfile.stripe_account_id) throw new Error("Maker heeft geen actieve bankkoppeling.");

      // Bereken uitbetaling (100% naar de boer)
      const rawPrice = parseFloat(batch.price.toString().replace(',', '.').replace(/[^0-9.]/g, ''));
      const payoutInCents = Math.round(rawPrice * 100) * order.amount;

      // Pomp het geld van de Kluis naar de Maker
      await stripe.transfers.create({
        amount: payoutInCents,
        currency: "eur",
        destination: makerProfile.stripe_account_id,
        description: `Uitbetaling Projekster: ${batch.title} (${order.amount} eenheden)`,
      });

      // Update Database
      await supabaseAdmin.from("orders").update({
        escrow_status: "released",
        status: "completed"
      }).eq("id", orderId);
    } 
    // ==============================================
    // SPOOR B: DE NATURA AFHANDELING (HANDSHAKE)
    // ==============================================
    else {
      // Bij natura is het simpelweg een kwestie van database updaten
      await supabaseAdmin.from("orders").update({
        status: "completed"
      }).eq("id", orderId);
    }

    // SUCCES!
    return NextResponse.json({ success: true, message: "Transactie definitief afgerond en verzegeld!" });

  } catch (error: any) {
    console.error("❌ Fout bij vrijgeven transactie:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}