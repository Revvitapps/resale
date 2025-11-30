export type SotRow = {
  invoice: string;
  purchaseDate: string;
  item: string;
  hammer: number;
  buyerPremium: number;
  lotFee: number;
  tax: number;
  paidTotal: number;
  marketplace: string;
  soldFor: number;
  marketplaceFees: number;
  shippingCost: number;
  realizedProfit: number;
  realizedRoi?: number | string;
};

export const CSV_HEADERS = [
  "Invoice",
  "Purchase_Date",
  "Item",
  "Hammer",
  "Buyer_Premium_15%",
  "Lot_Fee",
  "Tax",
  "Paid_Total",
  "Marketplace",
  "Sold For",
  "Marketplace_Fees",
  "Shipping_Cost",
  "Realized_Profit",
  "Realized_ROI",
] as const;

export const emptyRow: SotRow = {
  invoice: "",
  purchaseDate: "",
  item: "",
  hammer: 0,
  buyerPremium: 0,
  lotFee: 0,
  tax: 0,
  paidTotal: 0,
  marketplace: "",
  soldFor: 0,
  marketplaceFees: 0,
  shippingCost: 0,
  realizedProfit: 0,
  realizedRoi: "",
};

const normalizeNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  const str = String(value).replace(/,/g, "").trim();
  if (!str) return 0;
  const num = Number(str);
  return Number.isFinite(num) ? num : 0;
};

export const fromCsvRecord = (record: Record<string, string>): SotRow => {
  return {
    invoice: (record["Invoice"] ?? "").trim(),
    purchaseDate: record["Purchase_Date"] ?? "",
    item: record["Item"] ?? "",
    hammer: normalizeNumber(record["Hammer"]),
    buyerPremium: normalizeNumber(record["Buyer_Premium_15%"]),
    lotFee: normalizeNumber(record["Lot_Fee"]),
    tax: normalizeNumber(record["Tax"]),
    paidTotal: normalizeNumber(record["Paid_Total"]),
    marketplace: record["Marketplace"] ?? "",
    soldFor: normalizeNumber(record["Sold For"]),
    marketplaceFees: normalizeNumber(record["Marketplace_Fees"]),
    shippingCost: normalizeNumber(record["Shipping_Cost"]),
    realizedProfit: normalizeNumber(record["Realized_Profit"]),
    realizedRoi: record["Realized_ROI"] ?? "",
  };
};

export const toCsvRecord = (row: SotRow): Record<(typeof CSV_HEADERS)[number], string | number> => {
  return {
    Invoice: row.invoice ?? "",
    Purchase_Date: row.purchaseDate ?? "",
    Item: row.item ?? "",
    Hammer: row.hammer ?? "",
    "Buyer_Premium_15%": row.buyerPremium ?? "",
    Lot_Fee: row.lotFee ?? "",
    Tax: row.tax ?? "",
    Paid_Total: row.paidTotal ?? "",
    Marketplace: row.marketplace ?? "",
    "Sold For": row.soldFor ?? "",
    Marketplace_Fees: row.marketplaceFees ?? "",
    Shipping_Cost: row.shippingCost ?? "",
    Realized_Profit: row.realizedProfit ?? "",
    Realized_ROI: row.realizedRoi ?? "",
  };
};

export const computeFinancials = (row: SotRow): SotRow => {
  const hasSale = Number.isFinite(row.soldFor) && row.soldFor > 0;
  const realizedProfit = hasSale
    ? Number((row.soldFor - row.marketplaceFees - row.shippingCost - row.paidTotal).toFixed(2))
    : row.realizedProfit;
  const realizedRoi = hasSale && row.paidTotal ? realizedProfit / row.paidTotal : "";

  return {
    ...row,
    realizedProfit,
    realizedRoi,
  };
};
