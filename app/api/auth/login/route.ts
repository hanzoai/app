import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') ?? 'localhost:3000';
  const url = host.includes('/spaces/hanzo') ? 'hanzo.hf.space' : host;
  const redirect_uri = `${host.includes('localhost') ? 'http://' : 'https://'}${url}/auth/callback`;

  const clientId = process.env.OAUTH_CLIENT_ID || process.env.HF_CLIENT_ID;

  if (!clientId) {
    console.error('OAuth client ID not found in environment variables');
    return NextResponse.json({ error: 'OAuth configuration missing' }, { status: 500 });
  }

  const loginRedirectUrl = `https://huggingface.co/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect_uri}&response_type=code&scope=openid%20profile%20write-repos%20manage-repos%20inference-api&prompt=consent&state=1234567890`;

  console.log('Auth URL generated via API:', loginRedirectUrl);

  return NextResponse.json({ url: loginRedirectUrl });
}