import { useSite } from "@/contexts/SiteContext";
import { Building2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SiteSwitcher() {
  const { sites, currentSite, setCurrentSite } = useSite();
  if (sites.length === 0) return null;

  if (sites.length === 1) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-primary-foreground/90">
        <Building2 className="h-3.5 w-3.5" />
        <span className="font-semibold truncate max-w-[140px]">{currentSite?.name}</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-1.5 text-xs text-primary-foreground/90 hover:text-primary-foreground bg-primary-foreground/10 rounded-md px-2 py-1">
        <Building2 className="h-3.5 w-3.5" />
        <span className="font-semibold truncate max-w-[120px]">{currentSite?.name ?? "Select site"}</span>
        <ChevronDown className="h-3 w-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch site</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sites.map((s) => (
          <DropdownMenuItem
            key={s.id}
            onClick={() => setCurrentSite(s)}
            className={currentSite?.id === s.id ? "bg-accent/10" : ""}
          >
            <Building2 className="h-4 w-4 mr-2" />
            <div className="flex-1">
              <p className="text-sm font-medium">{s.name}</p>
              {s.location && <p className="text-xs text-muted-foreground">{s.location}</p>}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
