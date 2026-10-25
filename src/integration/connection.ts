export const CISAPP_URL = (import.meta.env.VITE_CISAPP_URL || "https://cisapp-236ab.web.app").replace(/\/$/, "");
﻿import { initializeApp, getApps, type FirebaseOptions } from "firebase/app";
import { getFirebaseServices } from "../firebase/client";
export const BRIDGE_URL =
  import.meta.env.VITE_DISPATCH_BRIDGE_URL ||
  "https://asia-south1-cisapp-236ab.cloudfunctions.net/dispatchBridge";
export type Issuer = "cisapp-236ab" | "delivery-28165";
export interface ConnectedIdentity {
  uid: string;
  issuer: Issuer;
  actorId: string;
  role: "ADMIN" | "MANAGER" | "DRIVER";
  shopIds: string[];
  name: string;
  roleId?: string;
  permissions?: string[];
}
export async function connectionAuth(issuer: Issuer) {
  const { getAuth } = await import("firebase/auth");
  if (issuer === "delivery-28165") return (await getFirebaseServices()).auth;
  let options: FirebaseOptions;
  try {
    options = JSON.parse(import.meta.env.VITE_CISAPP_FIREBASE_CONFIG || "{}");
  } catch {
    throw new Error("Invalid optional CISapp public web configuration");
  }
  if (
    options.projectId !== "cisapp-236ab" ||
    !options.apiKey ||
    !options.appId ||
    options.authDomain !== "cisapp-236ab.firebaseapp.com"
  )
    throw new Error(
      "CISapp public Firebase web configuration is not configured for this development build",
    );
  const name = "cis-dispatch-cisapp-identity";
  return getAuth(
    getApps().find((a) => a.name === name) ?? initializeApp(options, name),
  );
}
export async function connectionLogin(
  issuer: Issuer,
  email: string,
  password: string,
) {
  const {
    setPersistence,
    browserLocalPersistence,
    signInWithEmailAndPassword,
  } = await import("firebase/auth");
  const auth = await connectionAuth(issuer);
  await setPersistence(auth, browserLocalPersistence);
  await signInWithEmailAndPassword(auth, email.trim(), password);
  try { return await bridge<ConnectedIdentity>(issuer, "identity"); }
  catch(error) { const {signOut}=await import('firebase/auth');await signOut(auth).catch(()=>{});throw error; }
}
export async function connectionLogout(issuer: Issuer) {
  const { signOut } = await import("firebase/auth");
  await signOut(await connectionAuth(issuer));
}
export async function bridge<T>(
  issuer: Issuer,
  action: string,
  payload: unknown = {},
): Promise<T> {
  const url = new URL(BRIDGE_URL);
  if (
    url.href !==
      "https://asia-south1-cisapp-236ab.cloudfunctions.net/dispatchBridge" &&
    !(import.meta.env.DEV && ["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new Error("Unapproved integration endpoint");
  const auth = await connectionAuth(issuer);
  await auth.authStateReady();
  if (!auth.currentUser)
    throw new Error("Sign in to the selected Firebase account first");
  let response: Response;
  try { response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${await auth.currentUser.getIdToken()}`,
      "x-dispatch-issuer": issuer,
      "content-type": "application/json",
    },
    body: JSON.stringify({ action, payload }),
    signal: AbortSignal.timeout(120000),
  }); } catch { throw new Error("The secure CISapp connection could not be reached. Check your internet connection and backend availability. Your pending work remains saved."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) { const failure = new Error(
      data.error ||
        "CISapp service is unavailable. Pending work remains saved; retry after checking the connection.",
    );
  (failure as Error & {status?:number}).status=response.status; throw failure; }
  return data.result as T;
}
