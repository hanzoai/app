/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCookie } from "react-use";
import { useRouter } from "next/navigation";

import { User } from "@/types";
import MY_TOKEN_KEY from "@/lib/get-cookie-name";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { getAuthCookieOptions, getIframeCookieOptions, getRemoveCookieOptions } from "@/lib/cookie-options";


export const useUser = (initialData?: {
  user: User | null;
  errCode: number | null;
}) => {
  const cookie_name = MY_TOKEN_KEY();
  const client = useQueryClient();
  const router = useRouter();
  const [, setCookie] = useCookie(cookie_name);
  const [currentRoute, setCurrentRoute] = useCookie("hanzo-currentRoute");

  const { data: { user, errCode } = { user: null, errCode: null }, isLoading } =
    useQuery({
      queryKey: ["user.me"],
      queryFn: async () => {
        return { user: initialData?.user, errCode: initialData?.errCode };
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: false,
      initialData: initialData
        ? { user: initialData?.user, errCode: initialData?.errCode }
        : undefined,
      enabled: false,
    });

  const { data: loadingAuth } = useQuery({
    queryKey: ["loadingAuth"],
    queryFn: async () => false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
  const setLoadingAuth = (value: boolean) => {
    client.setQueryData(["setLoadingAuth"], value);
  };

  const openLoginWindow = async () => {
    setCurrentRoute(window.location.pathname, getIframeCookieOptions());
    return router.push("/login");
  };

  const loginFromCode = async (code: string) => {
    setLoadingAuth(true);
    if (loadingAuth) return;

    try {
      const res = await api.post("/auth", { code });

      if (res.data && res.data.access_token) {
        setCookie(res.data.access_token, getAuthCookieOptions(res.data.expires_in));
        client.setQueryData(["user.me"], {
          user: res.data.user,
          errCode: null,
        });

        toast.success("Login successful!");

        // Check for redirect after login
        const redirectPath = localStorage.getItem("redirectAfterLogin");
        if (redirectPath) {
          localStorage.removeItem("redirectAfterLogin");
          setTimeout(() => {
            router.push(redirectPath);
          }, 500);
        } else {
          // Default redirect to projects
          setTimeout(() => {
            router.push("/projects");
          }, 500);
        }
      } else {
        throw new Error("No access token received");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      const errorMessage = err?.response?.data?.error ||
                          err?.data?.message ||
                          err.message ||
                          "Authentication failed. Please check your Hugging Face OAuth settings.";
      toast.error(errorMessage);

      // Redirect to home after error
      setTimeout(() => {
        router.push("/");
      }, 2000);
    } finally {
      setLoadingAuth(false);
    }
  };

  const logout = async () => {
    setCookie("", getRemoveCookieOptions());
    router.push("/");
    toast.success("Logout successful");
    client.setQueryData(["user.me"], {
      user: null,
      errCode: null,
    });
    window.location.reload();
  };

  return {
    user,
    errCode,
    loading: isLoading || loadingAuth,
    openLoginWindow,
    loginFromCode,
    logout,
  };
};
