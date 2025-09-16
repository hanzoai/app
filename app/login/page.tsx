'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HanzoLogo } from '@/components/HanzoLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { getAuth } from '@/app/actions/auth';
import { Loader2, Github, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleHuggingFaceLogin = async () => {
    setLoading(true);
    try {
      const authUrl = await getAuth();
      window.location.href = authUrl;
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      {/* Navigation */}
      <nav className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <HanzoLogo className="w-8 h-8 text-white" />
            <span className="text-xl font-bold">Hanzo</span>
          </Link>
          <Link href="/signup">
            <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
              Sign up
            </Button>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="bg-[#1a1a1a] border-white/10">
            <CardHeader className="space-y-1 text-center pb-8">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-violet-500 to-purple-500 rounded-2xl flex items-center justify-center">
                  <HanzoLogo className="w-10 h-10 text-white" />
                </div>
              </div>
              <CardTitle className="text-2xl">Welcome back</CardTitle>
              <CardDescription className="text-white/60">
                Sign in to your Hanzo account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Hugging Face Login Button */}
              <Button
                onClick={handleHuggingFaceLogin}
                disabled={loading}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium h-12"
                size="lg"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      <circle cx="9" cy="10" r="1.5"/>
                      <circle cx="15" cy="10" r="1.5"/>
                      <path d="M8 15c0 2.21 1.79 4 4 4s4-1.79 4-4"/>
                    </svg>
                    Continue with Hugging Face
                  </>
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#1a1a1a] px-2 text-white/40">
                    Secure authentication via Hugging Face
                  </span>
                </div>
              </div>

              {/* Benefits */}
              <div className="space-y-2 pt-4">
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/60">
                    Access to all Hanzo AI Build features
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/60">
                    Seamless integration with HF repositories
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-white/60">
                    No additional passwords to remember
                  </p>
                </div>
              </div>

              {/* Footer Links */}
              <div className="pt-6 text-center space-y-2">
                <p className="text-sm text-white/60">
                  Don't have an account?{' '}
                  <Link href="/signup" className="text-violet-400 hover:text-violet-300">
                    Sign up
                  </Link>
                </p>
                <p className="text-xs text-white/40">
                  By signing in, you agree to our{' '}
                  <Link href="/terms" className="underline hover:text-white/60">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="underline hover:text-white/60">
                    Privacy Policy
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}