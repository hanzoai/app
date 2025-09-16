import { headers } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const authHeaders = await headers();
  const token = authHeaders.get("Authorization");
  if (!token) {
    return NextResponse.json({ user: null, errCode: 401 }, { status: 401 });
  }

  // Handle local development mode
  if (process.env.HF_TOKEN === "local_dev_token" && token.includes("local_dev_token")) {
    const localUser = {
      id: "local-user",
      name: "local-user",
      fullname: "Local Development User",
      avatarUrl: "/logo.svg",
      isPro: true,
      isLocalUse: true
    };
    return NextResponse.json({ user: localUser, errCode: null }, { status: 200 });
  }

  const userResponse = await fetch("https://huggingface.co/api/whoami-v2", {
    headers: {
      Authorization: `${token}`,
    },
  });

  if (!userResponse.ok) {
    return NextResponse.json(
      { user: null, errCode: userResponse.status },
      { status: userResponse.status }
    );
  }
  const user = await userResponse.json();
  return NextResponse.json({ user, errCode: null }, { status: 200 });
}
