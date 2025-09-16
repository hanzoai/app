import { NextRequest, NextResponse } from 'next/server';
import {
  getOrCreateCustomer,
  createCreditsCheckoutSession,
  getCustomerCredits,
  isStripeConfigured
} from '@/lib/stripe';
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

// GET - Get current credit balance
export async function GET(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json({
        credits: 5, // Default $5 free credits for demo
        message: 'Using demo credits. Stripe not configured.',
      });
    }

    const user = await getUserSession(req);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // Get credit balance
    const { credits } = await getCustomerCredits(customer.id);

    return NextResponse.json({ credits });
  } catch (error) {
    console.error('Error fetching credits:', error);
    return NextResponse.json(
      { error: 'Failed to fetch credits' },
      { status: 500 }
    );
  }
}

// POST - Create checkout session to purchase credits
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
    const { amount } = body; // Amount in dollars

    if (!amount || amount < 5) {
      return NextResponse.json(
        { error: 'Minimum credit purchase is $5' },
        { status: 400 }
      );
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    // Create checkout session for credits
    const session = await createCreditsCheckoutSession({
      customerId: customer.id,
      amount,
      successUrl: `${origin}/billing?credits_added=true&amount=${amount}`,
      cancelUrl: `${origin}/billing?canceled=true`,
      metadata: {
        userId: user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating credits checkout:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}