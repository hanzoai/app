import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateCustomer, getCustomerInvoices, isStripeConfigured } from '@/lib/stripe';
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
      // Return mock data for development
      return NextResponse.json({
        invoices: [
          {
            id: 'demo_inv_1',
            number: 'INV-2024-001',
            amount: 20,
            status: 'paid',
            date: new Date('2024-01-15'),
            description: 'Pro Plan - Monthly',
            period: {
              start: new Date('2024-01-01'),
              end: new Date('2024-01-31'),
            },
          },
        ],
        hasMore: false,
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

    // Get invoices
    const searchParams = req.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const invoicesData = await getCustomerInvoices({
      customerId: customer.id,
      limit,
    });

    return NextResponse.json(invoicesData);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}