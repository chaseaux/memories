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
        source = next(key for key, value in sync.SOURCES.items() if value == uid)
        return [] if source == "books" else [page(source, list(sync.SOURCES).index(source) + 1)]

    def blocks(self, uid):
        return [{"id": "heading", "type": "heading_2", "heading_2": {"rich_text": rt("感想")}},
                {"id": "p", "type": "paragraph", "paragraph": {"rich_text": rt("Updated note")}}]


class SyncTests(unittest.TestCase):
    def test_unchanged_records_do_not_fetch_bodies_or_images(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'data.js').write_text('const ARCHIVE = {"entries":[]};', encoding='utf-8')
            client = FakeClient()
            sync.sync(client, root)
            with patch.object(client, 'blocks', side_effect=AssertionError('Unchanged body fetched')), patch.object(sync, 'cover_image', side_effect=AssertionError('Unchanged cover fetched')):
                self.assertFalse(sync.sync(client, root))

    def test_only_changed_record_is_fetched_and_deleted_record_is_removed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'data.js').write_text('const ARCHIVE = {"entries":[]};', encoding='utf-8')
            client = FakeClient()
            sync.sync(client, root)
            original_query = client.query
            def changed_query(uid):
                if uid == sync.SOURCES['arch']:
                    return []
                rows = original_query(uid)
                if uid == sync.SOURCES['movies']:
                    rows[0]['properties']['評価']['number'] = 8
                return rows
            with patch.object(client, 'query', side_effect=changed_query), patch.object(client, 'blocks', wraps=client.blocks) as blocks:
                self.assertTrue(sync.sync(client, root))
                self.assertEqual(blocks.call_count, 1)
            entries = sync.read_archive(root / 'data.js')['entries']
            self.assertFalse(any(e['source'] == 'arch' for e in entries))
            self.assertEqual(next(e['rating'] for e in entries if e['source'] == 'movies'), 8)

    def test_body_timestamp_and_signed_image_identity(self):
        before = page('movies', 1)
        before['last_edited_time'] = '2026-10-01T00:00:00Z'
        before['cover'] = {'type': 'file', 'file': {'url': 'https://example.com/art.jpg?signature=old'}}
        after = dict(before, cover={'type': 'file', 'file': {'url': 'https://example.com/art.jpg?signature=new'}})
        self.assertEqual(sync.page_state(before, 'movies'), sync.page_state(after, 'movies'))
        after['last_edited_time'] = '2026-10-02T00:00:00Z'
        self.assertNotEqual(sync.page_state(before, 'movies'), sync.page_state(after, 'movies'))

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

    def test_tracks_remain_one_continuous_numbered_list(self):
        client = FakeClient()
        blocks = [{"id": str(i), "type": "numbered_list_item", "numbered_list_item": {"rich_text": rt(name)}} for i, name in enumerate(("First", "Second", "Third"))]
        with patch.object(client, "blocks", return_value=blocks):
            self.assertEqual(sync.body_markdown(client, "page"), "1. First\n1. Second\n1. Third")

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
            self.assertEqual(len(result["entries"]), len(sync.SOURCES) - 1)
            self.assertNotIn("removed", [e["id"] for e in result["entries"]])
            self.assertEqual(next(e for e in result["entries"] if e["source"] == "music")["note"], "Updated note")
            original = (root / "data.js").read_bytes()
            self.assertFalse(sync.sync(FakeClient(), root))
            self.assertEqual((root / "data.js").read_bytes(), original)

    def test_unsupported_block_does_not_silently_drop_content(self):
        client = FakeClient()
        with patch.object(client, "blocks", return_value=[{"id": "unknown", "type": "unsupported"}]):
            with self.assertRaises(RuntimeError):
                sync.body_markdown(client, "page")

    def test_collection_dates_numeric_ratings_and_checkboxes(self):
        expected = {"movies": "体験日", "games": "発売日", "books": "読書開始日", "art": "体験日", "live": "体験日", "arch": "訪問日", "music": "リリース日"}
        for source, field in expected.items():
            with self.subTest(source=source):
                row = page(source, 1)
                row["properties"][field] = {"type": "date", "date": {"start": "2026-10-01"}}
                row["properties"]["GOAT"] = {"type": "checkbox", "checkbox": True}
                row["properties"]["レガシー"] = {"type": "checkbox", "checkbox": False}
                entry = sync.normalize(row, source, "", None)
                self.assertEqual(entry["sortDate"], "2026-10-01")
                self.assertEqual(entry["ratingLabel"], "0 / 10")
                self.assertTrue(entry["hallOfFame"])
                self.assertFalse(entry["legacy"])
        row = page("movies", 1)
        row["properties"]["公開日"] = {"type": "date", "date": {"start": "1990-01-01"}}
        entry = sync.normalize(row, "movies", "", None)
        self.assertEqual(entry["sortDate"], "1990-01-01")
        self.assertFalse(entry["legacy"])
        row["properties"]["レガシー"] = {"type": "checkbox", "checkbox": True}
        self.assertTrue(sync.normalize(row, "movies", "", None)["legacy"])

    def test_non_numeric_personal_rating_preserves_existing_snapshot(self):
        row = page("movies", 1)
        row["properties"]["評価"] = {"type": "select", "select": {"name": "★★★★"}}
        with self.assertRaises(RuntimeError):
            sync.normalize(row, "movies", "", None)


if __name__ == "__main__":
    unittest.main()
