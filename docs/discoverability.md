# Search and AI discovery

English · [Russian](discoverability.ru.md) · [Roadmap](roadmap.md)

Prepared 2026-10-12. Source preparation is not publication, indexing or directory
acceptance. Search engines and AI assistants do not guarantee inclusion.

## GitHub settings

Keep the MASHINA name. Suggested About description:

> Modern, open-source, self-hosted vehicle maintenance tracker. Keep service history, repairs, mileage, fuel and expenses in a beautiful, private app.

Topics: `self-hosted`, `car-maintenance`, `vehicle-maintenance`, `car-logbook`,
`automotive`, `docker`, `pwa`, `fuel-consumption`. Preserve other relevant topics.
After successful publication, set Website to `https://kosavan.github.io/mashina/`.
Use the existing synthetic-data overview for the repository social preview.
These files do not change account settings automatically.

## Publish and verify

Select **GitHub Actions** under repository Settings > Pages. Commit the reviewed
changes. After **MASHINA checks** succeeds for a main-branch push, **Publish MASHINA
website** checks out that exact SHA and publishes only the fourteen files allowed by
`tools/build_site.py`. It never publishes the repository tree or the private app.

Local checks, from a checkout without an existing `dist-site` directory:

```sh
python tools/build_site.py
python tools/check_site.py
python tools/check_docs.py
python tools/check_migrations.py
python tools/check_secrets.py
```

After deployment verify HTTP 200 at `https://kosavan.github.io/mashina/`, its
screenshot and `https://kosavan.github.io/mashina/sitemap.xml`. Inspect canonical
and JSON-LD in page source and use Google's Rich Results Test. Structured data
does not guarantee a rich result. There are no remote fonts, tracking or runtime
scripts. A separate Russian landing page with reciprocal hreflang is future work.

## Root robots rules

Robots rules belong at `https://kosavan.github.io/robots.txt`. A file under
`/mashina/robots.txt` has no authority. Check the root before publication; if
nothing blocks the project, an extra Allow file is unnecessary.
If you own the root site's repository, merge these groups into its rules after
checking other projects on the same origin:

```text
User-agent: OAI-SearchBot
Allow: /mashina/

User-agent: Claude-SearchBot
Allow: /mashina/

User-agent: PerplexityBot
Allow: /mashina/

Sitemap: https://kosavan.github.io/mashina/sitemap.xml
```

Preserve existing general rules and choose training-bot policies separately.
Robots rules are not authentication; never publish personal garage data.
For a custom domain, update canonical, Open Graph, JSON-LD and sitemap together.
No `llms.txt` is required for this implementation.

## Search consoles and directories

1. Add the exact site URL as a URL-prefix property in Google Search Console.
   Verify using its supplied HTML file or meta tag; do not invent a token.
2. Verify in Bing Webmaster Tools or use its supported Search Console import.
   Submit the sitemap in both consoles; inspect indexing and canonical selection.
   These actions need the owner's accounts.
3. The [selfh.st submission form](https://selfh.st/submit/) currently excludes
   newly launched projects from its app directory. Its suggested route is
   **Self-Host Weekly > Project Launch** instead. Request owner authorization
   before sending a newsletter pitch; disclose AI-assisted development honestly.
   Directory submission should wait until eligible. Submission is not acceptance.
4. Check [Awesome Selfhosted's rules](https://github.com/awesome-selfhosted/awesome-selfhosted-data/blob/master/CONTRIBUTING.md)
   when submitting. The first published release must be more than four months
   old; repository creation is not the starting date. MASHINA's first published
   release was v0.1.0 on 2026-10-11; submit no earlier than 2027-02-12 and recheck
   the rules then. MIT alone is insufficient.
5. Adapt your existing promotion kit to community rules.
   Ask real users for installation feedback; do not invent reviews or post in bulk.

Directory description:

> MASHINA is an MIT-licensed, self-hosted vehicle maintenance tracker for service history, repairs, mileage, fuel and expenses. It includes a mobile-friendly PWA, local files, backup/restore and an isolated fictional demo after installation. Runs with Docker using FastAPI, React and SQLite. Eight interface languages: English, German, Russian, Simplified Chinese, Hindi, Spanish, Arabic and French. Physical iPhone validation remains in progress.

## Measure after publication

Record a baseline and repeat monthly using the same language, country and
signed-in state: indexed URLs, impressions, clicks, referring pages and useful
installation feedback. App telemetry is unnecessary.
With web search enabled, test ChatGPT, Claude, Perplexity and Google AI search:

> Find modern open-source self-hosted applications for tracking car maintenance history, repairs and mileage. Prefer mobile-friendly interfaces.

Also test “self-hosted car maintenance tracker”, “LubeLogger alternatives” and
“private vehicle logbook”. Record date, engine, query, presence of MASHINA, cited
URL and factual errors. One answer is variable, not a stable ranking.

## Official sources checked on 2026-10-12

- [Google AI search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [OpenAI crawlers](https://developers.openai.com/api/docs/bots)
- [Anthropic crawler controls](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [LubeLogger repository](https://github.com/hargata/lubelog)
