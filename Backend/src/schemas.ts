import { z } from "zod";
import { ORDER_STATUSES, SHIPPING_IDS } from "./db/schema.js";
import { COUNTRIES } from "./domain/pricing.js";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const orderInputSchema = z.object({
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  name: text(2, 100),
  address: z.object({
    line1: text(4, 120),
    line2: text(1, 120).optional(),
    city: text(2, 80),
    postalCode: text(3, 20),
    country: z.enum(COUNTRIES),
  }),
  shippingId: z.enum(SHIPPING_IDS),
  items: z
    .array(
      z.object({
        skuId: text(1, 100),
        quantity: z.number().int().min(1).max(10),
      })
    )
    .min(1)
    .max(20),
});

export const payInputSchema = z.object({
  email: z.email().max(254),
});

export const orderLookupSchema = z.object({
  email: z.email().max(254),
});

export const idempotencyKeySchema = z.string().trim().min(8).max(100);

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const transitionSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

export const adjustStockSchema = z.object({
  delta: z
    .number()
    .int()
    .min(-10_000)
    .max(10_000)
    .refine((value) => value !== 0, "Change can't be zero"),
  reason: z.enum(["restock", "adjustment"]),
  note: text(1, 200).optional(),
});
