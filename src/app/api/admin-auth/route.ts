import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { password } = await req.json();
  
  if (password === process.env.ADMIN_BYPASS_PASSWORD) {
    (await cookies()).set("admin_token", "authorized", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
    });
    return NextResponse.json({ success: true });
  }
  
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}