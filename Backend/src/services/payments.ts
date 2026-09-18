import { randomUUID } from "node:crypto";

export interface PaymentRequest {
  orderId: string;
  amountCents: number;
  currency: string;
}

// The seam for a real provider such as Stripe. Nothing else in the app knows how a
// payment is taken, only that it returns a reference or throws.
export interface PaymentProvider {
  charge(request: PaymentRequest): Promise<{ reference: string }>;
}

// Always succeeds. No card details exist anywhere in this API.
export const simulatedPayments: PaymentProvider = {
  async charge() {
    return { reference: `sim_${randomUUID()}` };
  },
};
