"use client";

import { useEffect, useState } from "react";
import { AppEditor } from "@/components/editor";
import { Sparkles, Code2, Palette, Zap, Rocket, Brain } from "lucide-react";

const animatedIdeas = [
  { icon: <Sparkles className="w-5 h-5" />, text: "AI-powered dashboard with real-time analytics" },
  { icon: <Code2 className="w-5 h-5" />, text: "Full-stack app with authentication and database" },
  { icon: <Palette className="w-5 h-5" />, text: "Beautiful landing page with animations" },
  { icon: <Zap className="w-5 h-5" />, text: "Interactive data visualization platform" },
  { icon: <Rocket className="w-5 h-5" />, text: "SaaS platform with subscription billing" },
  { icon: <Brain className="w-5 h-5" />, text: "Machine learning model deployment interface" }
];

export default function DevPage() {
  const [currentIdea, setCurrentIdea] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Cycle through ideas
  useEffect(() => {
    const interval = setInterval(() => {
      setIsTyping(false);
      setTimeout(() => {
        setCurrentIdea((prev) => (prev + 1) % animatedIdeas.length);
        setIsTyping(true);
      }, 300);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Simulate loading and preload
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  }, []);

  if (isLoading) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-700 rounded-xl flex items-center justify-center mb-4 mx-auto animate-pulse">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Hanzo Dev</h2>
          <p className="text-gray-400">Initializing development environment...</p>

          <div className="mt-8 space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
              Loading AI models...
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
              Setting up MCP tools...
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              Preparing workspace...
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Start with empty project - AppEditor will handle the rest
  return <AppEditor isNew />;
}