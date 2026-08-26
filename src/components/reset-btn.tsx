import { useState } from "react";
import { ListRestart } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/shadcn/alert-dialog";
import { Button } from "@/components/shadcn/button";

export type ResetBtnProps = {
  planLabel: string;
  disabled?: boolean;
  onReset: () => void;
};

export function ResetBtn({ planLabel, disabled, onReset }: ResetBtnProps) {
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        disabled={disabled}
        render={<Button type="button" variant="destructive" aria-label="Plan zurücksetzen" />}
      >
        <ListRestart data-icon="inline-start" />
        Zurücksetzen
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Plan zurücksetzen?</AlertDialogTitle>
          <AlertDialogDescription>
            Der aktuelle Plan und alle Economy-Aufträge werden durch „{planLabel}“ ersetzt. Diese Aktion kann nicht
            rückgängig gemacht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onReset();
              setOpen(false);
            }}
          >
            Zurücksetzen
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
