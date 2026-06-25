import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2026-05-27.dahlia" as any });

export async function POST(req: Request) {
  try {
    const { accountId } = await req.json();

    if (!accountId) throw new Error("Geen Stripe Account ID gevonden.");

    // Genereer een eenmalige, beveiligde inloglink naar het Stripe Express Dashboard
    const loginLink = await stripe.accounts.createLoginLink(accountId);

    return NextResponse.json({ url: loginLink.url });
    
  } catch (error: any) {
    console.error("⚠️ Fout bij ophalen Stripe Login:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}