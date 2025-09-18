"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import { Loader2 } from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const { user, loading } = useUser();

  useEffect(() => {
    // If user is logged in, redirect to home page with chat interface
    // If not logged in, redirect to login
    if (!loading) {
      if (user) {
        // Redirect to the main page which has the chat interface
        router.push("/");
      } else {
        // Not logged in, redirect to login
        router.push("/login");
      }
    }
  }, [user, loading, router]);

  // Show loading state while checking auth
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex items-center gap-3 text-white">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-lg">Loading projects...</span>
      </div>
    </div>
  );
}