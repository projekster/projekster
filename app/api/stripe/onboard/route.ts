import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });

export async function POST(req: Request) {
  try {
    const { email, stripeAccountId, returnUrl } = await req.json();

    let accountId = stripeAccountId;

    // 1. Maak een account aan als de boer er nog geen heeft in onze database
    if (!accountId) {
      const accountParams: Stripe.AccountCreateParams = {
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      };
      
      // FIX: Voorkom een Stripe-crash als het e-mailadres leeg is
      if (email) accountParams.email = email;

      const account = await stripe.accounts.create(accountParams);
      accountId = account.id; // Dit is het gloednieuwe ID (bijv. acct_1Nxyz...)
    }

    // 2. Bouw de beveiligde bank-sessie
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${returnUrl}/dashboard`,
      return_url: `${returnUrl}/dashboard?onboarding=success`, // Hier sturen we ze heen na de paspoortcheck
      type: "account_onboarding",
    });

    // 3. We sturen zowel de URL als het ID terug naar de frontend!
    return NextResponse.json({ url: accountLink.url, accountId: accountId });
    
  } catch (error: any) {
    console.error("⚠️ Fout bij Stripe Onboarding Engine:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}