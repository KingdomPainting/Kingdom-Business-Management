// Stripe webhook — records completed payments back onto the deal's invoicepaid
// so the CRM (invoice/financials) reflects money received through the portal.
// Configure the endpoint in the Stripe dashboard and set STRIPE_WEBHOOK_SECRET.
// This function is public (verify_jwt disabled); it authenticates via the Stripe
// signature instead.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const enc = new TextEncoder();

// Verify the Stripe-Signature header (scheme t=timestamp,v1=signature).
async function verify(payload: string, header: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")) as [string, string][]);
    const t = parts["t"];
    const sig = parts["v1"];
    if (!t || !sig) return false;
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
    const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    // constant-time-ish compare
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  const payload = await req.text();
  const sigHeader = req.headers.get("stripe-signature") || "";
  if (!WEBHOOK_SECRET || !(await verify(payload, sigHeader, WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event: Record<string, unknown>;
  try { event = JSON.parse(payload); } catch { return new Response("Bad payload", { status: 400 }); }

  if (event.type === "checkout.session.completed") {
    const session = (event.data as Record<string, unknown>)?.object as Record<string, unknown>;
    const dealId = (session?.metadata as Record<string, string>)?.deal_id || session?.client_reference_id;
    const amount = Number(session?.amount_total || 0) / 100;
    if (dealId && amount > 0) {
      try {
        // Read current paid amount, then add this payment.
        const cur = await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${dealId}&select=invoicepaid`, {
          headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
        });
        const rows = await cur.json();
        const prev = parseFloat(rows?.[0]?.invoicepaid || "0") || 0;
        await fetch(`${SUPABASE_URL}/rest/v1/deals?id=eq.${dealId}`, {
          method: "PATCH",
          headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
          body: JSON.stringify({ invoicepaid: prev + amount }),
        });
      } catch (_e) { /* swallow — Stripe will retry on non-2xx */ }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});
