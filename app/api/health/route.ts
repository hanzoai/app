import { NextResponse } from 'next/server';
import { isStripeConfigured } from '@/lib/stripe';

export async function GET() {
  const checks = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '0.1.0',
    services: {
      stripe: 'checking',
    },
  };

  // Check Stripe configuration
  checks.services.stripe = isStripeConfigured() ? 'configured' : 'not configured';

  const statusCode = checks.status === 'ok' ? 200 : 503;
  
  return NextResponse.json(checks, { status: statusCode });
}