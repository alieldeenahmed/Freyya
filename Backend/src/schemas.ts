import { z } from "zod";
import { ORDER_STATUSES, SHIPPING_IDS } from "./db/schema.js";
import { COUNTRIES, MAX_PER_ITEM } from "./domain/pricing.js";
import { notFound } from "./errors.js";

// Postgres cannot store a NUL character and answers with an error, so it never gets that far.
const noNul = (value: string) => !value.includes(String.fromCharCode(0));
const NUL_MESSAGE = "Contains a character that is not allowed.";

const text = (min: number, max: number) =>
  z.string().trim().min(min).max(max).refine(noNul, NUL_MESSAGE);


// Ids in a URL: order numbers, product ids and item ids. Anything else cannot exist, so it is
// a plain "not found" and never reaches the database.
const ID = /^[A-Za-z0-9:._-]{1,100}$/;
export function safeId(value: unknown): string {
  if (typeof value !== "string" || !ID.test(value)) throw notFound();
  return value;
}

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
        skuId: text(1, 100).regex(ID, "Not a valid item id"),
        quantity: z.number().int().min(1).max(MAX_PER_ITEM),
      })
    )
    .min(1)
    .max(20)
    // The same item on two lines counts as one, so the limit on a line can't be got around.
    .superRefine((items, ctx) => {
      const totals = new Map<string, number>();
      items.forEach((item, index) => {
        const total = (totals.get(item.skuId) ?? 0) + item.quantity;
        totals.set(item.skuId, total);
        if (total > MAX_PER_ITEM) {
          ctx.addIssue({
            code: "custom",
            path: [index, "quantity"],
            message: `You can order at most ${MAX_PER_ITEM} of one item.`,
          });
        }
      });
    }),
});

export const payInputSchema = z.object({
  email: z.email().max(254),
});

export const orderLookupSchema = z.object({
  email: z.email().max(254),
});

// A UUID or anything like it. Keeping to plain characters keeps it safe to store and log.
export const idempotencyKeySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9._:-]{8,100}$/, "Use 8 to 100 letters, digits or . _ : -");

export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export const listOrdersQuerySchema = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  search: z.string().trim().max(100).refine(noNul, NUL_MESSAGE).optional(),
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
