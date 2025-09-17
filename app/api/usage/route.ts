import { NextRequest, NextResponse } from 'next/server';
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

export async function GET() {
  try {
    const user = await getUserSession();
    
    // Mock usage data - always return data for demo
    const usage = {
      api_calls: {
        used: Math.floor(Math.random() * 500) + 400, // 400-900
        limit: 10000,
        period: 'monthly'
      },
      ai_responses: {
        used: Math.floor(Math.random() * 100) + 50, // 50-150
        limit: 1000,
        period: 'monthly'
      },
      storage: {
        used: parseFloat((Math.random() * 5 + 1).toFixed(1)), // 1-6 GB
        limit: 100,
        unit: 'GB',
        period: 'monthly'
      },
      projects: {
        used: Math.floor(Math.random() * 8) + 3, // 3-10
        limit: 50,
        period: 'account'
      },
      bandwidth: {
        used: parseFloat((Math.random() * 20 + 5).toFixed(1)), // 5-25 GB
        limit: 500,
        unit: 'GB',
        period: 'monthly'
      }
    };

    return NextResponse.json({ usage });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserSession();
    
    // Allow tracking even without auth for demo
    const { event, metadata } = await req.json();

    // Track usage event
    console.log('Usage event:', { event, metadata, userId: user?.id || 'anonymous' });

    // In production, save to database
    // await trackUsageEvent(user.id, event, metadata);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking usage:', error);
    return NextResponse.json(
      { error: 'Failed to track usage' },
      { status: 500 }
    );
  }
}