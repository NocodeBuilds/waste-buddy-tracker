import { Home, List, BarChart3, Settings, Plus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "home" | "inventory" | "analytics" | "settings" | "admin";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onAddClick: () => void;
  isAdmin?: boolean;
  overdueCount?: number;
}

const baseTabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "inventory", label: "Inventory", icon: List },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function BottomNav({ activeTab, onTabChange, onAddClick, isAdmin, overdueCount = 0 }: Props) {
  const tabs = isAdmin
    ? [
        baseTabs[0],
        baseTabs[1],
        baseTabs[2],
        { id: "admin" as TabId, label: "Admin", icon: Shield },
      ]
    : baseTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-end justify-around px-2 pt-1 pb-2">
        {tabs.slice(0, 2).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "relative flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors min-w-[56px]",
              activeTab === tab.id ? "text-accent" : "text-muted-foreground"
            )}
          >
            <tab.icon className="h-5 w-5" />
            {tab.id === "inventory" && overdueCount > 0 && (
              <span className="absolute top-0 right-1 min-w-[16px] h-4 px-1 bg-overdue text-overdue-foreground text-[9px] font-bold rounded-full flex items-center justify-center">
                {overdueCount > 99 ? "99+" : overdueCount}
              </span>
            )}
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}

        {/* Center FAB */}
        <button onClick={onAddClick} className="flex flex-col items-center -mt-4">
          <div className="bg-accent text-accent-foreground rounded-full p-3 shadow-lg shadow-accent/30">
            <Plus className="h-6 w-6" />
          </div>
          <span className="text-[10px] font-medium text-accent mt-0.5">Log</span>
        </button>

        {tabs.slice(2).map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors min-w-[56px]",
              activeTab === tab.id ? "text-accent" : "text-muted-foreground"
            )}
          >
            <tab.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
