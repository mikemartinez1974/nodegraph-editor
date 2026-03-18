import { fetchInstallationRepositories } from "../_lib/github.js";
import { getGithubSession, json } from "../_lib/session.js";

export async function GET(request) {
  const session = getGithubSession(request);
  if (!session?.githubUserToken) {
    return json({ ok: false, message: "Not authenticated with GitHub." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const installationId = searchParams.get("installationId") || session.activeInstallationId || "";
  if (!installationId) {
    return json({ ok: false, message: "No installation selected." }, { status: 400 });
  }

  try {
    const repositories = await fetchInstallationRepositories(session.githubUserToken, installationId);
    return json({
      ok: true,
      installationId,
      repositories: repositories.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        private: Boolean(repo.private),
        defaultBranch: repo.default_branch || "main",
        permissions: repo.permissions || {},
      })),
    });
  } catch (error) {
    return json({ ok: false, message: error.message || "Failed to load repositories." }, { status: 500 });
  }
}
