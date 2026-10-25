import { useEffect, useState } from "react";
import type { User as FirebaseUser } from "firebase/auth";
import { Cloud, CheckCircle, LogIn, LogOut, RefreshCw } from "lucide-react";
import { getFirebaseServices, firebaseConfiguration } from "./client";
import {
  checkAuthenticationConfiguration,
  firebaseMessage,
  type FirebaseCheck,
  DELIVERY_PROJECT_ID,
} from "./config";
import { useApp } from "../context";
import { Field, Badge } from "../ui";
export function FirebasePanel() {
  const { notify } = useApp();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [check, setCheck] = useState<FirebaseCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [databaseCheck, setDatabaseCheck] = useState("");
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    getFirebaseServices()
      .then(async (services) => {
        const { onAuthStateChanged } = await import("firebase/auth");
        if (disposed) return;
        unsubscribe = onAuthStateChanged(
          services.auth,
          (value) => {
            setUser(value);
            setReady(true);
          },
          (e) => {
            setError(firebaseMessage(e));
            setReady(true);
          },
        );
      })
      .catch((e) => {
        if (!disposed) {
          setError(firebaseMessage(e));
          setReady(true);
        }
      });
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);
  async function checkConfig() {
    setBusy(true);
    setError("");
    try {
      setCheck(await checkAuthenticationConfiguration(firebaseConfiguration));
    } finally {
      setBusy(false);
    }
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { auth } = await getFirebaseServices();
      const {
        setPersistence,
        browserSessionPersistence,
        signInWithEmailAndPassword,
      } = await import("firebase/auth");
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword("");
      notify("Signed in to Firebase. Operational records remain local.");
    } catch (e) {
      setPassword("");
      setError(firebaseMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    setError("");
    try {
      const { auth } = await getFirebaseServices();
      await (await import("firebase/auth")).signOut(auth);
      setDatabaseCheck("");
      notify("Signed out of Firebase");
    } catch (e) {
      setError(firebaseMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function checkFirestore() {
    setBusy(true);
    setDatabaseCheck("");
    try {
      const { auth, firestore } = await getFirebaseServices();
      if (!auth.currentUser)
        throw new Error("Sign in to Firebase before testing Firestore access.");
      const { doc, getDocFromServer } = await import("firebase/firestore");
      const read = getDocFromServer(
        doc(firestore, "dispatchUsers", auth.currentUser.uid),
      );
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const snapshot = await Promise.race([
          read,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject({ code: "deadline-exceeded" }),
              12000,
            );
          }),
        ]);
        setDatabaseCheck(
          snapshot.exists()
            ? "Firestore is reachable and your dispatchUsers profile can be read. No operational role has been activated in this local app."
            : "Firestore is reachable, but your dispatchUsers profile does not exist yet. Cloud operations are not enabled.",
        );
      } finally {
        clearTimeout(timer);
      }
    } catch (e) {
      setDatabaseCheck(firebaseMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="p-5">
      <div className="flex-between">
        <div>
          <h3>
            <Cloud size={18} className="inline mr-2" />
            Firebase connection
          </h3>
          <p className="muted">
            Separate delivery project: <strong>{DELIVERY_PROJECT_ID}</strong>
          </p>
        </div>
        <Badge>
          {firebaseConfiguration.enabled ? "SDK configured" : "Not configured"}
        </Badge>
      </div>
      <div className="notice">
        Operational records and evidence still save to this device. Firebase
        sign-in is separate from demo roles. No local data is automatically
        uploaded and multi-device sync is not enabled.
      </div>
      {!firebaseConfiguration.enabled && (
        <p role="alert" className="notice">
          {firebaseConfiguration.reason}
        </p>
      )}
      <div className="split">
        <section>
          <h3>Connection diagnostics</h3>
          <p className="muted text-xs">
            Checks Authentication configuration without creating users or
            writing documents.
          </p>
          <button
            className="secondary"
            disabled={busy || !firebaseConfiguration.enabled}
            onClick={() => void checkConfig()}
          >
            <RefreshCw size={15} />
            {busy ? "Checking..." : "Check Firebase configuration"}
          </button>
          {check && (
            <div role="status" className="summary-box">
              <Badge>
                {check.ok ? "Configuration reachable" : "Setup required"}
              </Badge>
              <p>{check.message}</p>
              {check.authorizedDomains && (
                <p>
                  Authorised domains:{" "}
                  {check.authorizedDomains.join(", ") || "None returned"}
                </p>
              )}
            </div>
          )}
          <div className="summary-box">
            <p>
              Web SDK
              <span>
                {firebaseConfiguration.enabled ? "Configured" : "Disabled"}
              </span>
            </p>
            <p>
              Authentication
              <span>
                {user ? "Signed in" : ready ? "Signed out" : "Loading..."}
              </span>
            </p>
            <p>
              Firestore<span>Client configured; access not assumed</span>
            </p>
            <p>
              Storage bucket
              <span className="mono">delivery-28165.firebasestorage.app</span>
            </p>
            <p>
              Operational persistence<span>IndexedDB (local)</span>
            </p>
          </div>
          {user && (
            <>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void checkFirestore()}
              >
                Check my Firestore profile (read only)
              </button>
              {databaseCheck && (
                <p role="status" className="notice mt-4">
                  {databaseCheck}
                </p>
              )}
            </>
          )}
        </section>
        <section>
          <h3>Firebase account</h3>
          {user ? (
            <div className="detail-card">
              <p>
                <CheckCircle size={17} /> Signed in as {user.email ?? user.uid}
              </p>
              <small className="mono">UID: {user.uid}</small>
              <p className="muted text-xs">
                This account has not been mapped to an operational Admin,
                Manager or Driver role.
              </p>
              <button
                className="secondary mt-4"
                disabled={busy}
                onClick={() => void logout()}
              >
                <LogOut size={15} />
                Sign out of Firebase
              </button>
            </div>
          ) : (
            <form onSubmit={(e) => void login(e)}>
              <p className="muted text-xs">
                Use an account created in Firebase Authentication. No account is
                created automatically.
              </p>
              <Field label="Firebase email">
                <input
                  autoComplete="username"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Firebase password">
                <input
                  autoComplete="current-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <button
                className="primary"
                disabled={busy || !ready || !firebaseConfiguration.enabled}
              >
                <LogIn size={15} />
                Sign in to Firebase
              </button>
            </form>
          )}
          {error && (
            <div role="alert" className="notice mt-4">
              {error}
            </div>
          )}
          <h3 className="mt-5">Firebase console setup</h3>
          <ol className="list-decimal pl-5 text-xs leading-7 mt-3">
            <li>Open Authentication and choose Get started.</li>
            <li>Enable Email/Password, then create your account.</li>
            <li>Check authorised local development domains.</li>
            <li>
              Create Firestore and Storage with restricted access rules before
              enabling cloud workflows.
            </li>
          </ol>
          <a
            className="link mt-3"
            href="https://console.firebase.google.com/project/delivery-28165/authentication"
            target="_blank"
            rel="noreferrer"
          >
            Open this project's Firebase Authentication
          </a>
        </section>
      </div>
    </div>
  );
}
