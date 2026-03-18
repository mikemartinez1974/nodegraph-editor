import { getMissingGitHubConfig } from "../_lib/config.js";
import { getGithubSession, json } from "../_lib/session.js";

export async function GET(request) {
  const missing = getMissingGitHubConfig(request);
  const session = getGithubSession(request);
  return json({
    ok: true,
    configured: missing.length === 0,
    missing,
    authenticated: Boolean(session?.githubUser?.login),
    session: session
      ? {
          twiliteUserId: session.twiliteUserId || null,
          githubUser: session.githubUser || null,
          activeInstallationId: session.activeInstallationId || null,
        }
      : null,
  });
}

