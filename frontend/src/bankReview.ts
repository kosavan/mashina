export type BankData = {
  date: string;
  signed_minor: number;
  amount_minor: number | null;
  currency: string;
  description: string;
  transaction_id: string;
};
export type Candidate = {
  id: string;
  version: number;
  kind: string;
  date: string;
  amount_minor: number;
  currency: string;
  description: string;
};
export type BankRow = {
  row_id: number;
  data: BankData | null;
  error: string;
  processed: boolean;
  conflict: boolean;
  overlap: boolean;
  candidates: Candidate[];
  candidate_count: number;
};
export type Decision = {
  row_id: number;
  action: "create" | "link" | "ignore";
  event_id?: string;
  expected_version?: number;
  category?: string;
  description?: string;
  ack_separate?: boolean;
};
export type Choices = Record<number, Decision>;
export function selectedDecisions(choices: Choices): Decision[] {
  return Object.values(choices).sort((a, b) => a.row_id - b.row_id);
}
export function reviewSummary(rows: BankRow[], choices: Choices) {
  const totals: Record<string, bigint> = {};
  let created = 0,
    linked = 0,
    ignored = 0,
    unresolved = 0,
    processed = 0;
  for (const row of rows) {
    if (row.processed) {
      processed++;
      continue;
    }
    if (row.conflict || !row.data) continue;
    const choice = choices[row.row_id];
    if (!choice) {
      unresolved++;
      continue;
    }
    if (choice.action === "create" && row.data.amount_minor !== null) {
      created++;
      totals[row.data.currency] =
        (totals[row.data.currency] || 0n) + BigInt(row.data.amount_minor);
    } else if (choice.action === "link") linked++;
    else if (choice.action === "ignore") ignored++;
  }
  return {
    created,
    linked,
    ignored,
    unresolved,
    processed,
    totals: Object.fromEntries(
      Object.entries(totals).map(([key, value]) => [key, value.toString()]),
    ),
  };
}
