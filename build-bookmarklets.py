#!/usr/bin/env python3
"""Generate bookmarklets from the Loop exporter userscripts.

For each *.user.js the Tampermonkey header is stripped and the on-page button
(whose click ran the conversion) is replaced by an immediate call to the
conversion function, so clicking the bookmark does the copy directly.

Outputs, in dist/:
  <name>.bookmarklet.txt  - the raw `javascript:` URL, ready to paste
  install.html            - a page with drag-to-bookmark-bar links
"""

import re
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"

SCRIPTS = {
    "loop-to-markdown.user.js": "Copy Loop as Markdown",
    "loop-to-mediawiki.user.js": "Copy Loop as MediaWiki",
}

# Matches the trailing button block:
#   const btn = document.createElement('button');
#   ... (several lines) ...
#   btn.onclick = <entryFn>;
#   document.body.appendChild(btn);
BUTTON_BLOCK = re.compile(
    r"const btn = document\.createElement\('button'\);.*?"
    r"btn\.onclick = (?P<fn>\w+);\s*"
    r"document\.body\.appendChild\(btn\);",
    re.DOTALL,
)


def to_bookmarklet(source: str) -> str:
    # Drop the // ==UserScript== ... // ==/UserScript== header.
    source = re.sub(r"//\s*==UserScript==.*?//\s*==/UserScript==\n?", "", source,
                    count=1, flags=re.DOTALL)

    # Replace the on-page button with a direct call to the entry function.
    def replace(m: re.Match) -> str:
        return f"{m.group('fn')}();"

    source, n = BUTTON_BLOCK.subn(replace, source)
    if n != 1:
        raise SystemExit(f"expected exactly one button block, found {n}")

    # Newlines are preserved (encoded) so `//` line comments stay valid.
    return "javascript:" + urllib.parse.quote(source.strip(), safe="")


def main() -> None:
    DIST.mkdir(exist_ok=True)
    cards = []
    for filename, label in SCRIPTS.items():
        bookmarklet = to_bookmarklet((ROOT / filename).read_text())
        out = DIST / (Path(filename).stem.replace(".user", "") + ".bookmarklet.txt")
        out.write_text(bookmarklet + "\n")
        print(f"{out.name}: {len(bookmarklet)} chars")
        # href is HTML-attribute-escaped for the install page.
        href = bookmarklet.replace("&", "&amp;").replace('"', "&quot;")
        cards.append(
            f'      <a class="bm" href="{href}">📋 {label}</a>'
        )

    links = "\n".join(cards)
    install = f"""<!doctype html>
<meta charset="utf-8">
<title>Install Loop exporter bookmarklets</title>
<style>
  body {{ font-family: system-ui, sans-serif; max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }}
  .bm {{ display: inline-block; margin: .4rem .6rem .4rem 0; padding: .5rem .9rem;
        background: #0078D4; color: #fff; text-decoration: none; border-radius: 5px; }}
  code {{ background: #f2f2f2; padding: .1rem .3rem; border-radius: 3px; }}
</style>
<h1>Loop exporter bookmarklets</h1>
<p><strong>Drag</strong> a button below onto your bookmarks bar. Then open a
Microsoft Loop page and click it to copy the page to your clipboard.</p>
<p>
{links}
</p>
<p>Clicking a link here won't work (there's no Loop page loaded) — you must
drag it to the bookmarks bar first.</p>
"""
    (DIST / "install.html").write_text(install)
    print(f"install.html written to {DIST}")


if __name__ == "__main__":
    main()
