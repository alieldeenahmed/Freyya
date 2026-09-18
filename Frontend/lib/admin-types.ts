import type { Order, OrderStatus } from "@/lib/orders";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  paid: "Paid",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export const STATUSES = Object.keys(STATUS_LABELS) as OrderStatus[];

export interface AdminStats {
  ordersByStatus: Record<OrderStatus, number>;
  revenue: number;
  ordersLast7Days: number;
  lowStock: { skuId: string; productName: string; variantName: string | null; stock: number }[];
  lowStockThreshold: number;
}

export interface AdminOrderRow {
  id: string;
  placedAt: string;
  name: string;
  email: string;
  status: OrderStatus;
  total: number;
  shippingId: string;
  itemCount: number;
}

export interface AdminOrdersPage {
  items: AdminOrderRow[];
  page: number;
  pageSize: number;
  total: number;
}

export type AdminOrder = Order & {
  reservedUntil: string | null;
  paidAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  nextStatuses: OrderStatus[];
};

export interface InventoryItem {
  skuId: string;
  productId: string;
  productName: string;
  variantName: string | null;
  hex: string | null;
  stock: number;
  updatedAt: string;
  low: boolean;
}

export interface StockMovement {
  id: number;
  delta: number;
  stockAfter: number;
  reason: string;
  orderId: string | null;
  note: string | null;
  actor: string;
  at: string;
}
