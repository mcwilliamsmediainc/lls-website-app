import { useState } from "react";
import { api, type ChecklistItem as Item } from "../lib/api";

export function ChecklistItemRow({
  slug,
  item,
  onChange,
}: {
  slug: string;
  item: Item;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const done = item.status === "complete";

  async function toggle() {
    setBusy(true);
    try {
      await api.patch(`/api/clients/${slug}/checklist/${item.id}`, {
        status: done ? "pending" : "complete",
      });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="flex items-start gap-2 py-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={done}
        disabled={busy}
        onChange={toggle}
        className="mt-0.5 h-4 w-4 accent-rust"
      />
      <span className={`text-sm ${done ? "line-through text-slate/50" : "text-slate"}`}>
        {item.itemName}
      </span>
    </label>
  );
}
