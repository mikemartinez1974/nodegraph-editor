import { createInstallationAccessToken, readRepositoryFile } from "../_lib/github.js";
import { getGithubSession, json } from "../_lib/session.js";

const parseRepo = (repo = "") => {
  const [owner = "", name = ""] = String(repo).trim().split("/");
  if (!owner || !name) return null;
  return { owner, repo: name };
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const repoInfo = parseRepo(body?.repo || "");
  const path = String(body?.path || "").trim().replace(/^\/+/, "");
  const branch = String(body?.branch || "main").trim() || "main";
  const allowPublic = body?.allowPublic !== false;
  const session = getGithubSession(request);
  const installationId = String(body?.installationId || session?.activeInstallationId || "").trim();

  if (!repoInfo || !path) {
    return json({ ok: false, message: "repo and path are required." }, { status: 400 });
  }

  try {
    let token = "";
    if (installationId) {
      token = await createInstallationAccessToken(request, installationId);
    } else if (!allowPublic) {
      return json({ ok: false, message: "No installation selected." }, { status: 401 });
    }

    const file = await readRepositoryFile({
      token,
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      path,
      branch,
    });

    return json({
      ok: true,
      content: file.content,
      sha: file.sha,
      repo: `${repoInfo.owner}/${repoInfo.repo}`,
      path,
      branch,
      authenticated: Boolean(token),
    });
  } catch (error) {
    if (allowPublic && installationId) {
      try {
        const file = await readRepositoryFile({
          token: "",
          owner: repoInfo.owner,
          repo: repoInfo.repo,
          path,
          branch,
        });
        return json({
          ok: true,
          content: file.content,
          sha: file.sha,
          repo: `${repoInfo.owner}/${repoInfo.repo}`,
          path,
          branch,
          authenticated: false,
        });
      } catch {}
    }
    return json({ ok: false, message: error.message || "Failed to read GitHub file." }, { status: 500 });
  }
}

