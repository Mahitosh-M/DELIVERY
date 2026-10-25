import { forwardRef, type ButtonHTMLAttributes } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export const TemplateButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "secondary" | "ghost" | "gradient"; size?: "default" | "sm" | "lg" }>(function TemplateButton({ variant = "gradient", size = "default", className = "", ...props }, ref) {
  return <button ref={ref} className={`template-button template-button-${variant} template-button-${size} ${className}`} {...props} />;
});

/** Reference SaaS template, adapted to real Dispatch navigation and persisted data. */
export default function SaaSTemplate({ scope, date, pending }: { scope: string; date: string; pending: number }) {
  return <section className="page-title dashboard-heading" aria-label="Dispatch operations overview">
    <div><p className="dashboard-date">{date} / {scope}</p><h1>Overview</h1><Link className="link" to="/deliveries">{pending} deliveries ready</Link></div>
    <div className="actions"><Link className="primary" to="/routes">Plan a route <ArrowRight size={16}/></Link><Link className="secondary" to="/trips">Today's trips</Link></div>
  </section>;
}
