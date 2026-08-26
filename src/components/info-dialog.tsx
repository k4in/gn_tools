import { Info } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";

export function InfoDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" size="icon-lg" aria-label="Info" />}>
        <Info />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Info</DialogTitle>
          <DialogDescription>Galaxy-Network Build order planner</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 text-sm">
          <p>
            GitHub:{" "}
            <a href="https://github.com/k4in/gn_tools" target="_blank" rel="noreferrer">
              https://github.com/k4in/gn_tools
            </a>
          </p>
          <p>
            Galaxy Network:{" "}
            <a href="https://galaxy-network.de/portal" target="_blank" rel="noreferrer">
              https://galaxy-network.de/portal
            </a>
          </p>
          <p className="text-center text-xs text-muted-foreground">© k4in 2026</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
