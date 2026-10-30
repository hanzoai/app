/**
 * The pay site's addresses and money as a sentence says it.
 *
 * Kept apart from `plans.ts`, which reads the bundled plan catalogue: a page
 * that only links the pay page or prints a price carries none of it.
 */

import { devnet } from "./host";
import { org } from "./session";

/**
 * Where money changes hands: the checkout, mounted at hanzo.ai/pay so a buyer
 * never leaves the site. It is hanzo-inc/pay, served from the same export
 * pay.hanzo.ai was; that host now redirects here.
 *
 * billing.hanzo.ai has no route at the edge and answers 404, and /billing on
 * this site is the Billing PRODUCT's page — a reader sent there to buy a plan
 * lands on marketing. /pay takes `?plan=`, `?interval=`, `?returnUrl=` and
 * `?org=`, and comes back. Every "add credit" and "billing" link reads this one
 * address. Absolute, because this export also serves cloud.hanzo.ai and
 * hanzo.bot, and the checkout lives on hanzo.ai.
 */
export const BILLING_URL = "https://hanzo.ai/pay";

/**
 * The devnet's checkout: the same /pay mount on the devnet's site host, which
 * charges Square's sandbox through the devnet's cloud. A page on a devnet host
 * sends a buyer here and never to production's checkout.
 */
export const BILLING_DEV = "https://app-dev.hanzo.ai/pay";

/** The checkout for the page in front of us: the devnet's on a devnet host, hanzo.ai's everywhere else. */
export function billing(): string {
  return typeof window !== "undefined" && devnet(window.location.hostname) ? BILLING_DEV : BILLING_URL;
}

/**
 * The checkout address, opened on a plan when one is named, and returning to
 * `back` once the buyer has paid. Without `back` a paid buyer lands on the pay
 * site's receipt with no way into what they bought.
 *
 * ONE writer for this address. It was spelled out in three places — the
 * personal ladder, the business strip and the /account hand-off — and a plan id
 * only selects the card a reader clicked if every writer spells the query the
 * same way.
 */
export function checkoutUrl(id?: string, back?: string): string {
  return payUrl(id ? "/cart" : "/", { plan: id, returnUrl: back });
}

/**
 * A page on the pay site, for the organization this browser works in.
 *
 * pay charges and reads the ledger it is named, and it can only offer the ones
 * the token lists; which of them this workspace is in is a fact only this site
 * holds. `?org=` carries it across, and pay honours it only while the token
 * offers it. Call it at the moment of leaving: the organization lives in this
 * browser and moves with the switcher.
 */
export function payPage(path = "/"): string {
  return payUrl(path, { org: org() });
}

/** The pay address with its query, written in one place for both callers above. */
export function payUrl(path: string, query: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v) q.set(k, v);
  const s = q.toString();
  const at = billing();
  if (path === "/" && !s) return at;
  return `${at}${path}${s ? `?${s}` : ""}`;
}

export const dollars = (n: number) => `$${n.toFixed(2)}`;

/**
 * Money as a sentence says it. English stays `$20` or `$16.67`. Any other
 * locale uses that locale's currency format for USD, so grouping and the
 * currency mark follow the language the reader chose.
 */
export const money = (n: number, locale = "en-US") => {
  if (locale === "en-US") return Number.isInteger(n) ? `$${n.toLocaleString("en-US")}` : dollars(n);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
  }).format(n);
};
