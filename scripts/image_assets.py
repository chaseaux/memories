"""Generate compact display images at publish time without modifying Notion originals."""
from io import BytesIO
from pathlib import Path
import hashlib
import warnings
from PIL import Image, ImageOps

MAX_EDGE = 1200
QUALITY = 88


def optimize_cover(root, destination, relative):
    path = Path(relative)
    if path.is_absolute() or ".." in path.parts or not path.as_posix().startswith("assets/covers/"):
        raise ValueError("Invalid local artwork path")
    original = (root / path).read_bytes()
    digest = hashlib.sha256(original + b"memories-1200-q88-v1").hexdigest()[:12]
    stem = f"assets/covers/{path.stem}-{digest}"
    data, extension = original, path.suffix
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(original)) as image:
                # Animated artwork keeps every original frame and its timing.
                if not getattr(image, "is_animated", False):
                    icc = image.info.get("icc_profile")
                    image = ImageOps.exif_transpose(image)
                    image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
                    image = image.convert("RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB")
                    output = BytesIO()
                    options = {"icc_profile": icc} if icc else {}
                    image.save(output, "WEBP", quality=QUALITY, method=6, **options)
                    if output.tell() < len(original):
                        data, extension = output.getvalue(), ".webp"
    except (OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        # Existing browser-supported artwork remains available if conversion is unsupported.
        pass
    result = stem + extension
    out = destination / result
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(data)
    return result, len(original), len(data)
