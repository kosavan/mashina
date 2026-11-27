/** Exact decimal arithmetic for optimistic money. Server remains authoritative. */
type Ratio = [bigint, bigint];
function ratio(value: unknown): Ratio {
  const raw = String(value ?? "0").replace(",", ".");
  if (!/^-?\d+(\.\d{1,12})?$/.test(raw)) throw new Error("Некорректное число");
  const [whole, fraction = ""] = raw.split(".");
  const denominator = 10n ** BigInt(fraction.length);
  const sign = raw.startsWith("-") ? -1n : 1n;
  return [
    BigInt(whole) * denominator + sign * BigInt(fraction || "0"),
    denominator,
  ];
}
function roundRatio([n, d]: Ratio, scale: bigint): bigint {
  const sign = n < 0 ? -1n : 1n;
  const positive = n * sign * scale;
  return sign * ((positive * 2n + d) / (d * 2n));
}
const minor = (value: Ratio) => roundRatio(value, 100n);

export type FuelValues = Record<"liters" | "price" | "amount", string>;

export function fuelPreview({ liters, price, amount }: FuelValues): {
  field: keyof FuelValues;
  value: number;
} | null {
  if ([liters, price, amount].filter(Boolean).length !== 2) return null;
  try {
    const [volume, volumeDivisor] = ratio(liters || "0");
    const [unitPrice, priceDivisor] = ratio(price || "0");
    const [total, totalDivisor] = ratio(amount || "0");
    if (
      (liters && volume <= 0n) ||
      (price && unitPrice <= 0n) ||
      (amount && total <= 0n)
    )
      return null;
    if (!amount) {
      const totalMinor = minor([
        volume * unitPrice,
        volumeDivisor * priceDivisor,
      ]);
      return totalMinor <= 1_000_000_000_000n
        ? { field: "amount", value: Number(totalMinor) }
        : null;
    }
    if (!liters)
      return {
        field: "liters",
        value:
          Number(
            roundRatio(
              [total * priceDivisor, totalDivisor * unitPrice],
              1_000n,
            ),
          ) / 1_000,
      };
    return {
      field: "price",
      value:
        Number(
          roundRatio([total * volumeDivisor, totalDivisor * volume], 10_000n),
        ) / 10_000,
    };
  } catch {
    return null;
  }
}
export function estimatedCost(value: unknown): number | null {
  if (value == null || value === "") return null;
  const [n, d] = ratio(value);
  if (n < 0n || (n * 100n) % d !== 0n || (n * 100n) / d > 1000000000000n)
    throw new Error("Стоимость: неотрицательная сумма с точностью до копеек");
  return Number((n * 100n) / d);
}
export function pendingMoney(record: Record<string, any>): number {
  if (record.kind === "note" || record.kind === "odometer") return 0;
  let result: bigint;
  if (record.kind === "fuel" && !record.amount) {
    const [a, b] = ratio(record.liters);
    const [c, d] = ratio(record.price);
    result = minor([a * c, b * d]);
  } else if (record.kind !== "fuel" && record.items?.length) {
    result =
      record.items.reduce((sum: bigint, item: Record<string, any>) => {
        const [q, qd] = ratio(item.quantity ?? "1");
        const [p, pd] = ratio(item.unit_price);
        const [discount, dd] = ratio(item.discount || "0");
        return sum + minor([q * p * dd - discount * qd * pd, qd * pd * dd]);
      }, 0n) + minor(ratio(record.adjustment || "0"));
  } else result = minor(ratio(record.amount || "0"));
  if (result < 0n || result > 1000000000000n)
    throw new Error("Недопустимая сумма");
  return Number(result);
}
