import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// We laden Resend in met jouw geheime API key
const resend = new Resend(process.env.RESEND_API_KEY);

// TOP 1% ARCHITECTUUR: We gebruiken de SERVICE_ROLE key omdat we privé e-mailadressen 
// van andere gebruikers moeten ophalen. Deze key omzeilt de Row Level Security (RLS), 
// en mag daarom NOOIT naar de browser van een bezoeker lekken.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { type, recipientId, senderName, batchTitle, messagePreview, actionUrl } = await req.json();

    if (!recipientId || !type) {
      return NextResponse.json({ error: "Missende data" }, { status: 400 });
    }

    // 1. Check de notificatie-voorkeuren van de ontvanger in de profiles tabel
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email_alerts")
      .eq("id", recipientId)
      .single();

    if (profileError || !profile) throw new Error("Profiel ontvanger niet gevonden.");

    // Als de boer/koper zijn e-mail alerts UIT heeft gezet in zijn dashboard, stoppen we hier stilletjes.
    // We geven een "success" terug zodat de app niet vastloopt, maar sturen geen mail.
    if (profile.email_alerts === false) {
      return NextResponse.json({ success: true, message: "E-mail overgeslagen (voorkeur staat uit)" });
    }

    // 2. Haal het beveiligde e-mailadres op uit het verborgen Supabase Auth systeem
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(recipientId);
    
    if (userError || !user?.email) throw new Error("Kon e-mailadres niet ophalen uit Auth.");
    const recipientEmail = user.email;

    // 3. Bouw de e-mail op basis van het type (Chat of Order)
    let subject = "";
    let htmlContent = "";
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.projekster.com";
    const fullUrl = `${baseUrl}${actionUrl}`;

    if (type === "chat") {
      subject = `Nieuw bericht van ${senderName} | Projekster`;
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; color: #0f172a; padding: 20px;">
          <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Projekster.</h1>
          </div>
          <h2 style="color: #d97706; margin-top: 0;">Nieuw Bericht 💬</h2>
          <p><strong>${senderName}</strong> heeft je een bericht gestuurd over de oogst <em>${batchTitle}</em>.</p>
          
          <div style="background-color: #f8fafc; border-left: 4px solid #f59e0b; padding: 16px; margin: 24px 0; border-radius: 0 8px 8px 0; font-style: italic; color: #475569;">
            "${messagePreview}"
          </div>

          <a href="${fullUrl}" style="display: inline-block; padding: 14px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px;">
            Bekijk en Beantwoord
          </a>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
            Je ontvangt dit bericht omdat je e-mailnotificaties aan hebt staan. Je kunt dit op elk moment uitschakelen in je <a href="${baseUrl}/dashboard" style="color: #64748b;">Instellingen</a>.
          </div>
        </div>
      `;
    } else if (type === "order") {
      subject = `Nieuwe Reservering: ${batchTitle} | Projekster`;
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; color: #0f172a; padding: 20px;">
          <div style="border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 20px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Projekster.</h1>
          </div>
          <h2 style="color: #059669; margin-top: 0;">Nieuwe Reservering 📦</h2>
          <p>Goed nieuws! <strong>${senderName}</strong> wil graag <em>${batchTitle}</em> van je overnemen.</p>
          
          <a href="${fullUrl}" style="display: inline-block; padding: 14px 24px; background-color: #059669; color: #ffffff; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 14px; margin-top: 10px;">
            Bekijk de Reservering
          </a>
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
            Je ontvangt dit bericht omdat je e-mailnotificaties aan hebt staan. Je kunt dit op elk moment uitschakelen in je <a href="${baseUrl}/dashboard" style="color: #64748b;">Instellingen</a>.
          </div>
        </div>
      `;
    } else {
      return NextResponse.json({ error: "Onbekend notificatie type" }, { status: 400 });
    }

    // 4. Vuur de e-mail af via Resend
    const { data, error } = await resend.emails.send({
      // LET OP: Gebruik onboarding@resend.dev zolang je domein nog niet is geverifieerd in Resend!
      // En test voorlopig alleen door mailtjes naar je eigen e-mailadres te sturen.
      from: "Projekster Netwerk <onboarding@resend.dev>", 
      to: [recipientEmail],
      subject: subject,
      html: htmlContent,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error("❌ Fout in Notify API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}