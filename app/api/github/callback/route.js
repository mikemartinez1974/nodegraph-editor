import { NextResponse } from "next/server";
import { exchangeCodeForUserToken, fetchGitHubUser } from "../_lib/github.js";
import { clearOAuthState, getOAuthState, setGithubSession } from "../_lib/session.js";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const stateParam = url.searchParams.get("state") || "";
  const oauthState = getOAuthState(request);

  if (!code || !oauthState || oauthState.nonce !== stateParam) {
    const failure = NextResponse.redirect(new URL("/?githubAuth=invalid-state", request.url));
    clearOAuthState(failure);
    return failure;
  }

  try {
    const userToken = await exchangeCodeForUserToken(request, code);
    const githubUser = await fetchGitHubUser(userToken);
    const destination = oauthState.returnTo || "/";
    const response = NextResponse.redirect(new URL(destination, request.url));
    clearOAuthState(response);
    setGithubSession(request, response, {
      twiliteUserId: null,
      githubUser: {
        id: githubUser.id,
        login: githubUser.login,
        name: githubUser.name || "",
        avatarUrl: githubUser.avatar_url || "",
      },
      githubUserToken: userToken,
      activeInstallationId: null,
    });
    return response;
  } catch (error) {
    const failure = NextResponse.redirect(new URL("/?githubAuth=failed", request.url));
    clearOAuthState(failure);
    return failure;
  }
}

