"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field, fieldClass } from "@/components/Field";
import Select from "@/components/Select";
import { apiFetch } from "@/lib/api";
import type { InventoryItem, StockMovement } from "@/lib/admin-types";
import { formatDateTime } from "@/lib/format";

type Panel = { skuId: string; mode: "adjust" | "history" };

const buttonClass =
  "text-xs uppercase tracking-[0.15em] text-text/65 transition-colors hover:text-accent-deep";

const itemName = (item: InventoryItem) =>
  item.variantName ? `${item.productName}, ${item.variantName}` : item.productName;

function StockAdjuster({ item, onDone }: { item: InventoryItem; onDone: () => void }) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState<"restock" | "adjustment">("restock");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const change = Number(delta);
    if (!Number.isInteger(change) || change === 0) {
      setError("Enter a whole number, like 10 or -2.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      await apiFetch(`/admin/inventory/${encodeURIComponent(item.skuId)}/adjust`, {
        method: "POST",
        json: { delta: change, reason, ...(note.trim() && { note: note.trim() }) },
      });
      router.refresh();
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change the stock.");
      setBusy(false);
    }
  };

  const id = `adjust-${item.skuId}`;

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-6 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
      <Field id={`${id}-delta`} label="Change">
        <input
          id={`${id}-delta`}
          inputMode="numeric"
          autoFocus
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-form-error` : undefined}
          placeholder="+10 or -2"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          className={fieldClass}
        />
      </Field>
      <Field id={`${id}-reason`} label="Reason">
        <Select
          id={`${id}-reason`}
          label="Reason"
          options={[
            { id: "restock", label: "Restock" },
            { id: "adjustment", label: "Correction" },
          ]}
          value={reason}
          onChange={setReason}
        />
      </Field>
      <Field id={`${id}-note`} label="Note" optional>
        <input
          id={`${id}-note`}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={fieldClass}
        />
      </Field>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={busy}
          className="border border-text bg-text px-6 py-3 text-xs uppercase tracking-[0.2em] text-base transition-colors hover:border-accent hover:bg-accent hover:text-text disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onDone} className={buttonClass}>
          Cancel
        </button>
      </div>
      {error && (
        <p id={`${id}-form-error`} role="alert" className="text-sm text-accent-deep sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}

function History({ skuId }: { skuId: string }) {
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ movements: StockMovement[] }>(`/admin/inventory/${encodeURIComponent(skuId)}/movements`)
      .then((data) => !cancelled && setMovements(data.movements))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [skuId]);

  if (failed) {
    return (
      <p role="alert" className="text-sm text-accent-deep">
        Could not load the history.
      </p>
    );
  }
  if (!movements) {
    return (
      <p role="status" className="text-sm text-text/65">
        Loading…
      </p>
    );
  }

  return (
    <ul aria-label="Stock history" className="divide-y divide-secondary/40 text-sm">
      {movements.map((m) => (
        <li key={m.id} className="grid grid-cols-[9rem_5rem_4rem_1fr] items-baseline gap-4 py-2">
          <span className="text-text/65">{formatDateTime(m.at)}</span>
          <span className={`tabular-nums ${m.delta > 0 ? "text-text" : "text-text/70"}`}>
            <span className="sr-only">Change </span>
            {m.delta > 0 ? `+${m.delta}` : m.delta}
          </span>
          <span className="tabular-nums text-text/65">
            <span aria-hidden>→ </span>
            <span className="sr-only">Stock after </span>
            {m.stockAfter}
          </span>
          <span className="text-text/70">
            <span className="uppercase tracking-[0.1em]">{m.reason}</span>
            {m.orderId && (
              <>
                {" "}
                <Link href={`/admin/orders/${m.orderId}`} className="border-b border-accent text-text">
                  {m.orderId}
                </Link>
              </>
            )}
            {m.note && <span className="text-text/65"> · {m.note}</span>}
            <span className="text-text/65"> · {m.actor}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function InventoryTable({ items }: { items: InventoryItem[] }) {
  const [panel, setPanel] = useState<Panel | null>(null);

  const toggle = (skuId: string, mode: Panel["mode"]) =>
    setPanel((current) => (current?.skuId === skuId && current.mode === mode ? null : { skuId, mode }));

  // The form and its Save button disappear when it closes. Return focus to the button that opened it.
  const closeAdjuster = (skuId: string) => {
    setPanel(null);
    window.setTimeout(() => document.getElementById(`${skuId}-adjust-button`)?.focus(), 0);
  };

  return (
    <div className="relative overflow-x-auto" data-lenis-prevent>
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-b border-secondary/40 text-[11px] uppercase tracking-[0.2em] text-text/65">
            <th scope="col" className="py-3 pr-4 font-normal">Item</th>
            <th scope="col" className="py-3 pr-4 font-normal">In stock</th>
            <th scope="col" className="py-3 text-right font-normal">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const open = panel?.skuId === item.skuId ? panel.mode : null;
            return (
              <Fragment key={item.skuId}>
                <tr className="border-b border-secondary/40 align-middle">
                  <td className="py-4 pr-4">
                    <span className="flex items-center gap-3">
                      {item.hex && (
                        <span
                          aria-hidden
                          className="h-3 w-3 rounded-full border border-text/10"
                          style={{ backgroundColor: item.hex }}
                        />
                      )}
                      <span className="font-serif text-lg text-text">
                        {item.productName}
                        {item.variantName && (
                          <span className="text-text/65"> · {item.variantName}</span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className="tabular-nums text-text">{item.stock}</span>
                    {item.low && (
                      <span className="ml-3 text-[11px] uppercase tracking-[0.15em] text-accent-deep">
                        {item.stock === 0 ? "Sold out" : "Low"}
                      </span>
                    )}
                  </td>
                  <td className="py-4 text-right">
                    <span className="inline-flex gap-5">
                      <button
                        id={`${item.skuId}-adjust-button`}
                        type="button"
                        aria-label={`Adjust stock, ${itemName(item)}`}
                        aria-expanded={open === "adjust"}
                        onClick={() => toggle(item.skuId, "adjust")}
                        className={buttonClass}
                      >
                        Adjust
                      </button>
                      <button
                        type="button"
                        aria-label={`History, ${itemName(item)}`}
                        aria-expanded={open === "history"}
                        onClick={() => toggle(item.skuId, "history")}
                        className={buttonClass}
                      >
                        History
                      </button>
                    </span>
                  </td>
                </tr>
                {open && (
                  <tr className="border-b border-secondary/40 bg-secondary/10">
                    <td colSpan={3} className="px-1 py-6">
                      {open === "adjust" ? (
                        <StockAdjuster item={item} onDone={() => closeAdjuster(item.skuId)} />
                      ) : (
                        <History skuId={item.skuId} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
