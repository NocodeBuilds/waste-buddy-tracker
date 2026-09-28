import { motion } from "framer-motion";
import { Home, List, BarChart3, Settings, Plus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { scaleTap } from "@/lib/animations";

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
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/80 safe-area-bottom shadow-lg">
      <div className="flex items-center justify-around px-2 py-1 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        {tabs.slice(0, 2).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-150 min-w-[56px]",
                isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              variants={scaleTap}
              whileTap="tap"
            >
              <div className={cn("p-1 rounded-lg transition-colors", isActive && "bg-primary/10")}>
                <tab.icon className="h-5 w-5" />
              </div>
              {tab.id === "inventory" && overdueCount > 0 && (
                <span className="absolute top-1 right-2 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                  {overdueCount > 99 ? "99+" : overdueCount}
                </span>
              )}
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </motion.button>
          );
        })}

        {/* Center FAB */}
        <motion.button
          onClick={onAddClick}
          className="flex flex-col items-center -mt-5"
          variants={scaleTap}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="bg-primary text-primary-foreground rounded-2xl p-3.5 shadow-lg shadow-primary/30 transition-all hover:shadow-xl hover:shadow-primary/40 ring-4 ring-background">
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold text-primary mt-0.5">Log</span>
        </motion.button>

        {tabs.slice(2).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <motion.button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "relative flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all duration-150 min-w-[56px]",
                isActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
              )}
              variants={scaleTap}
              whileTap="tap"
            >
              <div className={cn("p-1 rounded-lg transition-colors", isActive && "bg-primary/10")}>
                <tab.icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}
