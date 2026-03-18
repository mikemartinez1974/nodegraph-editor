import { fetchUserInstallations } from "../_lib/github.js";
import { getGithubSession, json } from "../_lib/session.js";

export async function GET(request) {
  const session = getGithubSession(request);
  if (!session?.githubUserToken) {
    return json({ ok: false, message: "Not authenticated with GitHub." }, { status: 401 });
  }
  try {
    const installations = await fetchUserInstallations(session.githubUserToken);
    return json({
      ok: true,
      installations: installations.map((installation) => ({
        id: installation.id,
        account: installation.account
          ? {
              login: installation.account.login,
              type: installation.account.type,
              avatarUrl: installation.account.avatar_url,
            }
          : null,
        appSlug: installation.app_slug || "",
        repositorySelection: installation.repository_selection || "",
        accessTokensUrl: installation.access_tokens_url || "",
      })),
      activeInstallationId: session.activeInstallationId || null,
    });
  } catch (error) {
    return json({ ok: false, message: error.message || "Failed to load installations." }, { status: 500 });
  }
}

