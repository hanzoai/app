import Stripe from 'stripe';

// Server-side Stripe client - with safe initialization
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2024-12-18.acacia',
      typescript: true,
    })
  : null;

// Check if Stripe is configured
export const isStripeConfigured = () => {
  return !!(
    process.env.STRIPE_SECRET_KEY &&
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET
  );
};

// Stripe product/price IDs for different plans
export const STRIPE_PRODUCTS = {
  credits: {
    productId: 'prod_Ru0gok2x52s57Y', // Live credits product
    name: 'Credits',
    description: 'Top up credits for usage-based billing',
  },
  pro: {
    productId: 'prod_SMzWLE1hJzYfTf', // Live premium/pro product
    name: 'Pro',
    prices: {
      monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '',  // $20/mo
      yearly: process.env.STRIPE_PRO_YEARLY_PRICE_ID || '',    // $200/yr
    }
  },
  payAsYouGo: {
    productId: process.env.STRIPE_PAY_AS_YOU_GO_PRODUCT_ID || '',
    prices: {
      usage: process.env.STRIPE_PAY_AS_YOU_GO_USAGE_PRICE_ID || '',
    }
  }
};

// Stripe webhook secret for validating webhooks
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

// Helper to create a checkout session
export async function createCheckoutSession({
  customerId,
  customerEmail,
  priceId,
  mode = 'subscription',
  successUrl,
  cancelUrl,
  metadata = {},
}: {
  customerId?: string;
  customerEmail?: string;
  priceId: string;
  mode?: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : customerEmail,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    payment_method_types: ['card'],
  });

  return session;
}

// Helper to create a customer portal session
export async function createPortalSession({
  customerId,
  returnUrl,
}: {
  customerId: string;
  returnUrl: string;
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session;
}

// Helper to get or create a Stripe customer
export async function getOrCreateCustomer({
  userId,
  email,
  name,
}: {
  userId: string;
  email: string;
  name?: string;
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
  }

  // First, check if customer already exists
  const existingCustomers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create a new customer
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      userId,
    },
  });

  return customer;
}

// Helper to get subscription status
export async function getSubscriptionStatus(customerId: string) {
  if (!stripe) {
    return null; // Return null when Stripe is not configured
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    return null;
  }

  const subscription = subscriptions.data[0];
  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    priceId: subscription.items.data[0]?.price.id,
  };
}

// Helper to record usage for pay-as-you-go customers
export async function recordUsage({
  customerId,
  quantity,
  timestamp = Math.floor(Date.now() / 1000),
  action,
}: {
  customerId: string;
  quantity: number;
  timestamp?: number;
  action: 'ai_response' | 'api_call' | 'storage_gb';
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
  }

  // Find the subscription for this customer
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });

  if (subscriptions.data.length === 0) {
    throw new Error('No active subscription found');
  }

  const subscription = subscriptions.data[0];
  const subscriptionItem = subscription.items.data.find(
    item => item.price.recurring?.usage_type === 'metered'
  );

  if (!subscriptionItem) {
    throw new Error('No metered subscription item found');
  }

  // Record the usage
  await stripe.subscriptionItems.createUsageRecord(subscriptionItem.id, {
    quantity,
    timestamp,
    action: 'increment',
  });

  return { success: true };
}

// Helper to create a checkout session for credits
export async function createCreditsCheckoutSession({
  customerId,
  customerEmail,
  amount, // Amount in dollars
  successUrl,
  cancelUrl,
  metadata = {},
}: {
  customerId?: string;
  customerEmail?: string;
  amount: number;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured. Please add STRIPE_SECRET_KEY to your environment variables.');
  }

  // Create a price for the specific credit amount
  const price = await stripe.prices.create({
    product: STRIPE_PRODUCTS.credits.productId,
    unit_amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
  });

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    customer_email: customerId ? undefined : customerEmail,
    line_items: [
      {
        price: price.id,
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      ...metadata,
      type: 'credits',
      amount: amount.toString(),
    },
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    payment_method_types: ['card'],
  });

  return session;
}

// Helper to get customer's invoices
export async function getCustomerInvoices({
  customerId,
  limit = 10,
}: {
  customerId: string;
  limit?: number;
}) {
  if (!stripe) {
    return { invoices: [], hasMore: false };
  }

  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });

  return {
    invoices: invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      amount: (invoice.amount_paid || 0) / 100, // Convert from cents
      status: invoice.status,
      date: new Date(invoice.created * 1000),
      pdfUrl: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
      description: invoice.description,
      period: invoice.period_start && invoice.period_end ? {
        start: new Date(invoice.period_start * 1000),
        end: new Date(invoice.period_end * 1000),
      } : null,
    })),
    hasMore: invoices.has_more,
  };
}

// Helper to get customer's credit balance (stored in metadata or custom field)
export async function getCustomerCredits(customerId: string) {
  if (!stripe) {
    return { credits: 0 };
  }

  const customer = await stripe.customers.retrieve(customerId);

  // In a real implementation, you'd store this in a database
  // For now, using customer metadata as a simple storage
  const credits = parseInt((customer as any).metadata?.credits || '0', 10);

  return { credits };
}

// Helper to update customer's credit balance
export async function updateCustomerCredits({
  customerId,
  credits,
  action = 'set',
}: {
  customerId: string;
  credits: number;
  action?: 'set' | 'increment' | 'decrement';
}) {
  if (!stripe) {
    throw new Error('Stripe is not configured.');
  }

  const customer = await stripe.customers.retrieve(customerId);
  const currentCredits = parseInt((customer as any).metadata?.credits || '0', 10);

  let newCredits = credits;
  if (action === 'increment') {
    newCredits = currentCredits + credits;
  } else if (action === 'decrement') {
    newCredits = Math.max(0, currentCredits - credits);
  }

  await stripe.customers.update(customerId, {
    metadata: {
      ...(customer as any).metadata,
      credits: newCredits.toString(),
    },
  });

  return { credits: newCredits };
}