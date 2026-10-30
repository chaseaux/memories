"""Read the seven approved Notion collections; save only after a complete fetch."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
import json
import hashlib
import os
import re
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
SOURCES = {"movies": "3cfb55cf-5b0a-4236-a6a4-2f61073cf176", "games": "7a6ce4bc-d682-4a12-8582-4f49c5c6552b", "books": "c0d7c7dc-ce9b-40fb-94ec-342d3afb56ed", "art": "046b65cd-1edc-43db-8dbd-e2708bd68a51", "live": "0259ef73-b72f-4d96-b38a-607930b62706", "arch": "7bc2f19f-0fde-4e42-be41-d935e770743f", "music": "4d14774e-bc83-4db1-a46d-5a9c77fea43d"}
CATEGORIES = {"movies": "映画", "games": "ゲーム", "books": "本", "art": "アート", "live": "舞台・ライブ", "arch": "建築", "music": "音楽"}
DATE_PROPERTIES = {"movies": ("体験日", "公開日"), "games": ("発売日",), "books": ("読書開始日",), "art": ("体験日",), "live": ("体験日",), "arch": ("訪問日",), "music": ("リリース日",)}
DATE_LABELS = {"体験日": "EXPERIENCED ON", "公開日": "RELEASED ON", "発売日": "RELEASED ON", "読書開始日": "READING STARTED ON", "訪問日": "VISITED ON", "リリース日": "RELEASED ON"}
LABELS = {"映画": "CINEMA", "本": "LITERATURE", "音楽": "MUSIC", "アート": "ART", "舞台・ライブ": "LIVE", "ゲーム": "GAMES", "建築": "ARCHITECTURE", "その他": "OTHER"}


class Notion:
    def __init__(self, token):
        self.token = token
        self.last = 0

    def request(self, path, payload=None):
        for attempt in range(6):
            time.sleep(max(0, .36 - (time.monotonic() - self.last)))
            req = Request("https://api.notion.com/v1/" + path,
                          data=json.dumps(payload).encode() if payload is not None else None,
                          headers={"Authorization": "Bearer " + self.token,
                                   "Notion-Version": "2026-03-11", "Content-Type": "application/json"})
            self.last = time.monotonic()
            try:
                with urlopen(req, timeout=40) as response:
                    return json.load(response)
            except HTTPError as exc:
                if exc.code == 429 or exc.code >= 500:
                    if attempt < 5:
                        time.sleep(min(60, max(2 ** attempt, float(exc.headers.get("Retry-After", "0")))))
                        continue
                raise RuntimeError(f"Notion HTTP {exc.code}; check the connection and its access to both collections.") from None
            except (URLError, TimeoutError):
                if attempt == 5:
                    raise RuntimeError("Notion request timed out; the published snapshot was preserved.") from None
                time.sleep(2 ** attempt)

    def query(self, source):
        rows, cursor = [], None
        while True:
            payload = {"page_size": 100, "sorts": [{"timestamp": "created_time", "direction": "descending"}]}
            if cursor:
                payload["start_cursor"] = cursor
            result = self.request(f"data_sources/{source}/query", payload)
            rows.extend(result["results"])
            if not result.get("has_more"):
                return rows
            cursor = result.get("next_cursor")
            if not cursor:
                raise RuntimeError("Incomplete Notion query; preserving the previous snapshot.")

    def blocks(self, uid):
        blocks, cursor = [], None
        while True:
            path = f"blocks/{uid}/children?page_size=100"
            if cursor:
                path += "&start_cursor=" + cursor
            result = self.request(path)
            blocks.extend(result["results"])
            if not result.get("has_more"):
                return blocks
            cursor = result.get("next_cursor")
            if not cursor:
                raise RuntimeError("Incomplete page content; preserving the previous snapshot.")


def rich_text(items, markdown=False):
    result = ""
    for item in items or []:
        text = item.get("plain_text", item.get("text", {}).get("content", ""))
        if markdown:
            marks = item.get("annotations", {})
            if marks.get("code"):
                text = "`" + text + "`"
            if marks.get("bold"):
                text = "**" + text + "**"
            if marks.get("italic"):
                text = "*" + text + "*"
            href = item.get("href") or (item.get("text", {}).get("link") or {}).get("url")
            if href and href.startswith(("https://", "http://")):
                text = f"[{text}]({href})"
        result += text
    return result


def prop(properties, name, default=None):
    value = properties.get(name, {})
    kind = value.get("type")
    content = value.get(kind)
    if kind in ("title", "rich_text"):
        return rich_text(content)
    if kind in ("select", "status"):
        return (content or {}).get("name", default)
    if kind == "multi_select":
        return [option["name"] for option in content]
    if kind == "date":
        return (content or {}).get("start", default)
    if kind in ("number", "checkbox", "url", "created_time"):
        return content
    if kind == "formula":
        return (content or {}).get((content or {}).get("type"), default)
    return default


def body_markdown(client, uid, depth=0):
    if depth > 20:
        raise RuntimeError("Page nesting exceeded the sync limit.")
    lines = []
    previous_kind = None
    for block in client.blocks(uid):
        if block.get("in_trash") or block.get("archived"):
            continue
        kind = block["type"]
        data = block.get(kind, {})
        text = rich_text(data.get("rich_text", []), markdown=True)
        if kind.startswith("heading_"):
            text = "#" * int(kind[-1]) + " " + text
        elif kind == "bulleted_list_item":
            text = "- " + text
        elif kind == "numbered_list_item":
            text = "1. " + text
        elif kind == "to_do":
            text = ("- [x] " if data.get("checked") else "- [ ] ") + text
        elif kind in ("quote", "callout"):
            text = "> " + text
        elif kind == "divider":
            text = "---"
        elif kind in ("bookmark", "embed", "link_preview"):
            url = data.get("url", "")
            caption = rich_text(data.get("caption", [])) or url
            text = f"[{caption}]({url})" if url.startswith(("https://", "http://")) else ""
        elif kind == "code":
            text = "```" + data.get("language", "") + "\n" + rich_text(data.get("rich_text", [])) + "\n```"
        elif kind == "table_row":
            text = " | ".join(rich_text(cell) for cell in data.get("cells", []))
        elif kind == "equation":
            text = data.get("expression", "")
        elif kind in ("column", "column_list", "table", "synced_block", "toggle", "paragraph"):
            pass
        elif kind in ("child_page", "child_database", "table_of_contents", "breadcrumb"):
            # Subpages and unrelated databases are outside the two approved row collections.
            text = ""
        elif kind == "link_to_page":
            link_id = data.get("page_id")
            text = f"[Notion](https://www.notion.so/{link_id.replace('-', '')})" if link_id else ""
        else:
            raise RuntimeError(f"Unsupported Notion block type '{kind}'; previous content was preserved.")
        if block.get("has_children") and kind not in ("child_page", "child_database"):
            parent = (data.get("synced_from") or {}).get("block_id", block["id"])
            child = body_markdown(client, parent, depth + 1)
            if child:
                nested = "\n".join("  " + line for line in child.splitlines()) if kind in ("bulleted_list_item", "numbered_list_item", "to_do") else child
                text += ("\n" if kind in ("bulleted_list_item", "numbered_list_item", "to_do") else "\n\n") + nested
        if text:
            if lines and kind == previous_kind and kind in ("bulleted_list_item", "numbered_list_item", "to_do"):
                lines[-1] += "\n" + text
            else:
                lines.append(text)
        previous_kind = kind
    return "\n\n".join(lines).strip()


def normalize(page, source, body, cover):
    p = page["properties"]
    music = source == "music"
    category = CATEGORIES.get(source, prop(p, "媒体", "その他") or "その他")
    rating = prop(p, "評価")
    if rating is not None and (isinstance(rating, bool) or not isinstance(rating, (int, float)) or not 0 <= rating <= 10):
        raise RuntimeError(f"Invalid personal rating for {page['id']}; expected a number from 0 to 10.")
    date_keys = DATE_PROPERTIES.get(source, ("体験日",))
    date_key, sort_date = next(((key, prop(p, key)) for key in date_keys if prop(p, key)), (date_keys[0], None))
    personal = re.search(r"^## 感想\s*\n([\s\S]*?)(?=^## |\Z)", body, re.M)
    title = prop(p, "アルバム名" if music else "タイトル", "")
    if not title:
        title = next((rich_text(v["title"]) for v in p.values() if v.get("type") == "title"), "無題")
    original = prop(p, "原題", "") or ""
    if original == "Original Title（翻訳作品の場合のみ）":
        original = ""
    return dict(id=page["id"].replace("-", ""), source=source, title=title, originalTitle=original,
                creator=prop(p, "アーティスト" if music else "作者・監督", "") or "", category=category,
                label=LABELS.get(category, "OTHER"), rating=rating,
                ratingLabel=f"{rating:g} / 10" if rating is not None else "未評価", ratingScale=10,
                hallOfFame=prop(p, "GOAT", False) is True, legacy=prop(p, "レガシー", prop(p, "Legacy", False)) is True,
                sortDate=sort_date, sortDateProperty=date_key, dateLabel=DATE_LABELS[date_key], sourceDatabase="collection://" + SOURCES[source] if source in SOURCES else None,
                experiencedDate=prop(p, "体験日"), releaseDate=prop(p, "リリース日") if music else prop(p, "公開日") or prop(p, "発売日"),
                readingStartedDate=prop(p, "読書開始日"), visitedDate=prop(p, "訪問日"), createdDate=prop(p, "作成日", page.get("created_time")),
                tags=prop(p, "タグ", []), note=(personal.group(1).strip() if personal else "") if music else prop(p, "感想", "") or "",
                body=body, format=prop(p, "フォーマット"),
                scores={key: prop(p, key) for key in ("Metacritic", "Rotten Tomatoes", "Pitchfork", "IGN") if prop(p, key) is not None},
                links={key: prop(p, key) for key in ("Genius", "リンク") if prop(p, key)},
                url="https://app.notion.com/p/" + page["id"].replace("-", ""), cover=cover)


def cover_image(page, staging, previous=None, root=ROOT):
    cover = page.get("cover")
    if not cover:
        return None
    url = cover.get(cover.get("type"), {}).get("url", "")
    error = "invalid URL"
    for attempt in range(3):
        try:
            if not url.startswith("https://"):
                break
            with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; MemoriesSync/1.0)", "Accept": "image/*"}), timeout=25) as response:
                data = response.read(16 * 1024 * 1024 + 1)
                ext = ".png" if data.startswith(b"\x89PNG\r\n\x1a\n") else ".jpg" if data.startswith(b"\xff\xd8\xff") else ".gif" if data.startswith((b"GIF87a", b"GIF89a")) else ".webp" if data[:4] == b"RIFF" and data[8:12] == b"WEBP" else None
                if not ext or len(data) > 16 * 1024 * 1024:
                    raise ValueError("unsupported image")
            break
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            error = f"HTTP {exc.code}" if isinstance(exc, HTTPError) else type(exc).__name__
            if attempt < 2:
                time.sleep(2 ** attempt)
    else:
        data = None
    if not url.startswith("https://") or data is None:
        valid_previous = previous and previous.startswith("assets/covers/") and ".." not in Path(previous).parts and (root / previous).is_file()
        print(f"Cover unavailable for {page['id'].replace('-', '')} ({error}); using {'existing artwork' if valid_previous else 'text placeholder'}.")
        return previous if valid_previous else None
    relative = "assets/covers/" + page["id"].replace("-", "") + ext
    dest = staging / relative
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return relative


def read_archive(path):
    raw = path.read_text(encoding="utf-8")
    return json.loads(raw[raw.index("{"):].strip().removesuffix(";"))


def cover_key(page):
    cover = page.get("cover")
    if not cover:
        return None
    kind = cover.get("type")
    url = cover.get(kind, {}).get("url", "")
    return [kind, url.split("?", 1)[0] if kind == "file" else url]


def page_state(page, source):
    payload = {"version": 1, "source": source, "properties": page["properties"], "cover": cover_key(page)}
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    return {"edited": page.get("last_edited_time"), "fingerprint": digest, "cover": cover_key(page)}


def save_json(path, value):
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n", encoding="utf-8")
    temporary.replace(path)


def sync(client, root=ROOT):
    old = read_archive(root / "data.js")
    old_entries = {entry["id"]: entry for entry in old["entries"]}
    state_path = root / ".notion-sync-state.json"
    previous_state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    previous_state = previous_state.get("pages", {})
    groups, next_state = {}, {}
    fetched = reused = 0
    with tempfile.TemporaryDirectory() as temporary:
        staging = Path(temporary)
        for source, source_id in SOURCES.items():
            pages = [p for p in client.query(source_id) if not p.get("in_trash") and not p.get("archived")]
            groups[source] = []
            for page in pages:
                uid = page["id"].replace("-", "")
                previous = old_entries.get(uid)
                current = page_state(page, source)
                prior = previous_state.get(uid)
                valid_cover = bool(previous and previous.get("cover") and (root / previous["cover"]).is_file())
                if previous and previous.get("source") == source and current == prior and (not page.get("cover") or valid_cover):
                    groups[source].append(previous)
                    next_state[uid] = current
                    reused += 1
                    continue
                reuse_body = bool(previous and previous.get("source") == source and prior and current["fingerprint"] == prior.get("fingerprint") and current["edited"] == prior.get("edited"))
                body = previous["body"] if reuse_body else body_markdown(client, page["id"])
                if valid_cover and prior and prior.get("cover") == current["cover"]:
                    cover = previous["cover"]
                else:
                    cover = cover_image(page, staging, previous.get("cover") if previous else None, root)
                groups[source].append(normalize(page, source, body, cover))
                if page.get("cover") and (not cover or (valid_cover and current["cover"] != (prior or {}).get("cover") and not list(staging.glob(f"assets/covers/{uid}.*")))):
                    current["cover"] = (prior or {}).get("cover")
                next_state[uid] = current
                if reuse_body:
                    reused += 1
                else:
                    fetched += 1
        rows = [entry for i in range(max(map(len, groups.values()))) for source in SOURCES for entry in groups[source][i:i + 1]]
        if not rows:
            raise RuntimeError("All collections returned no rows; keeping the current site.")
        if len({e["id"] for e in rows}) != len(rows):
            raise RuntimeError("Duplicate page IDs in source collections.")
        files = list((staging / "assets" / "covers").glob("*"))
        images_changed = any(not (root / f.relative_to(staging)).exists() or (root / f.relative_to(staging)).read_bytes() != f.read_bytes() for f in files)
        if rows == old["entries"] and not images_changed:
            save_json(state_path, {"version": 1, "pages": next_state})
            print(f"No site changes. Retrieved {fetched} changed records; reused {reused} records.")
            return False
        now = datetime.now(timezone(timedelta(hours=9)))
        archive = dict(old, entries=rows, snapshotDate=now.strftime("%Y.%m.%d"), snapshotAt=now.isoformat())
        # Stage all content before touching the checked-out site. CI never deploys a failed run.
        for file in files:
            dest = root / file.relative_to(staging)
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(file.read_bytes())
        temporary_data = root / "data.js.tmp"
        temporary_data.write_text("const ARCHIVE = " + json.dumps(archive, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
        temporary_data.replace(root / "data.js")
        save_json(state_path, {"version": 1, "pages": next_state})
        print(f"Updated {len(rows)} records. Retrieved {fetched} changed records; reused {reused} records.")
        return True


if __name__ == "__main__":
    token = os.environ.get("NOTION_TOKEN", "").strip()
    if not token:
        raise SystemExit("NOTION_TOKEN is missing. Add the read-only Notion connection token to repository Actions secrets.")
    try:
        sync(Notion(token))
    except Exception as exc:
        raise SystemExit(str(exc)) from None
