export type ReceiptFields = {
  vehicle_id: string;
  occurred_at: string;
  amount: string;
  currency: string;
  category: string;
  description: string;
};

export type ReceiptDraft = {
  id: string;
  image: File;
  takenAt: string;
  commit?: ReceiptFields;
};
