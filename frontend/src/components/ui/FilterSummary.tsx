import { useEffect, useMemo, useState } from "react";

import { Button } from "./Button";
import { Chip } from "./Badge";
import { IconSave } from "./Icons";
import styles from "./ui.module.css";

export type FilterChip = {
  /** Stable key used by React when rendering the chip list. */
  key: string;

  /** Human-friendly label shown in the UI (e.g., "Type: flood"). */
  label: string;

  /** Optional handler to remove the filter represented by this chip. */
  onRemove?: () => void;
};

// =============================================================================
// Component
// =============================================================================

/**
 * Compact summary of active filters, rendered as:
 * - A sentence ("A mostrar incidentes com: ...")
 * - A list of removable chips
 * - An optional "save filter" action with a short-lived visual feedback state
 */
export function FilterSummary({
  prefix = "A mostrar incidentes",
  chips,
  onSave,
  saveLabel = "Guardar filtro",
}: {
  /** Prefix used to build the summary sentence. */
  prefix?: string;

  /** Active filters to render as chips. */
  chips: FilterChip[];

  /** Optional callback to persist the current filter set. */
  onSave?: () => void;

  /** Button label when the filter hasn't just been saved. */
  saveLabel?: string;
}) {
  // Transient UI state for the "saved" feedback label.
  const [saved, setSaved] = useState(false);

  // Reset the "saved" feedback after a short delay.
  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 1200);
    return () => window.clearTimeout(id);
  }, [saved]);

  // Create a readable sentence from the active chips.
  const sentence = useMemo(() => {
    if (chips.length === 0) return `${prefix} sem filtros.`;
    const parts = chips.map((c) => c.label).join(", ");
    return `${prefix} com: ${parts}`;
  }, [chips, prefix]);

  return (
    <div className={styles.filterSummary}>
      <div className={styles.filterSummaryText}>{sentence}</div>

      <div className={styles.filterSummaryChips}>
        {chips.map((c) => (
          <Chip key={c.key} strong onRemove={c.onRemove}>
            {c.label}
          </Chip>
        ))}
      </div>

      {onSave && (
        <div className={styles.filterSummaryActions}>
          <Button
            size="sm"
            variant="default"
            // Save the current filter set and show a temporary "saved" label.
            onClick={() => {
              onSave();
              setSaved(true);
            }}
            // Nothing to save if there are no active filters.
            disabled={chips.length === 0}
          >
            <IconSave />
            {saved ? "Guardado" : saveLabel}
          </Button>
        </div>
      )}
    </div>
  );
}