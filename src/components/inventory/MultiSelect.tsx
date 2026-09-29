import { useEffect, useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export default function MultiSelect({
  options, value, onChange, placeholder = "Select...", className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const allSelected = value.length === 0 || value.length === options.length;

  const selectedLabels = useMemo(() => {
    if (allSelected) return [];
    return options.filter((o) => value.includes(o.value)).map((o) => o.label);
  }, [value, options, allSelected]);

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(options.map((o) => o.value));
    }
  };

  const toggleOne = (val: string) => {
    if (val === "__all__") {
      toggleAll();
      return;
    }
    const next = value.includes(val)
      ? value.filter((v) => v !== val)
      : [...value, val];
    onChange(next);
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const triggerText = allSelected
    ? placeholder
    : selectedLabels.length <= 2
      ? selectedLabels.join(", ")
      : `${selectedLabels.length} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal h-9 text-sm", className)}
        >
          <span className="truncate">{triggerText}</span>
          <div className="flex items-center gap-1">
            {!allSelected && value.length > 0 && (
              <span
                role="button"
                onMouseDown={clear}
                className="flex items-center justify-center rounded-sm hover:bg-accent"
              >
                <X className="h-3 w-3 opacity-50" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start" side="bottom">
        <div className="p-1 max-h-60 overflow-y-auto">
          {/* All option */}
          <div
            onClick={toggleAll}
            className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-xs font-medium select-none"
          >
            <Checkbox
              checked={allSelected}
              onCheckedChange={toggleAll}
            />
            All
          </div>
          <div className="h-px bg-border my-1" />
          {options.map((option) => (
            <div
              key={option.value}
              onClick={() => toggleOne(option.value)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-xs select-none"
            >
              <Checkbox
                checked={allSelected || value.includes(option.value)}
                onCheckedChange={() => toggleOne(option.value)}
              />
              {option.label}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
