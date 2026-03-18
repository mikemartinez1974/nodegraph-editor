import { NextResponse } from "next/server";
import { buildGitHubLoginUrl, createOAuthState } from "../_lib/github.js";
import { getMissingGitHubConfig } from "../_lib/config.js";
import { json, setOAuthState } from "../_lib/session.js";

export async function GET(request) {
  const missing = getMissingGitHubConfig(request);
  if (missing.length > 0) {
    return json(
      {
        ok: false,
        message: "GitHub auth is not configured.",
        missing,
      },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") || "/";
  const state = createOAuthState(returnTo);
  const response = NextResponse.redirect(buildGitHubLoginUrl(request, state));
  setOAuthState(request, response, state);
  return response;
}

