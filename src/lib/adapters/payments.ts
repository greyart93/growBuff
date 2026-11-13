import { randomToken } from "@/lib/crypto";

export const MOCK = process.env.MOCK_INTEGRATIONS !== "false";

export function gstBreakup(amountPaise: number) {
  const gst = Math.round(amountPaise * 0.18);
  return { amountPaise, gstPaise: gst, totalPaise: amountPaise + gst };
}

export function invoiceNumber(date = new Date()) {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `GB-${stamp}-${randomToken(3).toUpperCase()}`;
}

/**
 * Payment checkout. Mock mode returns a local confirmation URL; swap in
 * Razorpay subscriptions or Stripe Checkout for live billing.
 */
export async function createCheckout(input: {
  tenantId: string;
  planId: string;
  pricePaise: number;
  agent: string;
}) {
  if (MOCK || process.env.BILLING_PROVIDER === "mock") {
    return {
      provider: "mock",
      url: `/billing?checkout=success&agent=${input.agent}`,
      reference: `mock_pay_${randomToken(6)}`,
    };
  }
  throw new Error("Live billing is not configured. Add Razorpay or Stripe credentials.");
}
