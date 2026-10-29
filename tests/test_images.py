from io import BytesIO
import importlib.util
from pathlib import Path
import tempfile
import unittest
from PIL import Image

spec = importlib.util.spec_from_file_location("images", Path(__file__).resolve().parents[1] / "scripts/image_assets.py")
images = importlib.util.module_from_spec(spec)
spec.loader.exec_module(images)


class ImageTests(unittest.TestCase):
    def test_reduces_size_preserves_aspect_alpha_and_original(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / "assets/covers/test.png"
            source.parent.mkdir(parents=True)
            Image.new("RGBA", (2400, 1600), (30, 70, 90, 128)).save(source)
            before = source.read_bytes()
            relative, old_size, new_size = images.optimize_cover(root, root / "output", "assets/covers/test.png")
            self.assertLess(new_size, old_size)
            self.assertEqual(source.read_bytes(), before)
            with Image.open(root / "output" / relative) as converted:
                self.assertEqual(converted.size, (1200, 800))
                self.assertEqual(converted.getpixel((10, 10))[3], 128)

    def test_animated_artwork_is_preserved(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / "assets/covers/animated.gif"
            source.parent.mkdir(parents=True)
            Image.new("RGB", (20, 20), "red").save(source, save_all=True, append_images=[Image.new("RGB", (20, 20), "blue")], duration=100, loop=0)
            relative, _, _ = images.optimize_cover(root, root / "output", "assets/covers/animated.gif")
            self.assertEqual(source.read_bytes(), (root / "output" / relative).read_bytes())

    def test_rejects_paths_outside_cover_directory(self):
        with self.assertRaises(ValueError):
            images.optimize_cover(Path("."), Path("."), "assets/covers/../../data.js")


if __name__ == "__main__":
    unittest.main()
