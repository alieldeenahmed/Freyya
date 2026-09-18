import Link from "next/link";
import { notFound } from "next/navigation";
import AdminFrame from "@/components/admin/AdminFrame";
import OrderActions from "@/components/admin/OrderActions";
import StatusBadge from "@/components/admin/StatusBadge";
import { adminFetch } from "@/lib/admin-api";
import type { AdminOrder } from "@/lib/admin-types";
import { ApiError } from "@/lib/api";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getShippingMethod } from "@/lib/shipping";

const label = "text-[11px] uppercase tracking-[0.2em] text-text/65";

async function loadOrder(id: string): Promise<AdminOrder> {
  try {
    return (await adminFetch<{ order: AdminOrder }>(`/orders/${encodeURIComponent(id)}`)).order;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await loadOrder(id);
  const shipping = getShippingMethod(order.shippingId);

  const timeline = [
    { name: "Placed", at: order.placedAt },
    { name: "Paid", at: order.paidAt },
    { name: "Shipped", at: order.shippedAt },
    { name: "Delivered", at: order.deliveredAt },
    ...(order.cancelledAt ? [{ name: "Cancelled", at: order.cancelledAt }] : []),
  ];

  return (
    <AdminFrame title={order.id} eyebrow="Order">
      <Link
        href="/admin/orders"
        className="-mt-6 mb-8 inline-block text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
      >
        ← All orders
      </Link>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-14">
          <section aria-labelledby="items-heading">
            <div className="flex items-baseline justify-between border-b border-secondary/40 pb-3">
              <h2 id="items-heading" className="font-serif text-2xl text-text">Items</h2>
              <StatusBadge status={order.status} />
            </div>
            <ul className="divide-y divide-secondary/40">
              {order.items.map((item) => (
                <li key={item.id} className="grid grid-cols-[1fr_auto] gap-x-6 py-4 text-sm">
                  <span className="text-text">
                    <span className="font-serif text-lg">{item.name}</span>
                    {item.variantName && <span className="text-text/65"> · {item.variantName}</span>}
                    <span className="block text-xs text-text/65">
                      {item.id} · {item.quantity} × {formatMoney(item.price)}
                    </span>
                  </span>
                  <span className="text-right tabular-nums text-text">
                    {formatMoney(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-2 border-t border-secondary/40 pt-4 text-sm">
              <div className="flex justify-between text-text/70">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatMoney(order.totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-text/70">
                <dt>Shipping · {shipping.label}</dt>
                <dd className="tabular-nums">
                  {order.totals.shipping === 0 ? "Free" : formatMoney(order.totals.shipping)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between pt-2 text-text">
                <dt className="text-xs uppercase tracking-[0.2em]">Total</dt>
                <dd className="font-serif text-2xl lining-nums tabular-nums">{formatMoney(order.totals.total)}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="timeline-heading">
            <h2 id="timeline-heading" className="border-b border-secondary/40 pb-3 font-serif text-2xl text-text">
              Timeline
            </h2>
            <ol className="divide-y divide-secondary/40 text-sm">
              {timeline.map((step) => (
                <li key={step.name} className="flex justify-between py-3">
                  <span className={step.at ? "text-text" : "text-text/65"}>{step.name}</span>
                  <span className="text-text/70">{step.at ? formatDateTime(step.at) : "—"}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-14">
          <section aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="border-b border-secondary/40 pb-3 font-serif text-2xl text-text">
              Next step
            </h2>
            <div className="pt-6">
              <OrderActions orderId={order.id} next={order.nextStatuses} />
              {order.status === "pending_payment" && order.reservedUntil && (
                <p className="mt-6 text-xs text-text/65">
                  Stock is held until {formatDateTime(order.reservedUntil)}, then released.
                </p>
              )}
            </div>
          </section>

          <section aria-labelledby="customer-heading">
            <h2 id="customer-heading" className="border-b border-secondary/40 pb-3 font-serif text-2xl text-text">
              Customer
            </h2>
            <dl className="space-y-6 pt-6 text-sm text-text/80">
              <div>
                <dt className={label}>Contact</dt>
                <dd className="mt-2">
                  {order.name}
                  <br />
                  <a href={`mailto:${order.email}`} className="border-b border-accent text-text">
                    {order.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className={label}>Delivering to</dt>
                <dd className="mt-2 leading-relaxed">
                  {order.address.line1}
                  {order.address.line2 && (
                    <>
                      <br />
                      {order.address.line2}
                    </>
                  )}
                  <br />
                  {order.address.city}, {order.address.postalCode}
                  <br />
                  {order.address.country}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </AdminFrame>
  );
}
