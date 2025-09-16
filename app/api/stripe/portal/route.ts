import { NextRequest, NextResponse } from 'next/server';
import { createPortalSession, getOrCreateCustomer, isStripeConfigured } from '@/lib/stripe';
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

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const returnUrl = `${origin}/billing`;

    // Create portal session
    const session = await createPortalSession({
      customerId: customer.id,
      returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      const origin = req.headers.get('origin') || 'http://localhost:3002';
      return NextResponse.redirect(`${origin}/billing?error=payment_not_configured`);
    }

    const user = await getUserSession(req);

    if (!user) {
      const origin = req.headers.get('origin') || 'http://localhost:3002';
      return NextResponse.redirect(`${origin}/auth?error=unauthorized`);
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    const origin = req.headers.get('origin') || 'http://localhost:3000';
    const returnUrl = `${origin}/billing`;

    // Create portal session
    const session = await createPortalSession({
      customerId: customer.id,
      returnUrl,
    });

    // Redirect to portal
    return NextResponse.redirect(session.url);
  } catch (error) {
    console.error('Error creating portal session:', error);
    const origin = req.headers.get('origin') || 'http://localhost:3002';
    return NextResponse.redirect(`${origin}/billing?error=portal_failed`);
  }
}