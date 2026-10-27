export default function SplashScreen() {
  return <div className="app-splash" role="status" aria-label="Loading CIS Dispatch"><picture><source media="(min-aspect-ratio: 4/3)" srcSet="/splash-landscape.png" /><img src="/splash-screen.png" width="941" height="1672" alt="CIS Dispatch splash" /></picture></div>;
}
