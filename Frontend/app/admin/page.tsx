import Link from "next/link";
import AdminFrame from "@/components/admin/AdminFrame";
import StatusBadge from "@/components/admin/StatusBadge";
import { adminFetch } from "@/lib/admin-api";
import { STATUSES, STATUS_LABELS, type AdminOrdersPage, type AdminStats } from "@/lib/admin-types";
import { formatDateTime, formatMoney } from "@/lib/format";

function Stat({ label, value, href }: { label: string; value: string; href?: string }) {
  const body = (
    <>
      <p className="text-[11px] uppercase tracking-[0.2em] text-text/65">{label}</p>
      <p className="mt-3 font-serif text-4xl lining-nums text-text">{value}</p>
    </>
  );
  const box = "border border-secondary/50 p-6";

  return href ? (
    <Link href={href} className={`${box} transition-colors hover:border-accent`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  );
}

export default async function AdminOverviewPage() {
  const [stats, recent] = await Promise.all([
    adminFetch<AdminStats>("/stats"),
    adminFetch<AdminOrdersPage>("/orders?pageSize=6"),
  ]);

  const toShip = stats.ordersByStatus.paid;
  const awaiting = stats.ordersByStatus.pending_payment;

  return (
    <AdminFrame title="Overview" eyebrow="Today">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Revenue" value={formatMoney(stats.revenue)} />
        <Stat label="Orders, last 7 days" value={String(stats.ordersLast7Days)} />
        <Stat label="To ship" value={String(toShip)} href="/admin/orders?status=paid" />
        <Stat
          label="Awaiting payment"
          value={String(awaiting)}
          href="/admin/orders?status=pending_payment"
        />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-16 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="recent-heading">
          <div className="flex items-baseline justify-between border-b border-secondary/40 pb-3">
            <h2 id="recent-heading" className="font-serif text-2xl text-text">
              Recent orders
            </h2>
            <Link
              href="/admin/orders"
              className="text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
            >
              All orders
            </Link>
          </div>

          {recent.items.length === 0 ? (
            <p className="py-8 text-sm text-text/65">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-secondary/40">
              {recent.items.map((order) => (
                <li key={order.id} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 py-4">
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="border-b border-transparent text-sm text-text transition-colors hover:border-accent"
                  >
                    {order.id}
                    <span className="text-text/65"> · {order.name}</span>
                  </Link>
                  <span className="text-right text-sm tabular-nums text-text">
                    {formatMoney(order.total)}
                  </span>
                  <span className="text-xs text-text/65">{formatDateTime(order.placedAt)}</span>
                  <span className="text-right">
                    <StatusBadge status={order.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-16">
          <section aria-labelledby="status-heading">
            <h2
              id="status-heading"
              className="border-b border-secondary/40 pb-3 font-serif text-2xl text-text"
            >
              By status
            </h2>
            <ul className="divide-y divide-secondary/40">
              {STATUSES.map((status) => (
                <li key={status}>
                  <Link
                    href={`/admin/orders?status=${status}`}
                    className="flex items-baseline justify-between py-3 text-sm text-text/70 transition-colors hover:text-text"
                  >
                    <span>{STATUS_LABELS[status]}</span>
                    <span className="tabular-nums text-text">{stats.ordersByStatus[status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="low-heading">
            <h2
              id="low-heading"
              className="border-b border-secondary/40 pb-3 font-serif text-2xl text-text"
            >
              Running low
            </h2>
            {stats.lowStock.length === 0 ? (
              <p className="py-6 text-sm text-text/65">Everything is well stocked.</p>
            ) : (
              <ul className="divide-y divide-secondary/40">
                {stats.lowStock.map((item) => (
                  <li key={item.skuId} className="flex items-baseline justify-between py-3 text-sm">
                    <span className="text-text/70">
                      {item.productName}
                      {item.variantName && ` · ${item.variantName}`}
                    </span>
                    <span className="tabular-nums text-accent-deep">
                      {item.stock === 0 ? "Sold out" : `${item.stock} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/admin/inventory"
              className="mt-4 inline-block text-xs uppercase tracking-[0.2em] text-text/65 transition-colors hover:text-text"
            >
              Manage inventory
            </Link>
          </section>
        </div>
      </div>
    </AdminFrame>
  );
}
