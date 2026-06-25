import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// 1. Initialiseer Resend (E-mail)
const resend = new Resend(process.env.RESEND_API_KEY);

// 2. Initialiseer Web Push (Telefoons)
webpush.setVapidDetails(
  "mailto:admin@projekster.com", // Belangrijk: Apple en Google willen weten van wie de push komt
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

// 3. Initialiseer Supabase Admin (bypast de beveiliging om e-mails en telefoongegevens te lezen)
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

    // Haal de voorkeuren van de gebruiker op uit de database
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("email_alerts, push_alerts")
      .eq("id", recipientId)
      .single();

    if (profileError || !profile) throw new Error("Profiel niet gevonden.");

    // Als allebei de vinkjes UIT staan, stoppen we direct stilletjes.
    if (!profile.email_alerts && !profile.push_alerts) {
      return NextResponse.json({ success: true, message: "Geen notificaties verzonden (voorkeuren staan uit)" });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.projekster.com";
    const fullUrl = `${baseUrl}${actionUrl}`;

    // ==========================================
    // SPOOR A: PUSH NOTIFICATIES (TELEFOON)
    // ==========================================
    if (profile.push_alerts) {
      // Zoek of deze boer/koper geregistreerde apparaten heeft
      const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*").eq("user_id", recipientId);

      if (subs && subs.length > 0) {
        const pushPayload = JSON.stringify({
          title: type === "chat" ? `Nieuw bericht van ${senderName} 💬` : `Nieuwe Reservering 📦`,
          body: type === "chat" ? messagePreview : `${senderName} wil ${batchTitle} overnemen.`,
          url: actionUrl // Opent direct de app in de chat of reservering
        });

        // Vuur de raketten af naar alle gekoppelde apparaten (bijv. tablet én telefoon)
        const pushPromises = subs.map(async (sub) => {
          const pushSubscription = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
          try {
            await webpush.sendNotification(pushSubscription, pushPayload);
          } catch (err: any) {
            // Auto-Cleanup: Als de gebruiker de push-permissie op zijn telefoon heeft ingetrokken (404 of 410)
            if (err.statusCode === 410 || err.statusCode === 404) {
              console.log("Schoonmaken van dode push-koppeling:", sub.id);
              await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
            }
          }
        });
        
        // We wachten niet perse op een fout hier, we voeren het parallel uit
        await Promise.allSettled(pushPromises);
      }
    }

    // ==========================================
    // SPOOR B: E-MAIL NOTIFICATIES (RESEND)
    // ==========================================
    if (profile.email_alerts) {
      const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(recipientId);
      
      if (!userError && user?.email) {
        let subject = "";
        let htmlContent = "";

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
        }

        // LET OP: "onboarding@resend.dev" zolang domein niet is geverifieerd in Resend!
        await resend.emails.send({
          from: "Projekster Netwerk <onboarding@resend.dev>", 
          to: [user.email],
          subject: subject,
          html: htmlContent,
        });
      }
    }

    return NextResponse.json({ success: true, message: "Notificatie triggers succesvol verwerkt!" });

  } catch (error: any) {
    console.error("❌ Fout in Notify API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}