"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { STATUS_LABELS } from "@/lib/admin-types";
import type { OrderStatus } from "@/lib/orders";

const ACTIONS: Record<OrderStatus, { label: string; confirm?: string }> = {
  pending_payment: { label: "" },
  paid: { label: "Mark as paid" },
  shipped: { label: "Mark as shipped" },
  delivered: { label: "Mark as delivered" },
  cancelled: {
    label: "Cancel order",
    confirm: "Cancel this order and put its items back in stock?",
  },
  refunded: { label: "Refund order", confirm: "Mark this order as refunded?" },
};

const buttonClass =
  "border px-5 py-3 text-xs uppercase tracking-[0.2em] transition-colors disabled:cursor-wait disabled:opacity-50";

export default function OrderActions({ orderId, next }: { orderId: string; next: OrderStatus[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<OrderStatus | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const acted = useRef(false);
  const nextKey = next.join(",");

  const move = async (status: OrderStatus) => {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/admin/orders/${orderId}/status`, { method: "PATCH", json: { status } });
      acted.current = true;
      setConfirming(null);
      setMessage(`Order marked as ${STATUS_LABELS[status].toLowerCase()}.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the order.");
    } finally {
      setBusy(false);
    }
  };

  // Ask first, and start on the safe answer so Enter cannot cancel an order by accident.
  useEffect(() => {
    if (confirming) keepRef.current?.focus();
  }, [confirming]);

  // The button that was pressed goes away when the order moves on. Keep focus on the page.
  useEffect(() => {
    const root = rootRef.current;
    if (!acted.current || !root || root.contains(document.activeElement)) return;
    root.querySelector<HTMLElement>("button")?.focus();
  }, [nextKey]);

  const keep = () => {
    const status = confirming;
    setConfirming(null);
    // Put focus back on the action that opened the question.
    window.setTimeout(() => {
      rootRef.current?.querySelector<HTMLElement>(`[data-status="${status}"]`)?.focus();
    }, 0);
  };

  let body;
  if (next.length === 0) {
    body = <p className="text-sm text-text/65">This order is closed. No further steps.</p>;
  } else if (confirming) {
    body = (
      <div
        role="alertdialog"
        aria-label="Confirm"
        aria-describedby="order-confirm-text"
        className="space-y-4"
      >
        <p id="order-confirm-text" className="text-sm text-text">
          {ACTIONS[confirming].confirm}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => move(confirming)}
            className={`${buttonClass} border-text bg-text text-base hover:border-accent hover:bg-accent hover:text-text`}
          >
            {busy ? "Working…" : "Yes, continue"}
          </button>
          <button
            ref={keepRef}
            type="button"
            disabled={busy}
            onClick={keep}
            className={`${buttonClass} border-secondary/60 text-text/70 hover:border-accent hover:text-accent-deep`}
          >
            Keep it
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-accent-deep">
            {error}
          </p>
        )}
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          {next.map((status) => {
            const action = ACTIONS[status];
            const destructive = Boolean(action.confirm);
            return (
              <button
                key={status}
                type="button"
                data-status={status}
                disabled={busy}
                onClick={() => (destructive ? setConfirming(status) : move(status))}
                className={`${buttonClass} ${
                  destructive
                    ? "border-secondary/60 text-text/70 hover:border-accent hover:text-accent-deep"
                    : "border-text bg-text text-base hover:border-accent hover:bg-accent hover:text-text"
                }`}
              >
                {action.label || status}
              </button>
            );
          })}
        </div>
        {error && (
          <p role="alert" className="text-sm text-accent-deep">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={rootRef}>
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      {body}
    </div>
  );
}
