import {PullToSync} from './integration/PullToSync';
import {SessionGate,useSession} from "./integration/session";
import React, { useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
  useLocation,
} from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  Route as RouteIcon,
  Truck,
  Users,
  Wallet,
  Fuel,
  ClipboardList,
  BarChart3,
  Settings,
  History,
  Menu,
  X,
  Database,
  ShieldCheck,
  HardDrive,
  ChevronDown,
} from "lucide-react";
import { useApp, AppProvider } from "./context";
import { Dashboard, ReportsPage } from "./dashboard";
import { CustomersPage, DeliveriesPage } from "./customers-deliveries";
import { RoutesPage, TripsPage, TripDetail } from "./routes-trips";
import { CollectionsPage, FuelPage, CashPage, SalesPage } from "./operations";
import { SettingsPage, AuditPage } from "./settings";
import { ConnectionPage } from "./integration/ConnectionPage";
const navigation = [
  {
    path: "/connection",
    label: "CISapp connection",
    icon: Database,
    roles: ["ADMIN", "MANAGER", "DRIVER"],
  },
  {
    path: "/",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    path: "/deliveries",
    label: "Delivery jobs",
    icon: Package,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    path: "/routes",
    label: "Route planner",
    icon: RouteIcon,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    path: "/trips",
    label: "Trips & shifts",
    icon: Truck,
    roles: ["ADMIN", "MANAGER", "DRIVER"],
  },
  {
    path: "/customers",
    label: "Customers & references",
    icon: Users,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    path: "/collections",
    label: "Collections",
    icon: Wallet,
    roles: ["ADMIN", "MANAGER", "DRIVER"],
  },
  {
    path: "/cash",
    label: "Cash reconciliation",
    icon: HardDrive,
    roles: ["ADMIN", "MANAGER", "DRIVER"],
  },
  {
    path: "/fuel",
    label: "Fuel & reimbursements",
    icon: Fuel,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    path: "/sales",
    label: "Sales requests",
    icon: ClipboardList,
    roles: ["ADMIN", "MANAGER", "DRIVER"],
  },
  {
    path: "/reports",
    label: "Reports & analytics",
    icon: BarChart3,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    path: "/audit",
    label: "Audit history",
    icon: History,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    path: "/settings",
    label: "Configuration",
    icon: Settings,
    roles: ["ADMIN"],
  },
];
function Shell() {
  const { state, user } = useApp();
  const {identity,logout}=useSession();
  const location = useLocation();
  const [menu, setMenu] = useState(false);
  const isDriver = user.role === "DRIVER";
  const startPage = isDriver ? "/trips" : "/";
  const nav = navigation.filter((n) => n.roles.includes(user.role));
  const current = navigation.find((n) => n.path === location.pathname);
  const allowed =
    location.pathname.startsWith("/trips/") ||
    current?.roles.includes(user.role);
  return (
    <div className="app-shell">
      <PullToSync/>
      {!isDriver && <aside className={"sidebar " + (menu ? "open" : "")}>
        <div className="brand">
          <span className="brand-icon">
            <Truck size={25} />
          </span>
          <div>
            CIS <strong>Dispatch</strong>
            <small>DELIVERY OPERATIONS</small>
          </div>
          <button
            className="mobile-only icon-button"
            aria-label="Close navigation"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace">
          <span className="status-dot" />
          <span>
            {user.role === "DRIVER"
              ? "Driver workspace"
              : user.role === "ADMIN"
                ? "Admin workspace"
                : "Shop workspace"}
          </span>
        </div>
        <nav>
          {nav.map((n, i) => (
            <React.Fragment key={n.path}>
              {n.path === "/reports" && (
                <span className="nav-section">INSIGHTS & CONTROL</span>
              )}
              <NavLink
                end={n.path === "/"}
                to={n.path}
                onClick={() => setMenu(false)}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
              </NavLink>
            </React.Fragment>
          ))}
        </nav>
        <div className="sidebar-bottom"><small>CIS Dispatch</small></div>
      </aside>}
      {!isDriver && menu && <div className="sidebar-scrim" onClick={() => setMenu(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="actions">
            {!isDriver && <button
              className="mobile-only icon-button"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>}
            <span className="mobile-page-title">{current?.label ?? "Trip details"}</span>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{current?.label ?? "Trip details"}</strong>
            </span>
          </div>
          <div className="actions">
            <div className="profile-select">
              <span className="avatar">
                {user.name.split(" ").slice(-1)[0].slice(0, 1)}
              </span>
              <div><small>{identity.roleId || identity.role}</small><div>{user.name}</div></div><button className="link" onClick={()=>void logout()}>Sign out</button>
            </div>
          </div>
        </header>
        <div className="workspace-status"><span>Dev preview - real data</span><NavLink to="/connection">{navigator.onLine ? "Connection" : "Offline - saved on device"}</NavLink></div>
        <main>
          {!allowed ? (
            <Navigate to={startPage} replace />
          ) : (
            <Routes>
              <Route path="/" element={isDriver ? <Navigate to="/trips" replace /> : <Dashboard />} />
              <Route path="/deliveries" element={<DeliveriesPage />} />
              <Route path="/routes" element={<RoutesPage />} />
              <Route path="/trips" element={<TripsPage />} />
              <Route path="/trips/:id" element={<TripDetail />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/collections" element={<CollectionsPage />} />
              <Route path="/connection" element={<ConnectionPage />} />
              <Route path="/cash" element={<CashPage />} />
              <Route path="/fuel" element={<FuelPage />} />
              <Route path="/sales" element={<SalesPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={startPage} replace />} />
            </Routes>
          )}
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Mobile navigation">
        {nav.filter(n=>(isDriver?['/trips','/collections','/cash','/sales']:['/','/deliveries','/routes','/collections']).includes(n.path)).map(n=><NavLink end={n.path==='/'} key={n.path} to={n.path}><n.icon size={21}/><span>{n.path==='/'?'Home':n.path==='/deliveries'?'Jobs':n.path==='/routes'?'Routes':n.path==='/trips'?'Trips':n.path==='/cash'?'Cash':n.path==='/sales'?'Sales':'Collections'}</span></NavLink>)}
        {!isDriver && <button className="mobile-more" aria-label="More navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Menu size={21}/><span>More</span></button>}
      </nav>
    </div>
  );
}
export default function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <SessionGate><AppProvider>
        <Shell />
      </AppProvider></SessionGate>
    </BrowserRouter>
  );
}
