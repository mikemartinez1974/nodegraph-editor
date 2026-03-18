import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getGitHubAuthConfig } from "./config.js";

const SESSION_COOKIE = "twilite_github_session";
const STATE_COOKIE = "twilite_github_oauth_state";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const STATE_MAX_AGE_SECONDS = 60 * 10;

const base64url = {
  encode(value) {
    const buffer = Buffer.isBuffer(value) ? value : Buffer.from(String(value), "utf8");
    return buffer
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  },
  decode(value) {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return Buffer.from(padded, "base64");
  },
};

const deriveKey = (request) => {
  const { sessionSecret } = getGitHubAuthConfig(request);
  if (!sessionSecret) throw new Error("Missing TWILITE_SESSION_SECRET");
  return crypto.createHash("sha256").update(sessionSecret).digest();
};

const seal = (request, payload) => {
  const key = deriveKey(request);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map(base64url.encode).join(".");
};

const unseal = (request, token) => {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const key = deriveKey(request);
    const [iv, tag, ciphertext] = parts.map(base64url.decode);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch {
    return null;
  }
};

const cookieOptions = (maxAge) => ({
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export const getGithubSession = (request) => {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  return unseal(request, token);
};

export const setGithubSession = (request, response, session) => {
  const token = seal(request, {
    ...session,
    updatedAt: new Date().toISOString(),
  });
  response.cookies.set(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE_SECONDS));
  return response;
};

export const clearGithubSession = (response) => {
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
};

export const getOAuthState = (request) => {
  const token = request.cookies.get(STATE_COOKIE)?.value;
  return unseal(request, token);
};

export const setOAuthState = (request, response, state) => {
  const token = seal(request, state);
  response.cookies.set(STATE_COOKIE, token, cookieOptions(STATE_MAX_AGE_SECONDS));
  return response;
};

export const clearOAuthState = (response) => {
  response.cookies.set(STATE_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
  return response;
};

export const json = (body, init = {}) =>
  NextResponse.json(body, init);

