import Link from "next/link";
import AdminFrame from "@/components/admin/AdminFrame";
import StatusBadge from "@/components/admin/StatusBadge";
import { adminFetch } from "@/lib/admin-api";
import {
  STATUSES,
  STATUS_LABELS,
  type AdminOrdersPage,
  type AdminStats,
} from "@/lib/admin-types";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { OrderStatus } from "@/lib/orders";

const PAGE_SIZE = 15;

interface SearchParams {
  status?: string;
  search?: string;
  page?: string;
}

const isStatus = (value: string | undefined): value is OrderStatus =>
  STATUSES.includes(value as OrderStatus);

function href(params: { status?: string; search?: string; page?: number }) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  if (params.page && params.page > 1) query.set("page", String(params.page));
  const text = query.toString();
  return `/admin/orders${text ? `?${text}` : ""}`;
}

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const status = isStatus(raw.status) ? raw.status : undefined;
  const search = raw.search?.trim() || undefined;
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);

  const query = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (status) query.set("status", status);
  if (search) query.set("search", search);

  const [orders, stats] = await Promise.all([
    adminFetch<AdminOrdersPage>(`/orders?${query}`),
    adminFetch<AdminStats>("/stats"),
  ]);

  const pages = Math.max(1, Math.ceil(orders.total / PAGE_SIZE));
  const totalAll = Object.values(stats.ordersByStatus).reduce((sum, n) => sum + n, 0);

  return (
    <AdminFrame title="Orders" eyebrow="Sales">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {[{ id: undefined, label: "All", count: totalAll }, ...STATUSES.map((s) => ({
            id: s,
            label: STATUS_LABELS[s],
            count: stats.ordersByStatus[s],
          }))].map((tab) => {
            const active = tab.id === status;
            return (
              <Link
                key={tab.label}
                href={href({ status: tab.id, ...(search && { search }) })}
                aria-current={active ? "page" : undefined}
                className={`border px-4 py-2 text-xs uppercase tracking-[0.15em] transition-colors ${
                  active
                    ? "border-text bg-text text-base"
                    : "border-secondary/60 text-text/70 hover:border-accent hover:text-accent-deep"
                }`}
              >
                {tab.label} <span className={active ? "text-base/70" : "text-text/65"}>{tab.count}</span>
              </Link>
            );
          })}
        </nav>

        <form action="/admin/orders" role="search" className="flex items-end gap-3">
          {status && <input type="hidden" name="status" value={status} />}
          <div>
            <label htmlFor="order-search" className="block text-[11px] uppercase tracking-[0.2em] text-text/65">
              Search
            </label>
            <input
              id="order-search"
              name="search"
              defaultValue={search}
              placeholder="Number, name or email"
              className="mt-1 w-56 border-0 border-b border-secondary/60 bg-transparent py-2 text-sm text-text placeholder:text-text/65 focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="border border-text px-5 py-2 text-xs uppercase tracking-[0.2em] text-text transition-colors hover:border-accent hover:text-accent-deep"
          >
            Find
          </button>
        </form>
      </div>

      <div className="relative mt-10 overflow-x-auto" data-lenis-prevent>
        {orders.items.length === 0 ? (
          <p className="py-12 text-sm text-text/65">No orders match.</p>
        ) : (
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-secondary/40 text-[11px] uppercase tracking-[0.2em] text-text/65">
                <th scope="col" className="py-3 pr-4 font-normal">Order</th>
                <th scope="col" className="py-3 pr-4 font-normal">Placed</th>
                <th scope="col" className="py-3 pr-4 font-normal">Customer</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">Items</th>
                <th scope="col" className="py-3 pr-4 text-right font-normal">Total</th>
                <th scope="col" className="py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.items.map((order) => (
                <tr key={order.id} className="border-b border-secondary/40">
                  <td className="py-4 pr-4">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="border-b border-accent text-text transition-colors hover:text-accent-deep"
                    >
                      {order.id}
                    </Link>
                  </td>
                  <td className="py-4 pr-4 text-text/70">{formatDateTime(order.placedAt)}</td>
                  <td className="py-4 pr-4">
                    <span className="block text-text">{order.name}</span>
                    <span className="block text-xs text-text/65">{order.email}</span>
                  </td>
                  <td className="py-4 pr-4 text-right tabular-nums text-text/70">{order.itemCount}</td>
                  <td className="py-4 pr-4 text-right tabular-nums text-text">
                    {formatMoney(order.total)}
                  </td>
                  <td className="py-4">
                    <StatusBadge status={order.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-8 flex items-center justify-between text-xs uppercase tracking-[0.2em]">
          {page > 1 ? (
            <Link
              href={href({ ...(status && { status }), ...(search && { search }), page: page - 1 })}
              className="text-text/65 transition-colors hover:text-text"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-text/65">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link
              href={href({ ...(status && { status }), ...(search && { search }), page: page + 1 })}
              className="text-text/65 transition-colors hover:text-text"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </AdminFrame>
  );
}
