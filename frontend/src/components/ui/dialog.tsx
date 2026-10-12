import { tr } from "../../i18n";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className={`sheet ${wide ? "sheet-wide" : ""}`}
          aria-describedby={undefined}
        >
          <div className="sheet-handle" />
          <header className="sheet-header">
            <Dialog.Title>{title}</Dialog.Title>
            <button
              type="button"
              className="icon-button"
              aria-label={tr("Закрыть")}
              onClick={onClose}
            >
              <X size={21} />
            </button>
          </header>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
