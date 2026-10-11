import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./button";
describe("accessible button primitive", () => {
  it("keeps disabled semantics and accessible label", () => {
    const html = renderToStaticMarkup(
      <Button disabled aria-label="Сохранить запись">
        Сохранить
      </Button>,
    );
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-label="Сохранить запись"');
    expect(html).toContain("button-primary");
  });
});
