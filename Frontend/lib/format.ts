const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export const formatMoney = (amount: number) => money.format(amount);

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));
