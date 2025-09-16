import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession, getOrCreateCustomer, STRIPE_PRODUCTS, isStripeConfigured } from '@/lib/stripe';
import { headers as getHeaders } from 'next/headers';
import { cookies as getCookies } from 'next/headers';

// Get user session (integrate with Hugging Face auth)
async function getUserSession(req: NextRequest) {
  const headers = await getHeaders();
  const cookies = await getCookies();
  const authToken = cookies.get('hanzo-auth-token')?.value || headers.get('Authorization');

  if (!authToken) {
    return null;
  }

  // Verify with Hugging Face
  try {
    const response = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: {
        Authorization: authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Error verifying user session:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Payment system not configured. Please contact support.' },
        { status: 503 }
      );
    }

    const user = await getUserSession(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { plan, billing } = body;

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Determine the price ID based on plan and billing cycle
    let priceId: string;

    if (plan === 'pay-as-you-go') {
      priceId = STRIPE_PRODUCTS.payAsYouGo.prices.usage;
    } else if (plan === 'pro') {
      priceId = billing === 'yearly'
        ? STRIPE_PRODUCTS.pro.prices.yearly
        : STRIPE_PRODUCTS.pro.prices.monthly;
    } else {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    // Create checkout session
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const session = await createCheckoutSession({
      customerId: customer.id,
      priceId,
      mode: plan === 'pay-as-you-go' ? 'subscription' : 'subscription',
      successUrl: `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        plan,
        billing: billing || 'monthly',
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      // Redirect to pricing with error
      const origin = req.headers.get('origin') || 'http://localhost:3002';
      return NextResponse.redirect(`${origin}/pricing?error=payment_not_configured`);
    }

    const user = await getUserSession(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const plan = searchParams.get('plan');
    const billing = searchParams.get('billing');

    if (!plan) {
      return NextResponse.json(
        { error: 'Plan is required' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Determine the price ID based on plan and billing cycle
    let priceId: string;

    if (plan === 'pay-as-you-go') {
      priceId = STRIPE_PRODUCTS.payAsYouGo.prices.usage;
    } else if (plan === 'pro') {
      priceId = billing === 'yearly'
        ? STRIPE_PRODUCTS.pro.prices.yearly
        : STRIPE_PRODUCTS.pro.prices.monthly;
    } else {
      return NextResponse.json(
        { error: 'Invalid plan' },
        { status: 400 }
      );
    }

    // Create checkout session
    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const session = await createCheckoutSession({
      customerId: customer.id,
      priceId,
      mode: 'subscription',
      successUrl: `${origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pricing?canceled=true`,
      metadata: {
        userId: user.id,
        plan,
        billing: billing || 'monthly',
      },
    });

    // Redirect to checkout
    return NextResponse.redirect(session.url!);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    const origin = req.headers.get('origin') || 'http://localhost:3002';
    return NextResponse.redirect(`${origin}/pricing?error=checkout_failed`);
  }
}