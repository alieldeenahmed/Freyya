import AdminFrame from "@/components/admin/AdminFrame";
import InventoryTable from "@/components/admin/InventoryTable";
import { adminFetch } from "@/lib/admin-api";
import type { InventoryItem } from "@/lib/admin-types";

export default async function AdminInventoryPage() {
  const { items } = await adminFetch<{ items: InventoryItem[] }>("/inventory");
  const units = items.reduce((sum, item) => sum + item.stock, 0);
  const low = items.filter((item) => item.low).length;

  return (
    <AdminFrame title="Inventory" eyebrow="Stock">
      <p className="-mt-4 mb-10 text-sm text-text/70">
        {units} units across {items.length} items.{" "}
        {low > 0 ? `${low} running low.` : "Nothing is running low."} Every change is recorded in an
        item&apos;s history.
      </p>
      <InventoryTable items={items} />
    </AdminFrame>
  );
}
