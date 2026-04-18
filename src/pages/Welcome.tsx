import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Leaf,
  Shield,
  Bell,
  BarChart3,
  Building2,
  Users,
  CheckCircle,
} from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Compliant Tracking",
    desc: "Log every kilogram of hazardous and non-hazardous waste from your maintenance activities.",
  },
  {
    icon: Bell,
    title: "Smart Alerts",
    desc: "Automatic warnings before the 90-day disposal deadline so nothing slips past compliance.",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    desc: "Cumulative quantities, trends, and disposal history at a glance.",
  },
  {
    icon: Building2,
    title: "Multi-Site Ready",
    desc: "Site-based isolation — each team only sees their own data.",
  },
  {
    icon: Users,
    title: "Role-Based Access",
    desc: "Admins and managers control disposal events; the team logs daily generation.",
  },
  {
    icon: CheckCircle,
    title: "One-Click Disposal",
    desc: "Mark an entire quarterly disposal in a single action — no per-entry busywork.",
  },
];

export default function Welcome() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/40">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground rounded-lg p-1.5">
            <Leaf className="h-5 w-5" />
          </div>
          <span className="font-bold">HazWaste Tracker</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Login</Link>
        </Button>
      </header>

      {/* Hero */}
      <section className="px-4 pt-8 pb-12 text-center max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-accent/15 text-accent px-3 py-1 rounded-full text-xs font-semibold mb-4">
          <Leaf className="h-3.5 w-3.5" /> Sustainable Maintenance
        </div>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-foreground">
          Track every drop of hazardous waste at your WTG sites
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
          From breakdown to disposal — a green, mobile-first compliance tracker for
          wind-turbine maintenance teams.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild size="lg" className="text-base">
            <Link to="/auth">Sign in to your site</Link>
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Invite-only access — contact your site admin for an account.
        </p>
      </section>

      {/* Features */}
      <section className="px-4 pb-16 max-w-5xl mx-auto">
        <h2 className="text-xl sm:text-2xl font-bold text-center mb-6">
          Everything you need for compliant waste handling
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {features.map((f) => (
            <Card key={f.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="bg-primary/10 text-primary rounded-lg p-2 w-fit mb-3">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-sm">{f.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="px-4 py-6 text-center text-xs text-muted-foreground border-t">
        © {new Date().getFullYear()} Hazardous Waste Tracker
      </footer>
    </div>
  );
}
