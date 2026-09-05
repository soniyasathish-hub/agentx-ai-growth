export const currency = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));

export const currencyPrecise = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value ?? 0));

export const numberFmt = (value: number | string | null | undefined) =>
  new Intl.NumberFormat("en-US").format(Number(value ?? 0));

export const dateFmt = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

export const dateTimeFmt = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";
