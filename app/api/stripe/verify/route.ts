import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// 1. Initialiseer Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });

// 2. Initialiseer Supabase met de Admin Key (omdat we het vinkje in de database moeten forceren)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { accountId, userId } = await req.json();

    if (!accountId || !userId) {
      return NextResponse.json({ error: "Missende data" }, { status: 400 });
    }

    // 3. Vraag aan Stripe of dit account daadwerkelijk is goedgekeurd
    const account = await stripe.accounts.retrieve(accountId);

    // 'details_submitted' betekent dat de boer de KYC heeft afgerond
    if (account.details_submitted) {
      // 4. Sla het succes op in jouw database!
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_onboarding_complete: true })
        .eq("id", userId);

      return NextResponse.json({ success: true, message: "KYC voltooid" });
    } else {
      return NextResponse.json({ success: false, message: "KYC nog niet compleet" });
    }
    
  } catch (error: any) {
    console.error("❌ Fout in Verify API:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}