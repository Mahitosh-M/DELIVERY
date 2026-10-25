import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
const mock = vi.hoisted(() => ({
  notify: vi.fn(),
  signIn: vi.fn(),
  setPersistence: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("../src/context", () => ({ useApp: () => ({ notify: mock.notify }) }));
vi.mock("../src/firebase/client", () => ({
  firebaseConfiguration: {
    enabled: true,
    options: { apiKey: "test", projectId: "delivery-28165" },
  },
  getFirebaseServices: async () => ({
    auth: { currentUser: null },
    firestore: {},
    storage: {},
  }),
}));
vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth: unknown, callback: (v: null) => void) => {
    callback(null);
    return () => {};
  },
  setPersistence: mock.setPersistence,
  browserSessionPersistence: { type: "SESSION" },
  signInWithEmailAndPassword: mock.signIn,
  signOut: mock.signOut,
}));
import { FirebasePanel } from "../src/firebase/FirebasePanel";
beforeEach(() => {
  vi.clearAllMocks();
  mock.setPersistence.mockResolvedValue(undefined);
});
afterEach(cleanup);
it("shows configured SDK separately from local operational persistence", async () => {
  render(<FirebasePanel />);
  await screen.findByText("Signed out");
  expect(screen.getByText("SDK configured")).toBeInTheDocument();
  expect(screen.getByText("IndexedDB (local)")).toBeInTheDocument();
  expect(mock.signIn).not.toHaveBeenCalled();
});
it("signs in only after explicit submission and clears the password on error", async () => {
  mock.signIn.mockRejectedValue({ code: "auth/configuration-not-found" });
  render(<FirebasePanel />);
  await screen.findByText("Signed out");
  fireEvent.change(screen.getByLabelText("Firebase email"), {
    target: { value: "operator@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Firebase password"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in to Firebase" }));
  await waitFor(() =>
    expect(mock.signIn).toHaveBeenCalledWith(
      expect.anything(),
      "operator@example.test",
      "test-password",
    ),
  );
  await screen.findByRole("alert");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Authentication is not configured",
  );
  expect(screen.getByLabelText("Firebase password")).toHaveValue("");
  expect(mock.setPersistence).toHaveBeenCalled();
});
