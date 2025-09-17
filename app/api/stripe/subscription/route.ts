import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateCustomer, isStripeConfigured } from '@/lib/stripe';
import { cookies } from 'next/headers';

// Get user session
async function getUserSession() {
  const cookieStore = await cookies();
  const authToken = cookieStore.get('hanzo-auth-token')?.value;

  if (!authToken) {
    return null;
  }

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

export async function GET(req: NextRequest) {
  try {
    const user = await getUserSession();
    
    if (!user) {
      return NextResponse.json({ subscription: null });
    }

    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json({ subscription: null });
    }

    // Get or create Stripe customer
    const customer = await getOrCreateCustomer({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    // For now, return null subscription as getCustomerSubscription is not implemented
    // In production, you would fetch the actual subscription from Stripe here
    const subscription = null;

    return NextResponse.json({ subscription });
  } catch (error) {
    console.error('Error fetching subscription:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}