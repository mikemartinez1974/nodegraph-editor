import { createInstallationAccessToken, readRepositoryFile, writeRepositoryFile } from "../_lib/github.js";
import { getGithubSession, json } from "../_lib/session.js";

const parseRepo = (repo = "") => {
  const [owner = "", name = ""] = String(repo).trim().split("/");
  if (!owner || !name) return null;
  return { owner, repo: name };
};

export async function POST(request) {
  const session = getGithubSession(request);
  if (!session?.githubUser?.login) {
    return json({ ok: false, message: "Not signed in with GitHub." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const repoInfo = parseRepo(body?.repo || "");
  const path = String(body?.path || "").trim().replace(/^\/+/, "");
  const branch = String(body?.branch || "main").trim() || "main";
  const message = String(body?.message || "").trim();
  const content = typeof body?.content === "string" ? body.content : "";
  const installationId = String(body?.installationId || session?.activeInstallationId || "").trim();

  if (!repoInfo || !path || !content) {
    return json({ ok: false, message: "repo, path, and content are required." }, { status: 400 });
  }
  if (!installationId) {
    return json({ ok: false, message: "No installation selected." }, { status: 400 });
  }

  try {
    const token = await createInstallationAccessToken(request, installationId);
    let sha = "";
    try {
      const existing = await readRepositoryFile({
        token,
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        path,
        branch,
      });
      sha = existing.sha || "";
    } catch {
      sha = "";
    }
    const result = await writeRepositoryFile({
      token,
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      path,
      branch,
      message,
      content,
      sha,
    });
    return json({ ok: true, result });
  } catch (error) {
    return json({ ok: false, message: error.message || "Failed to commit GitHub file." }, { status: 500 });
  }
}

