import { NextResponse } from "next/server";
import { clearGithubSession } from "../_lib/session.js";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearGithubSession(response);
  return response;
}

