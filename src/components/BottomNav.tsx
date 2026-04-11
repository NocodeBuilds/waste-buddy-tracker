import { Home, List, BarChart3, Settings, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export type TabId = "home" | "inventory" | "analytics" | "settings";

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  onAddClick: () => void;
}

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "inventory", label: "Inventory", icon: List },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
];

export default function BottomNav({ activeTab, onTabChange, onAddClick }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-end justify-around px-2 pt-1 pb-2">
        {tabs.slice(0, 2).map((tab) => (
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

        {/* Center FAB */}
        <button
          onClick={onAddClick}
          className="flex flex-col items-center -mt-4"
        >
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
