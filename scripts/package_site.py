"""Package only browser assets, keeping automation code out of the deployed site."""
from pathlib import Path
import shutil
import hashlib
import re
from sync_notion import read_archive

root = Path(__file__).resolve().parents[1]
dest = root / "_site"
dest.mkdir(exist_ok=True)
for name in ("index.html", "floating.css", "reference-tokens.css", "archive.js", "paper.js", "section-scroll.js", "floating.js", "data.js", ".nojekyll", "assets/inter.ttf", "assets/Inter-OFL.txt"):
    out = dest / name
    out.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / name, out)
html = (dest / "index.html").read_text(encoding="utf-8")
def version(match):
    path = match[2]
    digest = hashlib.sha256((dest / path).read_bytes()).hexdigest()[:12]
    return f'{match[1]}="{path}?v={digest}"'
html = re.sub(r'(src|href)="([^"?]+\.(?:js|css))(?:\?[^"]*)?"', version, html)
(dest / "index.html").write_text(html, encoding="utf-8")
for entry in read_archive(root / "data.js")["entries"]:
    if entry.get("cover"):
        relative = Path(entry["cover"])
        if relative.is_absolute() or ".." in relative.parts or not relative.as_posix().startswith("assets/covers/"):
            raise ValueError("Invalid local artwork path")
        out = dest / relative
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / relative, out)
print("Packaged the site in _site/.")
