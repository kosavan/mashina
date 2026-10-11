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
function minor([n, d]: Ratio): bigint {
  const sign = n < 0 ? -1n : 1n;
  const positive = n * sign * 100n;
  return sign * ((positive * 2n + d) / (d * 2n));
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
