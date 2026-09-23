import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function SidebarSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 pt-3 pb-1 text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
      {children}
    </div>
  );
}

export type SidebarRowProps = {
  title: ReactNode;
  meta?: ReactNode;
  titleClassName?: string;
  tone?: "default" | "destructive";
  onClick: () => void;
};

/** Eine klickbare Zeile, die einen Eintrag zum Plan hinzufügt. */
export function SidebarRow({
  title,
  meta,
  titleClassName,
  tone = "default",
  onClick,
}: SidebarRowProps) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "group/row flex w-full items-center gap-2 rounded-md px-2 py-1 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/40",
          tone === "destructive" && "hover:bg-destructive/15",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-xs leading-5", titleClassName)}>{title}</span>
          {meta ? (
            <span className="block truncate text-[11px] leading-4 text-muted-foreground tabular-nums">
              {meta}
            </span>
          ) : null}
        </span>
        <Plus
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover/row:text-foreground group-focus-visible/row:text-foreground"
        />
      </button>
    </li>
  );
}
