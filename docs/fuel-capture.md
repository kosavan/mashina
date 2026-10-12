# Fast fuel entry

English · [Russian](fuel-capture.ru.md)

1. **+ → Fill-up**. Check suggested car, date, fuel and station.
2. Enter mileage and any two of litres, unit price and total; the third is calculated.
3. Mark full tank only when actually filled. Mark missed records explicitly.
4. Optionally attach a receipt and save. Offline records stay on the device;
   attachment uploads require connectivity.

| Source | Useful printed facts | Confirm separately |
|---|---|---|
| Receipt | Date, litres, price, total, station/fuel if printed | Mileage, full tank, missed records |
| Bank screenshot | Payment, date and merchant if visible | Fuel purchase, litres, price, mileage, full tank |
| Bank CSV | Date, amount, description and operation ID | Link existing entry or create expense |

[Local OCR](local-ocr.md) proposes fields for mandatory human review. Select
dashboard mode for labelled mileage or general screenshot mode for apps. Source
attachment is optional. Redact unrelated payments/balances first. Text OCR is
not universal document understanding. [Bank import](bank-import.md) links an
existing fill-up without duplicate money. [MCP](machine-access.md) is read-only;
scoped REST writes require permission and stable operation IDs. Future recognition
also remains local, without cloud fallback.
