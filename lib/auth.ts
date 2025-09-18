import { User } from "@/types";
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import MY_TOKEN_KEY from "./get-cookie-name";

// UserResponse = type User & { token: string };
type UserResponse = User & { token: string };

export const isAuthenticated = async (): // req: NextRequest
Promise<UserResponse | NextResponse<unknown> | undefined> => {
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
      email: "dev@localhost",
      avatarUrl: "",
      isPro: true,
      canPay: true,
      type: "user",
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
      email: "api@hanzo.ai",
      avatarUrl: "",
      isPro: true,
      canPay: true,
      type: "user",
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
    return NextResponse.json(
      {
        ok: false,
        message: "Authentication required",
      },
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
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
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid token",
        },
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const user = await response.json();

    if (!user || !user.id) {
      console.log("Invalid user data received:", user);
      return NextResponse.json(
        {
          ok: false,
          message: "Invalid token",
        },
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log("Auth successful for user:", user.name || user.id);

    return {
      ...user,
      token: token.replace("Bearer ", ""),
    };
  } catch (error) {
    console.error("Auth error:", error);
    return NextResponse.json(
      {
        ok: false,
        message: "Authentication failed",
      },
      {
        status: 401,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
};
