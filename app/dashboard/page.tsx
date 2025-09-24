"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MyProjects } from "@/components/my-projects";
import { useUser } from "@/hooks/useUser";
import Header from "@/components/layout/header";
import { HanzoLogo } from "@/components/HanzoLogo";

export default function DashboardPage() {
  const { user, loading, logout } = useUser();
  const router = useRouter();

  useEffect(() => {
    // If not logged in, redirect to login
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Render loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <HanzoLogo className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-500">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Render nothing while redirecting
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <HanzoLogo className="w-12 h-12 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Your Projects</h2>
          <p className="text-gray-500">Manage and deploy your AI-generated applications</p>
        </div>

        <MyProjects projects={[]} />
      </main>
    </div>
  );
}