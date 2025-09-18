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

  // Get token from cookie or headers
  const cookieToken = cookieStore.get(MY_TOKEN_KEY())?.value;
  const headerToken = authHeaders.get("Authorization");

  let token = headerToken;
  if (cookieToken) {
    // Cookie already contains the raw token, add Bearer prefix
    token = `Bearer ${cookieToken}`;
  }

  if (!token) {
    console.log("Auth failed: No token found in cookies or headers");
    return NextResponse.json(
      {
        ok: false,
        message: "Wrong castle fam :(",
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
