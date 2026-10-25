import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getFirebaseApp } from "./firebase/client";
import { repository } from "./data";
import "./styles.css";
import "./cis-theme.css";
getFirebaseApp();
const root = ReactDOM.createRoot(document.getElementById("root")!);
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  state: { error: string | null } = { error: null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? (
      <main className="loading">
        <h1>Unable to open local workspace</h1>
        <p>{this.state.error}</p>
        <p>
          Try reopening the app. Do not clear browser storage without a backup.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
root.render(<React.StrictMode><Boundary><App /></Boundary></React.StrictMode>);
