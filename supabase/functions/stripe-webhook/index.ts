// Stripe webhook — records completed portal payments across the CRM:
//  1. logs the event id for idempotency (Stripe retries deliver the same id),
//  2. adds a Bookkeeping income entry ("Stripe Payment", linked to the project
//     and its contact),
//  3. sets the deal's invoicepaid to the sum of its income entries (matching the
//     Bookkeeping page's own derivation — the invoice Paid box),
//  4. moves the project to the Completed stage once it's fully paid.
// Public function (verify_jwt disabled); authenticated by the Stripe signature.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const enc = new TextEncoder();

// Verify the Stripe-Signature header (scheme t=timestamp,v1=signature).
async function verify(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")) as [string, string][]);
    const t = parts["t"]; const sig = parts["v1"];
    if (!t || !sig) return false;
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
    const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch { return false; }
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const svc = { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" };

  const payload = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";
  if (!WEBHOOK_SECRET || !(await verify(payload, sigHeader, WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: Record<string, any>;
  try { event = JSON.parse(payload); } catch { return new Response("Bad payload", { status: 400 }); }

  if (event.type !== "checkout.session.completed") {
    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  }

  try {
    // 1) Idempotency — first writer wins; duplicates (Stripe retries) short-circuit.
    const idemp = await fetch(`${SUPABASE_URL}/rest/v1/stripe_events`, {
      method: "POST", headers: { ...svc, Prefer: "return=minimal" },
      body: JSON.stringify({ id: event.id }),
    });
    if (idemp.status === 409) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const session = event.data?.object || {};
    const dealId = session?.metadata?.deal_id || session?.client_reference_id;
    const amount = Number(session?.amount_total || 0) / 100;
    if (!dealId || !(amount > 0)) {
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // Look up the deal for its owner, contact, value and stage.
    const dealRes = await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${dealId}&select=id,dealName,value,invoicepaid,contact,user_id,stage`, { headers: svc });
    const deal = (await dealRes.json())?.[0];
    if (!deal) {
      return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 2) Bookkeeping income entry.
    await fetch(`${SUPABASE_URL}/rest/v1/bookkeeping`, {
      method: "POST", headers: { ...svc, Prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: deal.user_id || null,
        date: new Date().toISOString().slice(0, 10),
        type: "income",
        category: "Income",
        description: "Stripe Payment",
        amount,
        vendor: "",
        contact_id: deal.contact || null,
        project_id: dealId,
      }),
    });

    // 3) invoicepaid = sum of the project's income entries (same as the Bookkeeping page).
    const incRes = await fetch(`${SUPABASE_URL}/rest/v1/bookkeeping?project_id=eq.${dealId}&type=eq.income&select=amount`, { headers: svc });
    const incRows = await incRes.json();
    const paidSum = (Array.isArray(incRows) ? incRows : []).reduce((s: number, r: Record<string, unknown>) => s + (parseFloat(String(r.amount)) || 0), 0);

    // 4) Move to Completed once fully paid.
    const value = parseFloat(String(deal.value ?? "0")) || 0;
    const patch: Record<string, unknown> = { invoicepaid: paidSum };
    if (value > 0 && paidSum >= value - 0.005 && deal.stage !== "Completed" && deal.stage !== "Archive") {
      patch.stage = "Completed";
    }
    await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${dealId}`, {
      method: "PATCH", headers: { ...svc, Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
  } catch (_e) {
    // Roll back the idempotency marker so Stripe's retry reprocesses cleanly
    // (a non-2xx response triggers the retry).
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/stripe_events?id=eq.${encodeURIComponent(event.id)}`, { method: "DELETE", headers: svc });
    } catch { /* ignore */ }
    return new Response("error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
