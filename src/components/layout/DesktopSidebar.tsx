import { TabId } from "./BottomNav";
import { Home, List, BarChart3, Settings, Shield, Plus, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DesktopSidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onLogWaste: () => void;
  isAdmin?: boolean;
  overdueCount?: number;
}

export default function DesktopSidebar({
  activeTab,
  onTabChange,
  onLogWaste,
  isAdmin,
  overdueCount = 0,
}: DesktopSidebarProps) {
  const { user, signOut } = useAuth();

  const navItems: { id: TabId; label: string; icon: typeof Home; adminOnly?: boolean }[] = [
    { id: "home", label: "Dashboard", icon: Home },
    { id: "inventory", label: "Inventory", icon: List },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "settings", label: "Settings", icon: Settings },
    ...(isAdmin ? [{ id: "admin" as TabId, label: "Admin Portal", icon: Shield, adminOnly: true }] : []),
  ];

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "U";

  return (
    <aside className="hidden lg:flex flex-col w-64 xl:w-72 h-full border-r border-border/80 bg-card/75 backdrop-blur-xl shrink-0 z-30 select-none">
      {/* ── Brand Logo Header (Clean without v2.0 badge) ── */}
      <div className="h-16 px-5 border-b border-border/70 flex items-center gap-3">
        <img
          src="/icons/icon-192x192.png"
          alt="WasteBuddy"
          className="h-9 w-9 rounded-xl shadow-xs object-cover border border-primary/20 shrink-0"
        />
        <div className="min-w-0">
          <span className="text-base font-bold tracking-tight text-foreground block">
            Waste<span className="text-primary font-bold">Buddy</span>
          </span>
          <p className="text-[11px] text-muted-foreground truncate">
            Hazardous & Non-Haz Portal
          </p>
        </div>
      </div>

      {/* ── Sole Desktop Action: Log Waste CTA ── */}
      <div className="p-4 pb-2">
        <Button
          onClick={onLogWaste}
          className="w-full h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm flex items-center justify-center gap-2 group transition-all"
        >
          <Plus className="h-4 w-4 stroke-[2.5] transition-transform group-hover:rotate-90 duration-200" />
          <span>Log Waste Generation</span>
        </Button>
      </div>

      {/* ── Navigation Links ── */}
      <div className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 mb-2">
            Workspace Navigation
          </p>
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all group",
                  isActive
                    ? "bg-primary/10 text-primary font-bold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "p-1.5 rounded-lg transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "bg-muted text-muted-foreground group-hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span>{item.label}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  {item.id === "inventory" && overdueCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-xs">
                      {overdueCount > 99 ? "99+" : overdueCount}
                    </span>
                  )}
                  {item.adminOnly && (
                    <span className="text-[9px] uppercase tracking-wider font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                      Admin
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Statutory Footer & User Profile ── */}
      <div className="p-3 border-t border-border/70 space-y-2 bg-card/40">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">HOWM Rules 2016 Compliant</span>
          </div>
        </div>

        {/* User Card */}
        <div className="p-2 rounded-xl border border-border/60 bg-background/60 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 border border-primary/20">
              {userInitial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user?.email}</p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {isAdmin ? "Administrator" : "Facility Operator"}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={signOut}
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg shrink-0"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
