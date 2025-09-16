"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { HanzoLogo } from "@/components/HanzoLogo";
import { 
  ArrowRight,
  MessageSquare,
  Github,
  Download,
  Sparkles,
  Globe,
  Shield,
  Users,
  Zap,
  Code2,
  Layers,
  Building2,
  Rocket,
  Brain,
  LineChart,
  X,
  Send,
  Copy,
  RefreshCw
} from "lucide-react";
import { useUser } from "@/hooks/useUser";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const { openLoginWindow, user } = useUser();
  const router = useRouter();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<{text: string, sender: 'user' | 'ai'}[]>([
    { text: "Hey! I'm Hanzo. Tell me what you want to build and I'll create it for you.", sender: 'ai' }
  ]);

  const templates = [
    {
      id: "fintech",
      name: "fintech-template",
      type: "Website",
      remixes: 4710,
      description: "Build modern, secure finance apps with ease.",
      icon: "💸",
      gradient: "from-emerald-500 to-teal-600"
    },
    {
      id: "glow",
      name: "glow-convert-sell",
      type: "Website", 
      remixes: 3264,
      description: "A sleek landing page for product-led growth.",
      icon: "✨",
      gradient: "from-purple-500 to-pink-600"
    },
    {
      id: "crypto",
      name: "cryptocurrency-trading-dashboard",
      type: "Website",
      remixes: 17411,
      description: "Full-featured dashboard for real-time crypto tracking.",
      icon: "📊",
      gradient: "from-blue-500 to-cyan-600"
    },
    {
      id: "cortex",
      name: "cortex-second-brain",
      type: "Consumer App",
      remixes: 6319,
      description: "Organize your digital life with AI.",
      icon: "🧠",
      gradient: "from-violet-500 to-purple-600"
    },
    {
      id: "pulse",
      name: "pulse-robot-template",
      type: "Website",
      remixes: 32980,
      description: "Our most remixed startup landing page — fast and flexible.",
      icon: "🚀",
      gradient: "from-orange-500 to-red-600"
    }
  ];

  const categories = [
    { name: "Websites", icon: Globe },
    { name: "Consumer Apps", icon: Brain },
    { name: "Internal Tools", icon: Building2 },
    { name: "Prototypes", icon: Rocket },
    { name: "B2B SaaS", icon: LineChart },
    { name: "Landing Pages", icon: Layers }
  ];

  const handleStartBuilding = () => {
    if (user) {
      router.push("/projects/new");
    } else {
      openLoginWindow();
    }
  };

  const handleSendMessage = () => {
    if (chatMessage.trim()) {
      setChatMessages([...chatMessages, 
        { text: chatMessage, sender: 'user' },
        { text: "I'll help you build that! Let me create a project for you...", sender: 'ai' }
      ]);
      setChatMessage("");
      // In production, this would trigger actual AI generation
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-950/20 via-black to-blue-950/20" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-white/[0.02] to-transparent rounded-full" />
      </div>
      
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 border-b border-white/5 backdrop-blur-sm">
        <Link href="/" className="flex items-center gap-3 group">
          <HanzoLogo className="w-8 h-8 text-white transition-transform group-hover:scale-110" />
          <span className="text-xl font-bold">Hanzo</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link 
            href="https://github.com/hanzoai" 
            target="_blank"
            className="text-white/60 hover:text-white transition-colors"
          >
            <Github className="w-5 h-5" />
          </Link>
          
          <Link 
            href="https://github.com/hanzoai/hanzo-code/releases" 
            target="_blank"
            className="text-white/60 hover:text-white transition-colors"
          >
            <Download className="w-5 h-5" />
          </Link>
          
          {user ? (
            <Button 
              onClick={handleStartBuilding}
              className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white border-0"
            >
              Launch Studio
              <Sparkles className="ml-2 w-4 h-4" />
            </Button>
          ) : (
            <>
              <Button 
                variant="ghost"
                onClick={openLoginWindow}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                Log In
              </Button>
              <Button 
                onClick={handleStartBuilding}
                className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white border-0"
              >
                Get Started
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="px-6 pt-20 pb-16 max-w-6xl mx-auto text-center">
          <Badge variant="outline" className="mb-6 border-violet-500/50 text-violet-300 bg-violet-500/10">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered Builder
          </Badge>
          
          <h1 className="text-5xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-white/90 to-white/60 bg-clip-text text-transparent">
            Build Something Lovable
          </h1>
          
          <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">
            Create apps and websites by chatting with AI. Launch stunning projects in minutes. 
            No code. No hassle. Just creativity.
          </p>
          
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg"
              onClick={handleStartBuilding}
              className="bg-white text-black hover:bg-white/90 text-lg px-8 py-6 group"
            >
              <Zap className="mr-2 w-5 h-5" />
              Start Building
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6"
              onClick={() => setIsChatOpen(true)}
            >
              <MessageSquare className="mr-2 w-5 h-5" />
              Try Chat Demo
            </Button>
          </div>
        </section>

        {/* From the Community Section */}
        <section className="px-6 py-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-gradient-to-r from-purple-600 to-pink-600 border-0">
                <Users className="w-3 h-3 mr-1" />
                From the Community
              </Badge>
              <h2 className="text-4xl font-bold mb-4">Trending Templates</h2>
              <p className="text-white/60 text-lg">
                Explore thousands of projects built and remixed by makers like you
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {templates.map((template) => (
                <Card 
                  key={template.id} 
                  className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group cursor-pointer"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-3xl">{template.icon}</span>
                      <Badge variant="secondary" className="bg-white/10 text-white/70 border-0">
                        {template.type}
                      </Badge>
                    </div>
                    <CardTitle className="text-white text-xl">{template.name}</CardTitle>
                    <CardDescription className="text-white/60">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm text-white/50">
                      <span className="flex items-center gap-1">
                        <RefreshCw className="w-4 h-4" />
                        {template.remixes.toLocaleString()} remixes
                      </span>
                    </div>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="text-white/70 hover:text-white hover:bg-white/10"
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Remix
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            <div className="text-center mt-8">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Browse All Templates
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Build Anything Section */}
        <section className="px-6 py-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 border-0">
                <Code2 className="w-3 h-3 mr-1" />
                Build Anything
              </Badge>
              <h2 className="text-4xl font-bold mb-4">Just describe what you need</h2>
              <p className="text-white/60 text-lg">
                Hanzo turns your ideas into working products — instantly
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories.map((category) => (
                <div 
                  key={category.name}
                  className="p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:from-white/10 hover:to-white/5 hover:border-white/20 transition-all text-center group cursor-pointer"
                >
                  <category.icon className="w-8 h-8 mx-auto mb-2 text-white/60 group-hover:text-white transition-colors" />
                  <span className="text-sm text-white/80">{category.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Powered by Community Section */}
        <section className="px-6 py-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <Card className="bg-gradient-to-br from-violet-950/50 to-blue-950/50 border-white/10">
              <CardContent className="p-12 text-center">
                <Badge className="mb-6 bg-gradient-to-r from-violet-600 to-purple-600 border-0">
                  <Users className="w-3 h-3 mr-1" />
                  Powered by Community
                </Badge>
                <h2 className="text-4xl font-bold mb-4">
                  Join thousands of builders
                </h2>
                <p className="text-white/70 text-lg mb-8 max-w-2xl mx-auto">
                  Remixing, sharing, and collaborating in real time
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">✅</div>
                    <span className="text-sm text-white/70">1-click remix</span>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">✅</div>
                    <span className="text-sm text-white/70">No-code customization</span>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">✅</div>
                    <span className="text-sm text-white/70">AI chat builder</span>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-white mb-1">✅</div>
                    <span className="text-sm text-white/70">Share instantly</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Zen of Hanzo Section */}
        <section className="px-6 py-20 border-t border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <Badge className="mb-6 bg-gradient-to-r from-amber-600 to-orange-600 border-0">
                <Sparkles className="w-3 h-3 mr-1" />
                The Zen of Hanzo
              </Badge>
              <h2 className="text-4xl lg:text-5xl font-bold mb-6">Our Guiding Principles</h2>
              <p className="text-white/60 text-lg max-w-3xl mx-auto">
                64 principles across 8 disciplines that guide everything we build. 
                These are the foundations of engineering excellence.
              </p>
            </div>

            {/* Disciplines Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-12">
              {[
                { name: "Empathy", emoji: "❤️", color: "from-pink-500 to-rose-500" },
                { name: "Science", emoji: "🔬", color: "from-blue-500 to-cyan-500" },
                { name: "Design", emoji: "🎨", color: "from-purple-500 to-violet-500" },
                { name: "Engineering", emoji: "⚙️", color: "from-gray-500 to-zinc-500" },
                { name: "Scale", emoji: "📈", color: "from-green-500 to-emerald-500" },
                { name: "Wisdom", emoji: "🦉", color: "from-amber-500 to-yellow-500" },
                { name: "Execution", emoji: "⚡", color: "from-orange-500 to-red-500" },
                { name: "Innovation", emoji: "💡", color: "from-indigo-500 to-blue-500" }
              ].map((discipline) => (
                <div 
                  key={discipline.name}
                  className="relative group cursor-pointer"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${discipline.color} opacity-0 group-hover:opacity-20 rounded-xl transition-opacity blur-xl`} />
                  <div className="relative p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-center">
                    <div className="text-2xl mb-2">{discipline.emoji}</div>
                    <div className="text-xs font-medium text-white/80">{discipline.name}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Sample Principles */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  emoji: "🦅",
                  title: "Autonomy",
                  description: "Trust fully; freedom fuels genius.",
                  discipline: "Empathy"
                },
                {
                  emoji: "🔬",
                  title: "Empiricism",
                  description: "Hypothesize, measure; reality defines truth.",
                  discipline: "Science"
                },
                {
                  emoji: "🎨",
                  title: "Beauty",
                  description: "Aesthetics matter; delight drives adoption.",
                  discipline: "Design"
                },
                {
                  emoji: "🔧",
                  title: "Composability",
                  description: "Build blocks; combine infinitely.",
                  discipline: "Engineering"
                },
                {
                  emoji: "🚀",
                  title: "Velocity",
                  description: "Ship fast; learn faster.",
                  discipline: "Scale"
                },
                {
                  emoji: "🔐",
                  title: "Security",
                  description: "Paranoia justified; trust earned slowly.",
                  discipline: "Wisdom"
                }
              ].map((principle, i) => (
                <Card 
                  key={i}
                  className="bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 hover:from-white/10 hover:to-white/5 hover:border-white/20 transition-all group"
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-xl">
                          {principle.emoji}
                        </div>
                        <div>
                          <CardTitle className="text-white text-lg">{principle.title}</CardTitle>
                          <Badge variant="outline" className="mt-1 text-xs border-white/20 text-white/60">
                            {principle.discipline}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-white/70 italic">&ldquo;{principle.description}&rdquo;</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="text-center mt-12">
              <Button 
                variant="outline" 
                className="border-white/20 text-white hover:bg-white/10"
                onClick={() => window.open('https://hanzo.ai/zen', '_blank')}
              >
                Explore All 64 Principles
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Hexagrams Section */}
        <section className="px-6 py-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <Card className="bg-gradient-to-br from-amber-950/30 to-orange-950/30 border-amber-500/20">
              <CardContent className="p-12">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <Badge className="mb-4 bg-gradient-to-r from-amber-600 to-orange-600 border-0">
                      ☯️ I Ching Wisdom
                    </Badge>
                    <h3 className="text-3xl font-bold mb-4">Engineering Hexagrams</h3>
                    <p className="text-white/70 mb-6">
                      Ancient wisdom meets modern engineering. Each hexagram represents a fundamental pattern 
                      in system design and problem-solving.
                    </p>
                    <div className="space-y-2">
                      {[
                        { hex: "乾", meaning: "Adapt to new contexts while maintaining principles" },
                        { hex: "巽", meaning: "Use subtle persuasion over force" },
                        { hex: "兌", meaning: "Create positive experiences to motivate" },
                        { hex: "中孚", meaning: "Maintain integrity in all actions" }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm">
                          <span className="text-2xl text-amber-400">{item.hex}</span>
                          <span className="text-white/60">{item.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="relative w-48 h-48">
                      <div className="absolute inset-0 bg-gradient-radial from-amber-500/20 to-transparent rounded-full blur-3xl" />
                      <div className="relative w-full h-full rounded-full border-2 border-amber-500/30 flex items-center justify-center">
                        <div className="text-6xl text-amber-400">☯️</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* For Teams Section */}
        <section className="px-6 py-16 border-t border-white/5">
          <div className="max-w-6xl mx-auto text-center">
            <Badge className="mb-4 bg-gradient-to-r from-blue-600 to-green-600 border-0">
              <Building2 className="w-3 h-3 mr-1" />
              For Teams & Enterprises
            </Badge>
            <h2 className="text-3xl font-bold mb-4">Looking for secure, scalable internal tools?</h2>
            <p className="text-white/60 mb-8">Enterprise-grade security and a focus on privacy</p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                Explore Hanzo for Enterprise
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/10">
                <Shield className="mr-2 w-4 h-4" />
                Visit Trust Center
              </Button>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 py-24 border-t border-white/5">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-gradient-to-r from-yellow-600 to-orange-600 border-0">
              <Sparkles className="w-3 h-3 mr-1" />
              Join the Movement
            </Badge>
            <h2 className="text-4xl lg:text-5xl font-bold mb-6">
              Thousands of makers are already using Hanzo
            </h2>
            <p className="text-xl text-white/60 mb-8">
              Whether you&apos;re a solo founder, designer, or enterprise team — Hanzo empowers you to ship fast and often
            </p>
            <Button 
              size="lg"
              onClick={handleStartBuilding}
              className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-lg px-10 py-7 border-0"
            >
              Get Started for Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-12 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Careers</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Press</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Enterprise</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Partnerships</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Pricing</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Changelog</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Student Discount</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Connections</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Resources</h3>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Guides</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Videos</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Blog</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Support</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Legal</h3>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Privacy</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Terms</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Cookies</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Report Abuse</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white mb-4">Community</h3>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Discord</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Reddit</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">Twitter</Link></li>
                  <li><Link href="#" className="text-sm text-white/60 hover:text-white">GitHub</Link></li>
                </ul>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <HanzoLogo className="w-6 h-6 text-white" />
                <span className="text-sm text-white/60">© 2025 Hanzo AI. All rights reserved.</span>
              </div>
              <div className="flex items-center gap-4">
                <Input 
                  type="email" 
                  placeholder="Subscribe to updates" 
                  className="w-64 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                />
                <Button variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0">
                  Subscribe
                </Button>
              </div>
            </div>
          </div>
        </footer>
      </main>

      {/* Enhanced Chat Widget */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all ${isChatOpen ? 'w-96' : 'w-auto'}`}>
        {!isChatOpen ? (
          <button
            onClick={() => setIsChatOpen(true)}
            className="p-4 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-full shadow-2xl hover:scale-110 transition-all group"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          </button>
        ) : (
          <Card className="w-full h-[500px] bg-neutral-950/95 backdrop-blur-xl border-white/20 shadow-2xl">
            <CardHeader className="bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-t-lg">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <CardTitle className="text-lg">Chat with Hanzo</CardTitle>
                </div>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-4 h-[380px] overflow-y-auto space-y-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.sender === 'user' 
                      ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' 
                      : 'bg-white/10 text-white/90'
                  }`}>
                    <p className="text-sm">{msg.text}</p>
                  </div>
                </div>
              ))}
            </CardContent>
            <CardFooter className="p-4 border-t border-white/10">
              <div className="flex w-full gap-2">
                <Input 
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Describe what you want to build..."
                  className="flex-1 bg-white/5 border-white/20 text-white placeholder:text-white/40"
                />
                <Button 
                  onClick={handleSendMessage}
                  className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white border-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}