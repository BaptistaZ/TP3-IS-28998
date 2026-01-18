import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { Chip } from "./Badge";
import styles from "./ui.module.css";
import { IconSave } from "./Icons";

export type FilterChip = {
  key: string;
  label: string;
  onRemove?: () => void;
};

export function FilterSummary({
  prefix = "A mostrar incidentes",
  chips,
  onSave,
  saveLabel = "Guardar filtro",
}: {
  prefix?: string;
  chips: FilterChip[];
  onSave?: () => void;
  saveLabel?: string;
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 1200);
    return () => window.clearTimeout(id);
  }, [saved]);

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
            onClick={() => {
              onSave();
              setSaved(true);
            }}
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
