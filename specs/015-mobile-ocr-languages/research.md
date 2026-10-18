# Decisions and verification boundaries

Language selection uses total speakers (first and additional language), excluding
the existing Russian, English and German. The five selected languages are Mandarin
Chinese (Simplified UI), Hindi, Spanish, Modern Standard Arabic and French. Public
ranking summary: [Ethnologue 2026 list](https://en.wikipedia.org/wiki/List_of_languages_by_total_number_of_speakers).
Native-speaker-only or internet-usage rankings would give a different set; no exact
speaker counts or market coverage are promised.

Use local static catalogs, independent message translations, parameter/key checks
and manual correction of common action labels. No owner records enter translation
requests; the shipped app never calls a translation service. Arabic needs RTL;
all five need locale formatting and retained offline preference/queue semantics.

PWA layout follows WebKit's safe-area guidance and capability-based standalone
detection, rather than guessing a device from its user agent:
[WebKit guidance](https://webkit.org/blog/7929/designing-websites-for-iphone-x/).
Automated WebKit/layout checks cannot claim a physical iPhone test.

Private server-side WebP derivatives are generated lazily from existing original
attachments. Preserve original metadata/IDs/hashes and enforce ACLs before every
response. Do not rewrite installed photos or introduce a schema migration.

OCR retains bounded local Tesseract/Poppler, adds deterministic transforms and a
maximum of three pages under the same global deadline. Only clearly labelled
simple item tables can offer candidates. Unknown tax/discount columns are refused;
all candidates remain unchecked and editable. Normal domain Save remains authoritative.
