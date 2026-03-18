import crypto from "node:crypto";
import { getGitHubAuthConfig, getGitHubCallbackUrl } from "./config.js";

const GITHUB_API_BASE = "https://api.github.com";

const githubHeaders = (token = "") => {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const encodeSegmentPath = (path = "") =>
  String(path)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const base64urlJson = (value) =>
  Buffer.from(JSON.stringify(value), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

export const createOAuthState = (returnTo = "/") => ({
  nonce: crypto.randomBytes(16).toString("hex"),
  returnTo,
  createdAt: Date.now(),
});

export const buildGitHubLoginUrl = (request, state) => {
  const { clientId } = getGitHubAuthConfig(request);
  const redirectUri = getGitHubCallbackUrl(request);
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state.nonce);
  url.searchParams.set("scope", "read:user user:email read:org");
  url.searchParams.set("allow_signup", "true");
  return url.toString();
};

export const exchangeCodeForUserToken = async (request, code) => {
  const { clientId, clientSecret } = getGitHubAuthConfig(request);
  const redirectUri = getGitHubCallbackUrl(request);
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || "GitHub OAuth exchange failed");
  }
  if (!payload.access_token) {
    throw new Error("GitHub OAuth exchange did not return an access token");
  }
  return payload.access_token;
};

export const fetchGitHubUser = async (userToken) => {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: githubHeaders(userToken),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `GitHub user lookup failed (${response.status})`);
  }
  return payload;
};

export const fetchUserInstallations = async (userToken) => {
  const response = await fetch(`${GITHUB_API_BASE}/user/installations`, {
    headers: githubHeaders(userToken),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `GitHub installations lookup failed (${response.status})`);
  }
  return Array.isArray(payload.installations) ? payload.installations : [];
};

export const fetchInstallationRepositories = async (userToken, installationId) => {
  const response = await fetch(`${GITHUB_API_BASE}/user/installations/${installationId}/repositories`, {
    headers: githubHeaders(userToken),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `GitHub repositories lookup failed (${response.status})`);
  }
  return Array.isArray(payload.repositories) ? payload.repositories : [];
};

export const createAppJwt = (request) => {
  const { appId, privateKey } = getGitHubAuthConfig(request);
  if (!appId || !privateKey) {
    throw new Error("GitHub App credentials are not configured.");
  }
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iat: now - 60,
    exp: now + 9 * 60,
    iss: appId,
  };
  const signingInput = `${base64urlJson(header)}.${base64urlJson(payload)}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(signingInput, "utf8"), privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${signingInput}.${signature}`;
};

export const createInstallationAccessToken = async (request, installationId) => {
  const jwt = createAppJwt(request);
  const response = await fetch(`${GITHUB_API_BASE}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      ...githubHeaders(jwt),
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.token) {
    throw new Error(payload.message || `Failed to create installation token (${response.status})`);
  }
  return payload.token;
};

export const readRepositoryFile = async ({ token = "", owner, repo, path, branch = "main" }) => {
  const safePath = encodeSegmentPath(path);
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}?ref=${encodeURIComponent(branch)}`;
  const response = await fetch(url, {
    headers: githubHeaders(token),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `GitHub read failed (${response.status})`);
  }
  if (!payload || payload.type !== "file" || !payload.content) {
    throw new Error("GitHub response did not include file content.");
  }
  return {
    sha: payload.sha || "",
    content: Buffer.from(String(payload.content).replace(/\n/g, ""), "base64").toString("utf8"),
  };
};

export const writeRepositoryFile = async ({
  token = "",
  owner,
  repo,
  path,
  branch = "main",
  message,
  content,
  sha = "",
}) => {
  const safePath = encodeSegmentPath(path);
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}`;
  const body = {
    message: message || `Update ${path}`,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch,
  };
  if (sha) body.sha = sha;
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `GitHub write failed (${response.status})`);
  }
  return payload;
};

export const deleteRepositoryFile = async ({
  token = "",
  owner,
  repo,
  path,
  branch = "main",
  message,
  sha,
}) => {
  const safePath = encodeSegmentPath(path);
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${safePath}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      ...githubHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: message || `Delete ${path}`,
      sha,
      branch,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || `GitHub delete failed (${response.status})`);
  }
  return payload;
};
