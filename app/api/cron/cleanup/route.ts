import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// We gebruiken de Admin Key omdat deze achtergrond-robot overal bij moet kunnen (buiten de RLS om)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    // 1. BEVEILIGING: Zorg dat alleen de Vercel Cron server dit mag aanroepen!
    // Anders kan een willekeurige bezoeker je database leegvegen.
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Geen toegang: Ongeldig Cron wachtwoord', { status: 401 });
    }

    // 2. Bereken het exacte tijdstip van 48 uur geleden
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // 3. Zoek alle orders die nog 'pending' (wachtend) zijn en OUDER zijn dan 48 uur
    const { data: staleOrders, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("status", "pending")
      .lt("created_at", twoDaysAgo);

    if (fetchError) throw fetchError;

    // Als er geen dode orders zijn, stopt de robot hier netjes.
    if (!staleOrders || staleOrders.length === 0) {
      return NextResponse.json({ success: true, message: "Geen verlopen orders gevonden. Alles is schoon." });
    }

    const staleOrderIds = staleOrders.map(order => order.id);

    // 4. ACTIE A: Annuleer ze allemaal in één krachtige database-beweging
    await supabaseAdmin
      .from("orders")
      .update({ 
        status: "cancelled",
        escrow_status: "cancelled" 
      })
      .in("id", staleOrderIds);

    // 5. ACTIE B: Plaats een Systeembericht in de chat van al deze afgebroken orders
    const systemMessages = staleOrderIds.map(id => ({
      order_id: id,
      sender_id: "00000000-0000-0000-0000-000000000000",
      sender_name: "Systeem",
      text: "❌ Dit voorstel is automatisch verlopen omdat er na 48 uur geen actie is ondernomen. De transactie is afgebroken en het kanaal is gesloten."
    }));

    await supabaseAdmin.from("messages").insert(systemMessages);

    // Rapport uitbrengen
    console.log(`✅ Cronjob succes: ${staleOrderIds.length} verlopen orders opgeruimd.`);
    return NextResponse.json({ success: true, message: `${staleOrderIds.length} verlopen orders succesvol opgeruimd.` });

  } catch (error: any) {
    console.error("❌ Fout in Cronjob:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}