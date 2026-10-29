import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("sync", Path(__file__).resolve().parents[1] / "scripts/sync_notion.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def rt(text):
    return [{"type": "text", "plain_text": text, "text": {"content": text, "link": None}}]


def page(source, number):
    return {"id": f"{number:032x}", "cover": None, "created_time": "2026-01-01T00:00:00Z", "properties": {
        "アルバム名" if source == "music" else "タイトル": {"type": "title", "title": rt("New title")},
        "評価": {"type": "number", "number": 0},
        "Metacritic": {"type": "number", "number": 0},
        "Pitchfork": {"type": "number", "number": None},
    }}


class FakeClient:
    def query(self, uid):
        return [page("music" if uid == sync.SOURCES["music"] else "brain", 2 if uid == sync.SOURCES["music"] else 1)]

    def blocks(self, uid):
        return [{"id": "heading", "type": "heading_2", "heading_2": {"rich_text": rt("感想")}},
                {"id": "p", "type": "paragraph", "paragraph": {"rich_text": rt("Updated note")}}]


class SyncTests(unittest.TestCase):
    def test_zero_and_empty_scores(self):
        entry = sync.normalize(page("music", 1), "music", "## 感想\nNew note", None)
        self.assertEqual(entry["ratingLabel"], "0 / 10")
        self.assertEqual(entry["scores"], {"Metacritic": 0})
        self.assertEqual(entry["note"], "New note")

    def test_unlinked_rich_text_and_links(self):
        self.assertEqual(sync.rich_text(rt("Plain"), True), "Plain")
        item = rt("Song")[0]
        item["href"] = "https://example.com/song"
        self.assertEqual(sync.rich_text([item], True), "[Song](https://example.com/song)")

    def test_pagination(self):
        client = sync.Notion("not-a-real-token")
        with patch.object(client, "request", side_effect=[{"results": [1], "has_more": True, "next_cursor": "next"}, {"results": [2], "has_more": False}]) as request:
            self.assertEqual(client.query("source"), [1, 2])
            self.assertEqual(request.call_args_list[1].args[1]["start_cursor"], "next")

    def test_unavailable_cover_retains_existing_image(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            cover = root / "assets/covers/previous.jpg"
            cover.parent.mkdir(parents=True)
            cover.write_bytes(b"existing image")
            row = page("brain", 1)
            row["cover"] = {"type": "external", "external": {"url": "https://example.com/image"}}
            with patch.object(sync, "urlopen", side_effect=sync.URLError("unavailable")), patch.object(sync.time, "sleep"):
                self.assertEqual(sync.cover_image(row, root, "assets/covers/previous.jpg", root), "assets/covers/previous.jpg")
                self.assertIsNone(sync.cover_image(row, root, None, root))

    def test_failed_fetch_preserves_site(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            before = 'const ARCHIVE = {"entries":[{"id":"old"}]};'
            (root / "data.js").write_text(before, encoding="utf-8")
            client = FakeClient()
            with patch.object(client, "blocks", side_effect=RuntimeError("No access")):
                with self.assertRaises(RuntimeError):
                    sync.sync(client, root)
            self.assertEqual((root / "data.js").read_text(encoding="utf-8"), before)

    def test_empty_collection_preserves_site(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            before = 'const ARCHIVE = {"entries":[{"id":"old"}]};'
            (root / "data.js").write_text(before, encoding="utf-8")
            client = FakeClient()
            with patch.object(client, "query", return_value=[]):
                with self.assertRaises(RuntimeError):
                    sync.sync(client, root)
            self.assertEqual((root / "data.js").read_text(encoding="utf-8"), before)

    def test_updates_new_and_removed_rows_then_stops_when_unchanged(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "data.js").write_text('const ARCHIVE = {"entries":[{"id":"removed"}]};', encoding="utf-8")
            self.assertTrue(sync.sync(FakeClient(), root))
            result = sync.read_archive(root / "data.js")
            self.assertEqual(len(result["entries"]), 2)
            self.assertNotIn("removed", [e["id"] for e in result["entries"]])
            self.assertEqual(result["entries"][1]["note"], "Updated note")
            original = (root / "data.js").read_bytes()
            self.assertFalse(sync.sync(FakeClient(), root))
            self.assertEqual((root / "data.js").read_bytes(), original)

    def test_unsupported_block_does_not_silently_drop_content(self):
        client = FakeClient()
        with patch.object(client, "blocks", return_value=[{"id": "unknown", "type": "unsupported"}]):
            with self.assertRaises(RuntimeError):
                sync.body_markdown(client, "page")


if __name__ == "__main__":
    unittest.main()
