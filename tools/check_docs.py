"""Check English user guides and local documentation links without network access."""

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
ENGLISH = [ROOT / "README.md", ROOT / "ROADMAP.md", *sorted((ROOT / "docs").glob("*.md"))]


def check():
    errors = []
    for path in ENGLISH:
        if path.name.endswith(".ru.md"):
            continue
        content = path.read_text(encoding="utf-8-sig")
        for line, text in enumerate(content.splitlines(), 1):
            if re.search("[А-Яа-яЁё]", text):
                errors.append(f"{path.relative_to(ROOT)}:{line}: Cyrillic in English guide")
        for target in re.findall(r"\]\(([^\s)]+)\)|href=\"([^\"]+)\"", content):
            link = next(value for value in target if value).split("#", 1)[0]
            if not link or re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", link):
                continue
            resolved = (path.parent / link).resolve()
            if not resolved.is_relative_to(ROOT) or not resolved.exists():
                errors.append(f"{path.relative_to(ROOT)}: missing local link {link}")
    if errors:
        raise SystemExit("\n".join(errors))
    print("English user guides: no Cyrillic; local links resolve.")


if __name__ == "__main__":
    check()
