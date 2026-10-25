import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { readFirebaseConfiguration } from "./config";
export const firebaseConfiguration = readFirebaseConfiguration(import.meta.env);
const appName = "cis-dispatch-delivery";
export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfiguration.enabled) return null;
  const existing = getApps().find((app) => app.name === appName);
  return existing ?? initializeApp(firebaseConfiguration.options, appName);
}
export interface FirebaseServices {
  app: FirebaseApp;
  auth: import("firebase/auth").Auth;
  firestore: import("firebase/firestore").Firestore;
  storage: import("firebase/storage").FirebaseStorage;
}
let services: Promise<FirebaseServices> | null = null;
export function getFirebaseServices(): Promise<FirebaseServices> {
  if (!services)
    services = (async () => {
      const app = getFirebaseApp();
      if (!app)
        throw new Error(
          firebaseConfiguration.enabled
            ? "Firebase app unavailable"
            : firebaseConfiguration.reason,
        );
      const [{ getAuth }, { getFirestore }, { getStorage }] = await Promise.all(
        [
          import("firebase/auth"),
          import("firebase/firestore"),
          import("firebase/storage"),
        ],
      );
      return {
        app,
        auth: getAuth(app),
        firestore: getFirestore(app),
        storage: getStorage(app),
      };
    })().catch((error) => {
      services = null;
      throw error;
    });
  return services;
}
