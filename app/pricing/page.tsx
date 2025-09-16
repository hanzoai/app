"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HanzoLogo } from "@/components/HanzoLogo";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Zap, CreditCard, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const router = useRouter();

  const handleCheckout = async (planId: string) => {
    // TODO: Implement Stripe checkout
    router.push(`/api/stripe/checkout?plan=${planId}&billing=${billingCycle}`);
  };

  const plans = [
    {
      name: "Pay as you go",
      description: "Start building immediately, pay only for what you use",
      price: {
        monthly: "Usage-based",
        yearly: "Usage-based"
      },
      features: [
        { text: "$0.02 per AI response", included: true },
        { text: "$0.50 per 1,000 API calls", included: true },
        { text: "$0.10 per GB storage", included: true },
        { text: "No monthly commitment", included: true },
        { text: "All core features", included: true },
        { text: "Community support", included: true },
        { text: "Public & private projects", included: true },
        { text: "Pay only what you use", included: true },
      ],
      cta: "Start Building",
      highlighted: false,
      icon: <CreditCard className="w-5 h-5" />,
      planId: "pay-as-you-go"
    },
    {
      name: "Pro",
      description: "Everything you need to build and ship professional apps",
      price: {
        monthly: 20,
        yearly: 200  // $200/year = ~$16.67/month, saves $40
      },
      features: [
        { text: "Everything in pay-as-you-go", included: true },
        { text: "10,000 AI responses/month included", included: true },
        { text: "100,000 API calls/month included", included: true },
        { text: "50GB storage included", included: true },
        { text: "Priority support", included: true },
        { text: "Custom domains", included: true },
        { text: "Advanced AI models", included: true },
        { text: "Team collaboration", included: true },
        { text: "Analytics dashboard", included: true },
        { text: "No usage limits", included: true },
      ],
      cta: "Start Free Trial",
      highlighted: true,
      icon: <Zap className="w-5 h-5" />,
      badge: "Most Popular",
      planId: "pro"
    }
  ];

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
              <Link href="/community" className="text-white/70 hover:text-white">Community</Link>
              <Link href="/pricing" className="text-white font-medium">Pricing</Link>
              <Link href="/enterprise" className="text-white/70 hover:text-white">Enterprise</Link>
              <Link href="/learn" className="text-white/70 hover:text-white">Learn</Link>
            </div>
          </div>
          <Button className="bg-white text-black hover:bg-white/90">
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-4 md:px-8 py-16 md:py-24 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0">
            <Sparkles className="w-4 h-4 mr-2" />
            Simple, Transparent Pricing
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            Choose the plan that{" "}
            <span className="bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
              fits your needs
            </span>
          </h1>
          <p className="text-xl text-white/60 mb-8 max-w-2xl mx-auto">
            Start free and scale as you grow. No hidden fees, no surprises.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                billingCycle === "monthly"
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                billingCycle === "yearly"
                  ? "bg-white text-black"
                  : "text-white/70 hover:text-white"
              }`}
            >
              Yearly
              <Badge className="ml-2 bg-green-500/20 text-green-400 border-green-500/30">
                Save $40
              </Badge>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="px-4 md:px-8 pb-20">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border ${
                  plan.highlighted
                    ? "border-violet-500/50 bg-gradient-to-b from-violet-950/20 to-transparent"
                    : "border-white/10 bg-[#1a1a1a]"
                } p-8`}
              >
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0">
                      {plan.badge}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg ${
                    plan.highlighted ? "bg-violet-500/20" : "bg-white/10"
                  }`}>
                    {plan.icon}
                  </div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                </div>

                <p className="text-white/60 mb-6">{plan.description}</p>

                <div className="mb-8">
                  {typeof plan.price[billingCycle] === "number" ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">
                        ${plan.price[billingCycle]}
                      </span>
                      <span className="text-white/60">
                        /{billingCycle === "monthly" ? "month" : "year"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-4xl font-bold">{plan.price[billingCycle]}</div>
                  )}
                </div>

                <Button
                  onClick={() => handleCheckout(plan.planId)}
                  className={`w-full mb-8 ${
                    plan.highlighted
                      ? "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400"
                      : "bg-white/10 hover:bg-white/20"
                  }`}
                  size="lg"
                >
                  {plan.cta}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>

                <div className="space-y-4">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-white">
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 md:px-8 py-20 border-t border-white/10">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold mb-3">Can I change plans anytime?</h3>
              <p className="text-white/60">
                Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate any charges or credits.
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold mb-3">What payment methods do you accept?</h3>
              <p className="text-white/60">
                We accept all major credit cards (Visa, MasterCard, American Express), as well as PayPal and wire transfers for enterprise customers.
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold mb-3">Is there a free trial for Pro plans?</h3>
              <p className="text-white/60">
                Yes! All Pro plans come with a 14-day free trial. No credit card required to start.
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <h3 className="text-xl font-semibold mb-3">What happens if I exceed my limits?</h3>
              <p className="text-white/60">
                We'll notify you when you're approaching your limits. You can upgrade your plan anytime to get more resources.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 md:px-8 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to build something amazing?
          </h2>
          <p className="text-xl text-white/60 mb-8">
            Join thousands of developers using Hanzo AI to build faster
          </p>
          <Button size="lg" className="bg-white text-black hover:bg-white/90">
            Start Free Trial
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>
    </div>
  );
}