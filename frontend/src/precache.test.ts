import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runInNewContext } from "node:vm";
import { expect, it } from "vitest";

it("precaches unvisited lazy modules and fonts, versions their content and excludes private files", () => {
  const root = mkdtempSync(join(tmpdir(), "mashina-precache-"));
  try {
    mkdirSync(join(root, "dist/assets/fonts"), { recursive: true });
    mkdirSync(join(root, "public"));
    const worker = readFileSync(new URL("../public/sw.js", import.meta.url));
    writeFileSync(join(root, "public/sw.js"), worker);
    writeFileSync(
      join(root, "dist/index.html"),
      '<script src="/assets/entry.js"></script>',
    );
    writeFileSync(join(root, "dist/assets/entry.js"), "// entry");
    writeFileSync(join(root, "dist/assets/settings.js"), "// lazy settings");
    writeFileSync(join(root, "dist/assets/fonts/local.woff2"), "font");
    writeFileSync(join(root, "dist/private-document.pdf"), "private");
    const build = () => {
      const result = spawnSync(
        process.execPath,
        [fileURLToPath(new URL("../scripts/precache.mjs", import.meta.url))],
        { cwd: root, encoding: "utf8" },
      );
      expect(result.status, result.stderr).toBe(0);
      return runInNewContext(
        readFileSync(join(root, "dist/sw.js"), "utf8") +
          ";({VERSION,PRECACHE})",
        { self: { addEventListener() {} } },
      );
    };
    const first = build();
    expect(first.PRECACHE).toEqual(
      expect.arrayContaining([
        "/assets/entry.js",
        "/assets/settings.js",
        "/assets/fonts/local.woff2",
      ]),
    );
    expect(first.PRECACHE).not.toContain("/private-document.pdf");
    expect(
      first.PRECACHE.some((path: string) => path.startsWith("/api/")),
    ).toBe(false);
    writeFileSync(
      join(root, "dist/assets/settings.js"),
      "// changed lazy module",
    );
    expect(build().VERSION).not.toBe(first.VERSION);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
