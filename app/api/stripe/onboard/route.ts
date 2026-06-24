import { NextResponse } from "next/server";
import Stripe from "stripe";

// Start de beveiligde Stripe Motor met de bleeding-edge 2026 API
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2026-05-27.dahlia", 
});

export async function POST(req: Request) {
  try {
    // Pak de data uit die het dashboard (de client) naar ons stuurt
    const { userId, email, stripeAccountId, returnUrl } = await req.json();

    let accountId = stripeAccountId;

    // 1. Maak een nieuw Stripe Express account aan als de maker er nog geen heeft
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }, // Dit zorgt dat we geld naar de bank kunnen pompen
        },
      });
      accountId = account.id;
    }

    // 2. Genereer een beveiligde, eenmalige onboarding link
    // Hiermee vult de maker zijn IBAN in bij Stripe, zodat JIJ geen wettelijke aansprakelijkheid hebt.
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${returnUrl}/dashboard`,
      return_url: `${returnUrl}/dashboard?onboarding=success`,
      type: "account_onboarding",
    });

    // Stuur de URL en het ID terug naar de frontend
    return NextResponse.json({ url: accountLink.url, accountId: accountId });
    
  } catch (error: any) {
    console.error("⚠️ Fout bij Stripe Onboarding Engine:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}