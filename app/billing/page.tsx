'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@/hooks/useUser';
import { HanzoLogo } from '@/components/HanzoLogo';

// UI Components
import { Button } from "@hanzo/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@hanzo/ui";
import { Badge } from "@hanzo/ui";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@hanzo/ui";
import { Progress } from "@hanzo/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@hanzo/ui";
import { Input } from "@hanzo/ui";

// Icons
import {
  CreditCard,
  Download,
  Plus,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Clock,
  AlertCircle,
  Activity,
  Database,
  Brain,
  Loader2,
  Filter,
  FileText,
  Zap,
  Calendar,
  ArrowRight,
  BarChart3
} from 'lucide-react';

interface BillingPageProps {}

export default function BillingPage() {
  const { user } = useUser();
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [selectedCreditAmount, setSelectedCreditAmount] = useState<number | null>(null);
  const [customCreditAmount, setCustomCreditAmount] = useState('');

  // Billing data
  const [credits, setCredits] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [usage, setUsage] = useState<any>({
    api_calls: { used: 423, limit: 10000 },
    storage: { used: 2.1, limit: 100 },
    ai_responses: { used: 89, limit: 1000 }
  });

  // Credit purchase options
  const creditOptions = [
    { amount: 10, credits: 10, bonus: 0 },
    { amount: 25, credits: 27, bonus: 2, popular: true },
    { amount: 50, credits: 55, bonus: 5 },
    { amount: 100, credits: 115, bonus: 15 },
  ];

  useEffect(() => {
    // Simple auth check - just check if we have a token
    const checkAuth = () => {
      const cookies = document.cookie.split(';');
      const hasAuthToken = cookies.some(cookie =>
        cookie.trim().startsWith('hanzo-auth-token=') ||
        cookie.trim().startsWith('hanzo-access-token=')
      );

      if (!hasAuthToken && !user) {
        router.push('/auth');
        return;
      }
      fetchBillingData();
    };

    checkAuth();
  }, [user, router]);

  const fetchBillingData = async () => {
    try {
      // Fetch all billing data in parallel
      const [subResponse, creditsResponse, invoicesResponse, usageResponse] = await Promise.all([
        fetch('/api/stripe/subscription'),
        fetch('/api/stripe/credits'),
        fetch('/api/stripe/invoices'),
        fetch('/api/usage')
      ]);

      const [subData, creditsData, invoicesData, usageData] = await Promise.all([
        subResponse.json(),
        creditsResponse.json(),
        invoicesResponse.json(),
        usageResponse.json()
      ]);

      // Update usage data from API
      if (usageData.usage) {
        setUsage(usageData.usage);
      }

      if (subData.plan) {
        setSubscription({
          plan: subData.plan === 'free' ? 'Free' : subData.plan === 'pro' ? 'Pro' : 'Pay as you go',
          status: subData.subscription?.status || 'active',
          billingCycle: subData.billingCycle,
          nextBillingDate: subData.subscription?.currentPeriodEnd,
          cancelAtPeriodEnd: subData.subscription?.cancelAtPeriodEnd
        });
      }

      setCredits(creditsData.credits || 0);
      setInvoices(invoicesData.invoices || []);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCustomerPortal = async () => {
    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error('Failed to open customer portal:', error);
    }
  };

  const handlePurchaseCredits = async () => {
    const amount = selectedCreditAmount || parseFloat(customCreditAmount);
    if (!amount || amount < 5) return;

    try {
      const response = await fetch('/api/stripe/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
    } catch (error) {
      console.error('Failed to create checkout session:', error);
    }
  };

  const calculateUsagePercentage = (used: number, limit: number) => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Navigation */}
      <nav className="border-b border-white/10 sticky top-0 bg-[#0a0a0a]/80 backdrop-blur-xl z-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <HanzoLogo className="w-8 h-8 text-white" />
              <span className="text-xl font-bold">Hanzo</span>
            </Link>
            <div className="hidden md:flex items-center gap-6">
              <Link href="/projects" className="text-white/70 hover:text-white">Projects</Link>
              <Link href="/billing" className="text-white font-medium">Billing</Link>
              <Link href="/pricing" className="text-white/70 hover:text-white">Pricing</Link>
            </div>
          </div>
          <Button
            onClick={() => router.push('/dev')}
            className="bg-white text-black hover:bg-white/90"
          >
            New Project
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">Billing & Usage</h1>
            <p className="text-white/60">Manage your subscription, credits, and monitor usage</p>
          </div>
          <Button
            onClick={handleOpenCustomerPortal}
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Customer Portal
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Current Plan */}
          <Card className="bg-[#1a1a1a] border-white/10 hover:border-white/20 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-white/60">Current Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Badge className={
                  subscription?.plan === 'Pro'
                    ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white'
                    : 'bg-white/10 text-white/70'
                }>
                  {subscription?.plan || 'Free'}
                </Badge>
                {subscription?.nextBillingDate && (
                  <p className="text-xs text-white/60">
                    Next billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}
                  </p>
                )}
                {(!subscription || subscription.plan === 'Free') && (
                  <Button
                    onClick={() => router.push('/pricing')}
                    className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                    size="sm"
                  >
                    <Sparkles className="w-4 h-4 mr-2" />
                    Upgrade
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Credits */}
          <Card className="bg-[#1a1a1a] border-white/10 hover:border-white/20 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-white/60">Credits Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">${credits.toFixed(2)}</span>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                {credits === 5 && (
                  <p className="text-xs text-white/40">Expires in 90 days</p>
                )}
                <Button
                  onClick={() => setCreditModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Credits
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Summary */}
          <Card className="bg-[#1a1a1a] border-white/10 hover:border-white/20 transition-colors">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-white/60">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">API Calls</span>
                  <span>{usage.api_calls.used.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">AI Responses</span>
                  <span>{usage.ai_responses.used.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Storage</span>
                  <span>{usage.storage.used} GB</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabbed Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 w-full max-w-md bg-[#1a1a1a] border border-white/10">
            <TabsTrigger value="overview" className="data-[state=active]:bg-white/10">Overview</TabsTrigger>
            <TabsTrigger value="invoices" className="data-[state=active]:bg-white/10">Invoices</TabsTrigger>
            <TabsTrigger value="usage" className="data-[state=active]:bg-white/10">Usage</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            <Card className="bg-[#1a1a1a] border-white/10">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => setCreditModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Credits
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={handleOpenCustomerPortal}
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Payment
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => router.push('/pricing')}
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  Plans
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  onClick={() => setActiveTab('invoices')}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Invoices
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices" className="mt-6">
            <Card className="bg-[#1a1a1a] border-white/10">
              <CardHeader>
                <CardTitle>Invoice History</CardTitle>
                <CardDescription>Download your past invoices and receipts</CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto text-white/20 mb-3" />
                    <p className="text-white/60">No invoices yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="flex items-center justify-between p-4 border border-white/10 rounded-lg hover:bg-white/5">
                        <div>
                          <p className="font-medium">{invoice.description || 'Payment'}</p>
                          <p className="text-sm text-white/60">
                            {new Date(invoice.date).toLocaleDateString()} • ${invoice.amount.toFixed(2)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(invoice.pdfUrl || invoice.hostedUrl, '_blank')}
                          className="text-white/60 hover:text-white"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="mt-6 space-y-6">
            <Card className="bg-[#1a1a1a] border-white/10">
              <CardHeader>
                <CardTitle>Usage Details</CardTitle>
                <CardDescription>Current billing period usage across all services</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* API Calls */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Activity className="w-4 h-4 mr-2 text-white/60" />
                      <span>API Calls</span>
                    </div>
                    <span className="text-sm text-white/60">
                      {usage.api_calls.used.toLocaleString()} / {usage.api_calls.limit.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(usage.api_calls.used, usage.api_calls.limit)}
                    className="h-2 bg-white/10"
                    indicatorClassName={getUsageColor(calculateUsagePercentage(usage.api_calls.used, usage.api_calls.limit))}
                  />
                </div>

                {/* AI Responses */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Brain className="w-4 h-4 mr-2 text-white/60" />
                      <span>AI Responses</span>
                    </div>
                    <span className="text-sm text-white/60">
                      {usage.ai_responses.used.toLocaleString()} / {usage.ai_responses.limit.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(usage.ai_responses.used, usage.ai_responses.limit)}
                    className="h-2 bg-white/10"
                    indicatorClassName={getUsageColor(calculateUsagePercentage(usage.ai_responses.used, usage.ai_responses.limit))}
                  />
                </div>

                {/* Storage */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <Database className="w-4 h-4 mr-2 text-white/60" />
                      <span>Storage</span>
                    </div>
                    <span className="text-sm text-white/60">
                      {usage.storage.used} GB / {usage.storage.limit} GB
                    </span>
                  </div>
                  <Progress
                    value={calculateUsagePercentage(usage.storage.used, usage.storage.limit)}
                    className="h-2 bg-white/10"
                    indicatorClassName={getUsageColor(calculateUsagePercentage(usage.storage.used, usage.storage.limit))}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Credit Purchase Modal */}
      <Dialog open={creditModalOpen} onOpenChange={setCreditModalOpen}>
        <DialogContent className="max-w-2xl bg-[#1a1a1a] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center text-2xl">
              <Sparkles className="w-6 h-6 mr-2 text-yellow-500" />
              Purchase Credits
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Add credits to your account for usage-based features
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Preset Options */}
            <div className="grid grid-cols-2 gap-3">
              {creditOptions.map((option) => (
                <Card
                  key={option.amount}
                  className={`relative p-4 cursor-pointer transition-all bg-[#0a0a0a] border-white/10 hover:border-white/30 ${
                    selectedCreditAmount === option.amount ? 'ring-2 ring-violet-500 border-violet-500' : ''
                  }`}
                  onClick={() => {
                    setSelectedCreditAmount(option.amount);
                    setCustomCreditAmount('');
                  }}
                >
                  {option.popular && (
                    <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white">
                      Popular
                    </Badge>
                  )}
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">${option.amount}</div>
                    <div className="flex items-center text-sm text-white/60">
                      <Zap className="w-3 h-3 mr-1" />
                      {option.credits} credits
                    </div>
                    {option.bonus > 0 && (
                      <Badge variant="secondary" className="text-xs bg-white/10">
                        +{Math.round((option.bonus / (option.credits - option.bonus)) * 100)}% bonus
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            {/* Custom Amount */}
            <div className="border-t border-white/10 pt-4">
              <label className="text-sm font-medium mb-2 block">Or enter custom amount</label>
              <Input
                type="number"
                placeholder="Enter amount (min $5)"
                value={customCreditAmount}
                onChange={(e) => {
                  setCustomCreditAmount(e.target.value);
                  setSelectedCreditAmount(null);
                }}
                className="bg-[#0a0a0a] border-white/10 text-white placeholder:text-white/40"
                min={5}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <Button
                variant="outline"
                onClick={() => setCreditModalOpen(false)}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePurchaseCredits}
                disabled={!selectedCreditAmount && (!customCreditAmount || parseFloat(customCreditAmount) < 5)}
                className="bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
              >
                Purchase {selectedCreditAmount ? `$${selectedCreditAmount}` : customCreditAmount ? `$${customCreditAmount}` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}