import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import MY_TOKEN_KEY from "@/lib/get-cookie-name";

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(MY_TOKEN_KEY())?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, message: "No token found" },
        { status: 401 }
      );
    }

    // Verify token with Hugging Face
    const response = await fetch("https://huggingface.co/api/whoami-v2", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { authenticated: false, message: "Invalid token" },
        { status: 401 }
      );
    }

    const user = await response.json();

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          fullname: user.fullname,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { authenticated: false, message: "Authentication check failed" },
      { status: 500 }
    );
  }
}