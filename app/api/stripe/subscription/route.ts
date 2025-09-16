import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateCustomer, getSubscriptionStatus, isStripeConfigured } from '@/lib/stripe';
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

export async function GET(req: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      // Return default free plan status when Stripe isn't configured
      return NextResponse.json({
        customerId: null,
        subscription: null,
        plan: 'free',
        billingCycle: null,
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

    // Get subscription status
    const subscription = await getSubscriptionStatus(customer.id);

    // Determine plan type based on subscription
    let plan = 'free';
    let billingCycle = null;

    if (subscription) {
      // Check which product the subscription is for
      if (subscription.priceId === process.env.STRIPE_PRO_MONTHLY_PRICE_ID) {
        plan = 'pro';
        billingCycle = 'monthly';
      } else if (subscription.priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID) {
        plan = 'pro';
        billingCycle = 'yearly';
      } else if (subscription.priceId === process.env.STRIPE_PAY_AS_YOU_GO_USAGE_PRICE_ID) {
        plan = 'pay-as-you-go';
        billingCycle = 'usage';
      }
    }

    return NextResponse.json({
      customerId: customer.id,
      subscription,
      plan,
      billingCycle,
    });
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}