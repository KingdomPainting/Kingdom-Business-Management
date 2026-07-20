// Creates a Stripe Checkout Session so a client can pay for their project from
// the client portal. The amount is computed server-side from the deal's balance
// (value - invoicepaid) — never trusted from the client. Ownership is enforced
// by looking the deal up through get_client_deals for the authenticated user.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
  if (!STRIPE_SECRET_KEY) return json({ error: "Stripe is not configured yet." }, 500);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    // Identify the caller from their JWT.
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: ANON },
    });
    if (!userRes.ok) return json({ error: "Not authenticated" }, 401);
    const user = await userRes.json();
    const email: string = user?.email || "";
    if (!email) return json({ error: "Not authenticated" }, 401);

    const { deal_id, return_url } = await req.json();
    if (!deal_id) return json({ error: "Missing deal_id" }, 400);

    // Fetch this client's deals (SECURITY DEFINER RPC enforces ownership by email)
    const dealsRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_client_deals`, {
      method: "POST",
      headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ client_email: email }),
    });
    const deals = await dealsRes.json();
    const deal = Array.isArray(deals) ? deals.find((d: Record<string, unknown>) => d.id === deal_id) : null;
    if (!deal) return json({ error: "Project not found" }, 404);

    const value = parseFloat(deal.value || "0") || 0;
    const paid = parseFloat(deal.invoicePaid || "0") || 0;
    const balance = Math.round((value - paid) * 100); // cents
    if (balance <= 0) return json({ error: "This project has no balance due." }, 400);

    const base = (return_url || "").split("?")[0] || `${SUPABASE_URL}`;
    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set("success_url", `${base}?payment=success`);
    params.set("cancel_url", `${base}?payment=cancelled`);
    params.set("customer_email", email);
    params.set("client_reference_id", String(deal_id));
    params.set("metadata[deal_id]", String(deal_id));
    params.set("payment_intent_data[metadata][deal_id]", String(deal_id));
    params.set("line_items[0][quantity]", "1");
    params.set("line_items[0][price_data][currency]", "cad");
    params.set("line_items[0][price_data][unit_amount]", String(balance));
    params.set("line_items[0][price_data][product_data][name]", `${deal.dealName || "Project"} — Payment`);

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const session = await stripeRes.json();
    if (!stripeRes.ok) return json({ error: session?.error?.message || "Stripe error" }, 502);

    return json({ url: session.url, id: session.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
