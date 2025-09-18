import { User } from "@/types";
import { cookies, headers } from "next/headers";
import MY_TOKEN_KEY from "./get-cookie-name";

// UserResponse = type User & { token: string };
type UserResponse = User & { token: string };

export const isAuthenticated = async (): Promise<UserResponse | undefined> => {
  const authHeaders = await headers();
  const cookieStore = await cookies();

  // Check if request is from localhost - allow without auth for operational simplicity
  const host = authHeaders.get("host") || "";
  const origin = authHeaders.get("origin") || "";
  const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1") ||
                      origin.includes("localhost") || origin.includes("127.0.0.1");

  if (isLocalhost && process.env.NODE_ENV === "development") {
    console.log("Local access detected - bypassing authentication");
    // Return a mock local user for development
    return {
      id: "local-dev-user",
      name: "Local Developer",
      fullname: "Local Development User",
      avatarUrl: "",
      isPro: true,
      isLocalUse: true,
      token: "local-dev-token",
    };
  }

  // For production or non-localhost, check for API key or HF token
  const cookieToken = cookieStore.get(MY_TOKEN_KEY())?.value;
  const headerToken = authHeaders.get("Authorization");
  const localApiKey = authHeaders.get("X-Local-API-Key") || process.env.LOCAL_API_KEY;

  // Allow access with local API key for hanzod
  if (localApiKey && localApiKey === process.env.LOCAL_API_KEY) {
    console.log("Local API key authentication successful");
    return {
      id: "api-user",
      name: "API User",
      fullname: "Hanzo API User",
      avatarUrl: "",
      isPro: true,
      isLocalUse: true,
      token: localApiKey,
    };
  }

  let token = headerToken;
  if (cookieToken) {
    // Cookie already contains the raw token, add Bearer prefix
    token = `Bearer ${cookieToken}`;
  }

  if (!token) {
    console.log("Auth failed: No token found and not localhost");
    return undefined; // Return undefined instead of NextResponse for server actions
  }

  console.log("Verifying token with Hugging Face API...");

  try {
    const response = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: {
        Authorization: token,
      },
      method: "GET",
    });

    if (!response.ok) {
      console.log("HF API response not OK:", response.status);
      return undefined; // Return undefined instead of NextResponse for server actions
    }

    const user = await response.json();

    if (!user || !user.id) {
      console.log("Invalid user data received:", user);
      return undefined; // Return undefined instead of NextResponse for server actions
    }

    console.log("Auth successful for user:", user.name || user.id);

    // Map HF user to our User type
    return {
      id: user.id,
      name: user.name || user.id,
      fullname: user.fullname || user.name || user.id,
      avatarUrl: user.avatarUrl || "",
      isPro: user.isPro || false,
      token: token.replace("Bearer ", ""),
    };
  } catch (error) {
    console.error("Auth error:", error);
    return undefined; // Return undefined instead of NextResponse for server actions
  }
};
