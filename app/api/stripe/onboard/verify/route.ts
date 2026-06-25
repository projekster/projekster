import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: Request) {
  try {
    const { accountId, userId } = await req.json();

    if (!accountId || !userId) throw new Error("Missende gegevens");

    // 1. Vraag Stripe: "Heeft deze persoon zijn paspoort en IBAN succesvol geverifieerd?"
    const account = await stripe.accounts.retrieve(accountId);

    if (account.details_submitted) {
      // 2. Pas als Stripe 'Ja' zegt, vinken we het af in jouw Supabase database
      await supabase.from("profiles").update({ stripe_onboarding_complete: true }).eq("id", userId);
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ success: false, message: "Onboarding is afgebroken of incompleet." });
    }
    
  } catch (error: any) {
    console.error("⚠️ Fout bij Verificatie:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}