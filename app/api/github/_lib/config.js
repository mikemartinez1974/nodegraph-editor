const required = (name) => {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
};

export const getGitHubAuthConfig = (request = null) => {
  const clientId = required("GITHUB_APP_CLIENT_ID");
  const clientSecret = required("GITHUB_APP_CLIENT_SECRET");
  const appId = required("GITHUB_APP_ID");
  const privateKey = required("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  const sessionSecret = required("TWILITE_SESSION_SECRET");
  const appUrl =
    required("TWILITE_APP_URL") ||
    (request ? new URL(request.url).origin : "");

  return {
    clientId,
    clientSecret,
    appId,
    privateKey,
    sessionSecret,
    appUrl,
  };
};

export const getGitHubCallbackUrl = (request) => {
  const { appUrl } = getGitHubAuthConfig(request);
  return appUrl ? `${appUrl}/api/github/callback` : "";
};

export const getMissingGitHubConfig = (request = null) => {
  const config = getGitHubAuthConfig(request);
  const missing = [];
  if (!config.clientId) missing.push("GITHUB_APP_CLIENT_ID");
  if (!config.clientSecret) missing.push("GITHUB_APP_CLIENT_SECRET");
  if (!config.sessionSecret) missing.push("TWILITE_SESSION_SECRET");
  if (!config.appUrl) missing.push("TWILITE_APP_URL");
  return missing;
};

