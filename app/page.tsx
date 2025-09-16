"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { HanzoLogo } from "@/components/HanzoLogo";
import { 
  ArrowRight, 
  Code2, 
  Sparkles, 
  ChevronRight, 
  Terminal,
  Download,
  Github,
  Globe,
  Zap,
  Blocks,
  Cpu,
  Shield
} from "lucide-react";
import { useUser } from "@/hooks/useUser";

export default function LandingPage() {
  const { openLoginWindow, user } = useUser();
  const [typedText, setTypedText] = useState("");
  const [isTyping, setIsTyping] = useState(true);
  
  const fullText = "Build something amazing with Hanzo";

  useEffect(() => {
    if (typedText.length < fullText.length && isTyping) {
      const timeout = setTimeout(() => {
        setTypedText(fullText.slice(0, typedText.length + 1));
      }, 100);
      return () => clearTimeout(timeout);
    } else if (typedText.length === fullText.length) {
      const timeout = setTimeout(() => {
        setIsTyping(false);
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [typedText, isTyping, fullText]);

  const products = [
    {
      name: "Hanzo Studio",
      description: "AI-powered web development",
      icon: <Code2 className="w-5 h-5" />,
      href: user ? "/projects/new" : "#",
      action: user ? "Launch Studio" : "Sign in to start"
    },
    {
      name: "Hanzo Code",
      description: "Desktop AI coding assistant", 
      icon: <Terminal className="w-5 h-5" />,
      href: "https://github.com/hanzoai/hanzo-code/releases",
      action: "Download",
      external: true
    },
    {
      name: "Hanzo Cloud",
      description: "Deploy and scale AI apps",
      icon: <Globe className="w-5 h-5" />,
      href: "https://hanzo.ai/cloud",
      action: "Learn more",
      external: true
    }
  ];

  const features = [
    {
      icon: <Zap className="w-5 h-5" />,
      title: "Lightning Fast",
      description: "Generate production-ready code in seconds with advanced AI"
    },
    {
      icon: <Blocks className="w-5 h-5" />,
      title: "Component Library",
      description: "Pre-built components and templates for rapid development"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Enterprise Ready",
      description: "Built for scale with security and performance at its core"
    },
    {
      icon: <Cpu className="w-5 h-5" />,
      title: "AI Models",
      description: "Access to frontier models: Zen, Sho, and more"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Gradient effects */}
      <div className="fixed inset-0 bg-black">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-gradient-radial from-white/[0.04] via-transparent to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-gradient-radial from-white/[0.02] via-transparent to-transparent rounded-full blur-3xl" />
        </div>
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 lg:px-12">
        <Link href="/" className="flex items-center gap-3 group">
          <HanzoLogo className="w-9 h-9 text-white transition-transform group-hover:scale-110" />
          <span className="text-2xl font-bold">Hanzo</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link 
            href="https://github.com/hanzoai" 
            target="_blank"
            className="text-white/60 hover:text-white transition-colors"
          >
            <Github className="w-5 h-5" />
          </Link>
          
          {user ? (
            <Link href="/projects/new">
              <Button 
                size="lg"
                className="bg-white text-black hover:bg-white/90 font-semibold group"
              >
                Launch Studio
                <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          ) : (
            <>
              <Button 
                variant="ghost" 
                size="lg"
                onClick={openLoginWindow}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                Sign In
              </Button>
              <Button 
                size="lg"
                onClick={openLoginWindow}
                className="bg-white text-black hover:bg-white/90 font-semibold"
              >
                Get Started
              </Button>
            </>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 lg:px-12 pt-20 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm mb-8">
              <Sparkles className="w-4 h-4 text-yellow-400 animate-pulse" />
              <span className="text-sm text-white/70">Powered by Frontier AI Models</span>
            </div>
            
            {/* Main heading with typing effect */}
            <h1 className="text-5xl lg:text-7xl font-bold mb-6">
              <span className="block text-white/90 mb-2">
                {typedText}
                <span className={`inline-block ml-1 w-1 bg-white ${isTyping ? 'animate-pulse' : 'opacity-0'}`}>|</span>
              </span>
            </h1>
            
            <p className="text-xl text-white/60 max-w-3xl mx-auto mb-12 leading-relaxed">
              Transform ideas into production-ready applications with AI. 
              From concept to deployment in minutes, not months.
            </p>

            {/* CTA Buttons */}
            <div className="flex gap-4 justify-center mb-16">
              <Link href={user ? "/projects/new" : "#"}>
                <Button 
                  size="lg" 
                  className="bg-white text-black hover:bg-white/90 font-semibold text-lg px-8 py-6 group"
                  onClick={!user ? openLoginWindow : undefined}
                >
                  Start Building
                  <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="https://github.com/hanzoai/hanzo-code/releases" target="_blank">
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6"
                >
                  <Download className="mr-2 w-5 h-5" />
                  Download Desktop App
                </Button>
              </Link>
            </div>

            {/* Product Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {products.map((product, index) => (
                <Link 
                  key={index}
                  href={product.href}
                  target={product.external ? "_blank" : undefined}
                  onClick={product.name === "Hanzo Studio" && !user ? openLoginWindow : undefined}
                  className="group"
                >
                  <div className="relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 transition-all duration-300 hover:bg-white/10 hover:border-white/20">
                    <div className="flex items-start justify-between mb-4">
                      <div className="p-2 rounded-lg bg-white/10 text-white">
                        {product.icon}
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/40 transition-transform group-hover:translate-x-1" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{product.name}</h3>
                    <p className="text-sm text-white/60 mb-4">{product.description}</p>
                    <span className="text-sm text-white/80 font-medium">{product.action}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-6 lg:px-12 py-20 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Built for modern development
            </h2>
            <p className="text-lg text-white/60">
              Everything you need to ship faster
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="group">
                <div className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300">
                  <div className="inline-flex p-3 rounded-lg bg-gradient-to-br from-white/10 to-white/5 mb-4 group-hover:from-white/20 group-hover:to-white/10 transition-all">
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-white/60">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 lg:px-12 py-24">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-b from-white/10 to-white/5 border border-white/20">
            <h2 className="text-3xl lg:text-5xl font-bold mb-6">
              Ready to build the future?
            </h2>
            <p className="text-xl text-white/60 mb-8">
              Join thousands of developers building with Hanzo AI
            </p>
            <div className="flex gap-4 justify-center">
              <Link href={user ? "/projects/new" : "#"}>
                <Button 
                  size="lg"
                  className="bg-white text-black hover:bg-white/90 font-semibold text-lg px-10 py-7 group"
                  onClick={!user ? openLoginWindow : undefined}
                >
                  Start Building Free
                  <ChevronRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/10 px-6 lg:px-12 py-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <HanzoLogo className="w-7 h-7 text-white" />
            <span className="text-lg font-semibold">Hanzo</span>
          </div>
          
          <div className="flex gap-8 text-sm text-white/60">
            <Link href="https://docs.hanzo.ai" target="_blank" className="hover:text-white transition-colors">Documentation</Link>
            <Link href="https://github.com/hanzoai" target="_blank" className="hover:text-white transition-colors">GitHub</Link>
            <Link href="https://discord.gg/hanzo" target="_blank" className="hover:text-white transition-colors">Discord</Link>
            <Link href="https://twitter.com/hanzoai" target="_blank" className="hover:text-white transition-colors">Twitter</Link>
          </div>

          <div className="text-sm text-white/40">
            © 2025 Hanzo AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}