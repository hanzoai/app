"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { MyProjects } from "@/components/my-projects";
import { useUser } from "@/hooks/useUser";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, LogOut, User } from "lucide-react";
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="border-b bg-white dark:bg-neutral-900 dark:border-neutral-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2">
                <HanzoLogo className="w-8 h-8" />
                <span className="font-bold text-xl">Hanzo</span>
              </Link>
              <span className="text-gray-500 dark:text-gray-400">|</span>
              <h1 className="text-lg font-medium">Dashboard</h1>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/projects/new">
                <Button size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  New Project
                </Button>
              </Link>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-neutral-800">
                <User className="w-4 h-4 text-gray-500" />
                <span className="text-sm">{user.name || user.id}</span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={logout}
                className="gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

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