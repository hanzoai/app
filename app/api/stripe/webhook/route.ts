import { NextRequest, NextResponse } from 'next/server';
import { stripe, STRIPE_WEBHOOK_SECRET, isStripeConfigured } from '@/lib/stripe';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  // Check if Stripe is configured
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json(
      { error: 'Payment system not configured' },
      { status: 503 }
    );
  }

  const body = await req.text();
  const signature = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout session completed:', session.id);

        // Handle successful checkout
        // Update user's subscription status in your database
        const customerId = session.customer as string;
        const userId = session.metadata?.userId;

        if (userId && customerId) {
          // TODO: Update user subscription status in database
          console.log(`User ${userId} subscribed with customer ID ${customerId}`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription updated:', subscription.id);

        // Update subscription status
        const customerId = subscription.customer as string;
        const status = subscription.status;

        // TODO: Update subscription in database
        console.log(`Subscription ${subscription.id} status: ${status}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription canceled:', subscription.id);

        // Handle subscription cancellation
        const customerId = subscription.customer as string;

        // TODO: Update user to free tier in database
        console.log(`Subscription ${subscription.id} canceled for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment succeeded:', invoice.id);

        // Handle successful payment
        const customerId = invoice.customer as string;

        // TODO: Record payment in database
        console.log(`Payment successful for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Payment failed:', invoice.id);

        // Handle failed payment
        const customerId = invoice.customer as string;

        // TODO: Send notification to user
        console.log(`Payment failed for customer ${customerId}`);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Trial ending soon:', subscription.id);

        // Send reminder email about trial ending
        const customerId = subscription.customer as string;

        // TODO: Send trial ending notification
        console.log(`Trial ending soon for customer ${customerId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Stripe webhooks require the raw body, so we need to disable body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};