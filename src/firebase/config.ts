import type { FirebaseOptions } from "firebase/app";
export const DELIVERY_PROJECT_ID = "delivery-28165";
export type FirebaseEnvironment = Record<string, string | boolean | undefined>;
export type FirebaseConfiguration =
  | { enabled: false; reason: string }
  | { enabled: true; options: FirebaseOptions };
export function readFirebaseConfiguration(
  env: FirebaseEnvironment,
): FirebaseConfiguration {
  if (env.VITE_FIREBASE_ENABLED !== "true")
    return {
      enabled: false,
      reason: "Firebase is disabled. Local operations remain available.",
    };
  const fields = {
    apiKey: "VITE_FIREBASE_API_KEY",
    authDomain: "VITE_FIREBASE_AUTH_DOMAIN",
    projectId: "VITE_FIREBASE_PROJECT_ID",
    storageBucket: "VITE_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "VITE_FIREBASE_MESSAGING_SENDER_ID",
    appId: "VITE_FIREBASE_APP_ID",
  } as const;
  const missing = Object.values(fields).filter(
    (key) => typeof env[key] !== "string" || !String(env[key]).trim(),
  );
  if (missing.length)
    return {
      enabled: false,
      reason: "Missing Firebase configuration: " + missing.join(", "),
    };
  const options = Object.fromEntries(
    Object.entries(fields).map(([key, envKey]) => [
      key,
      String(env[envKey]).trim(),
    ]),
  ) as FirebaseOptions;
  if (options.projectId !== DELIVERY_PROJECT_ID)
    return {
      enabled: false,
      reason:
        "Project mismatch. This installation is restricted to " +
        DELIVERY_PROJECT_ID +
        ". CISapp is not an allowed target.",
    };
  if (
    options.authDomain !== DELIVERY_PROJECT_ID + ".firebaseapp.com" ||
    options.storageBucket !== DELIVERY_PROJECT_ID + ".firebasestorage.app"
  )
    return {
      enabled: false,
      reason:
        "Firebase domain or bucket does not match the approved delivery project.",
    };
  return { enabled: true, options };
}
export function firebaseMessage(error: unknown): string {
  const value = error as { code?: string; message?: string };
  const code = value?.code ?? "";
  const messages: Record<string, string> = {
    "auth/configuration-not-found":
      "Firebase Authentication is not configured for delivery-28165. In the Firebase console, open Authentication, choose Get started and enable Email/Password.",
    "auth/operation-not-allowed":
      "Email/Password sign-in is not enabled. Enable it in Firebase Authentication > Sign-in method.",
    "auth/unauthorized-domain":
      "Add this app host to Firebase Authentication > Settings > Authorized domains. Add localhost and 127.0.0.1 for local development if needed.",
    "auth/invalid-api-key":
      "The Firebase web API key is invalid. Check .env.local against the Firebase console web-app configuration.",
    "auth/invalid-credential":
      "Email or password is incorrect, or this account cannot sign in.",
    "auth/invalid-login-credentials":
      "Email or password is incorrect, or this account cannot sign in.",
    "auth/user-not-found":
      "Email or password is incorrect, or this account cannot sign in.",
    "auth/wrong-password":
      "Email or password is incorrect, or this account cannot sign in.",
    "auth/network-request-failed":
      "Firebase is unreachable. Check your connection. Local operations remain available.",
    "auth/too-many-requests":
      "Firebase temporarily limited sign-in attempts. Wait before trying again.",
    "permission-denied":
      "Firestore denied this diagnostic read. No data was uploaded. Configure authenticated access rules before cloud operations.",
    unavailable:
      "Firestore is unavailable or offline. Local records are unchanged.",
    "deadline-exceeded":
      "The Firebase check timed out. Local records are unchanged.",
    "storage/unauthorized":
      "Storage denied access. Evidence remains on this device.",
  };
  return messages[code] ?? value?.message ?? "Firebase request failed.";
}
export interface FirebaseCheck {
  ok: boolean;
  message: string;
  authorizedDomains?: string[];
}
export async function checkAuthenticationConfiguration(
  config: FirebaseConfiguration,
  request: typeof fetch = fetch,
): Promise<FirebaseCheck> {
  if (!config.enabled) return { ok: false, message: config.reason };
  try {
    const response = await request(
      "https://identitytoolkit.googleapis.com/v1/projects?key=" +
        encodeURIComponent(config.options.apiKey!),
      { method: "GET", signal: AbortSignal.timeout(12000) },
    );
    const body = (await response.json()) as {
      projectId?: string;
      authorizedDomains?: string[];
      error?: { message?: string };
    };
    if (!response.ok) {
      const code = body.error?.message ?? "UNKNOWN";
      const known: Record<string, string> = {
        CONFIGURATION_NOT_FOUND: "auth/configuration-not-found",
        API_KEY_INVALID: "auth/invalid-api-key",
        OPERATION_NOT_ALLOWED: "auth/operation-not-allowed",
      };
      return {
        ok: false,
        message: firebaseMessage({
          code: known[code] ?? "auth/config-check",
          message: code,
        }),
      };
    }
    return {
      ok: true,
      message:
        "Firebase Authentication configuration is reachable. This does not verify Firestore rules, Storage access or cloud data sync.",
      authorizedDomains: body.authorizedDomains ?? [],
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error && e.name === "TimeoutError"
          ? "Firebase configuration check timed out. Local operations remain available."
          : firebaseMessage({ code: "auth/network-request-failed" }),
    };
  }
}
