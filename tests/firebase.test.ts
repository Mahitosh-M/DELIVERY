import { describe, it, expect, vi } from "vitest";
import {
  readFirebaseConfiguration,
  checkAuthenticationConfiguration,
  firebaseMessage,
} from "../src/firebase/config";
const env = {
  VITE_FIREBASE_ENABLED: "true",
  VITE_FIREBASE_API_KEY: "public-test-key",
  VITE_FIREBASE_AUTH_DOMAIN: "delivery-28165.firebaseapp.com",
  VITE_FIREBASE_PROJECT_ID: "delivery-28165",
  VITE_FIREBASE_STORAGE_BUCKET: "delivery-28165.firebasestorage.app",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "706574701792",
  VITE_FIREBASE_APP_ID: "test-web-app",
};
describe("Firebase delivery-project configuration", () => {
  it("is opt-in and leaves local operation available", () => {
    expect(readFirebaseConfiguration({})).toMatchObject({ enabled: false });
  });
  it("accepts the designated separate delivery project", () => {
    expect(readFirebaseConfiguration(env)).toMatchObject({
      enabled: true,
      options: { projectId: "delivery-28165" },
    });
  });
  it("rejects missing configuration instead of silently using another app", () => {
    expect(
      readFirebaseConfiguration({ ...env, VITE_FIREBASE_API_KEY: "" }),
    ).toMatchObject({ enabled: false });
  });
  it("rejects CISapp as a target", () => {
    const result = readFirebaseConfiguration({
      ...env,
      VITE_FIREBASE_PROJECT_ID: "cisapp-236ab",
    });
    expect(result.enabled).toBe(false);
    if (!result.enabled) expect(result.reason).toContain("Project mismatch");
  });
  it("rejects a bucket or auth domain from another project", () => {
    expect(
      readFirebaseConfiguration({
        ...env,
        VITE_FIREBASE_STORAGE_BUCKET: "another-project.appspot.com",
      }).enabled,
    ).toBe(false);
  });
  it("performs a GET-only configuration diagnostic", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ authorizedDomains: ["localhost"] }),
      });
    const result = await checkAuthenticationConfiguration(
      readFirebaseConfiguration(env),
      request,
    );
    expect(result.ok).toBe(true);
    expect(request).toHaveBeenCalledWith(
      expect.stringContaining("identitytoolkit.googleapis.com"),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.message).toContain("does not verify Firestore");
  });
  it("explains the live configuration-not-found response", async () => {
    const request = vi
      .fn()
      .mockResolvedValue({
        ok: false,
        json: async () => ({ error: { message: "CONFIGURATION_NOT_FOUND" } }),
      });
    const result = await checkAuthenticationConfiguration(
      readFirebaseConfiguration(env),
      request,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Authentication is not configured");
  });
  it("handles offline diagnostics without claiming a connection", async () => {
    const request = vi.fn().mockRejectedValue(new Error("offline"));
    const result = await checkAuthenticationConfiguration(
      readFirebaseConfiguration(env),
      request,
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Local operations remain available");
  });
  it("does not send requests when Firebase is disabled", async () => {
    const request = vi.fn();
    await checkAuthenticationConfiguration(
      { enabled: false, reason: "Disabled" },
      request,
    );
    expect(request).not.toHaveBeenCalled();
  });
  it("explains denied Firestore access without suggesting permissive rules", () => {
    expect(firebaseMessage({ code: "permission-denied" })).toContain(
      "No data was uploaded",
    );
  });
});
