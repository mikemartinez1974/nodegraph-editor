import { getGithubSession, json, setGithubSession } from "../_lib/session.js";

export async function POST(request) {
  const session = getGithubSession(request);
  if (!session?.githubUserToken) {
    return json({ ok: false, message: "Not authenticated with GitHub." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const installationId = body?.installationId ? String(body.installationId) : "";
  const response = json({ ok: true, activeInstallationId: installationId || null });
  setGithubSession(request, response, {
    ...session,
    activeInstallationId: installationId || null,
  });
  return response;
}

