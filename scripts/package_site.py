"""Package only browser assets, keeping automation code out of the deployed site."""
from pathlib import Path
import shutil
import hashlib
import re
import json
from sync_notion import read_archive
from image_assets import optimize_cover

root = Path(__file__).resolve().parents[1]
dest = root / "_site"
if dest.exists():
    if dest.is_symlink() or dest.resolve().parent != root.resolve():
        raise ValueError("Refusing to clean an output directory outside the repository")
    shutil.rmtree(dest)
dest.mkdir(exist_ok=True)
for name in ("index.html", "floating.css", "reference-tokens.css", "archive.js", "paper.js", "section-scroll.js", "detail-transition.js", "collection-snap.js", "floating.js", "data.js", ".nojekyll", "assets/inter.ttf", "assets/Inter-OFL.txt"):
    out = dest / name
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / name, out)
archive = read_archive(root / "data.js")
original_bytes = published_bytes = 0
for entry in archive["entries"]:
    if entry.get("cover"):
        relative, before, after = optimize_cover(root, dest, entry["cover"])
        entry["cover"] = relative
        original_bytes += before
        published_bytes += after
(dest / "data.js").write_text("const ARCHIVE = " + json.dumps(archive, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
html = (dest / "index.html").read_text(encoding="utf-8")
def version(match):
    path = match[2]
    digest = hashlib.sha256((dest / path).read_bytes()).hexdigest()[:12]
    return f'{match[1]}="{path}?v={digest}"'
html = re.sub(r'(src|href)="([^"?]+\.(?:js|css))(?:\?[^"]*)?"', version, html)
(dest / "index.html").write_text(html, encoding="utf-8")
# Validate the packaged artifact rather than trusting the asset-copy list.
for reference in re.findall(r'(?:src|href)="([^"<>]+)"', html):
    if reference.startswith(("#", "https:", "http:", "data:")):
        continue
    relative = reference.split("?", 1)[0].split("#", 1)[0]
    if relative and not (dest / relative).is_file():
        raise ValueError(f"Packaged HTML references a missing asset: {relative}")

print(f"Packaged the site in _site/. Cover image bytes: {original_bytes} -> {published_bytes} ({1-published_bytes/max(1,original_bytes):.1%} smaller).")
