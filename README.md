# Memories

Personal collection by chaseaux.

A static gallery of films, music, art, and original notes.

## Publishing

GitHub Actions publishes the site on pushes to `main`. The daily Notion sync runs around **04:17 JST** (19:17 UTC); GitHub may delay scheduled jobs. Use **Actions > Update Notion and publish > Run workflow** for an immediate sync. Push deployments use the saved snapshot and do not contact Notion.

## One-time Notion setup

1. Create an internal Notion connection in the workspace containing the original collections: https://www.notion.so/profile/integrations . Grant **Read content** only; write access and user information are unnecessary.
2. Add that connection to both original databases, **##Braindead!** and the music collection, through their **Connections** menu. Granting access only to a page containing linked database views may not grant access to the originals.
3. In https://github.com/chaseaux/memories/settings/secrets/actions/new , add an Actions repository secret named **NOTION_TOKEN**, with the connection's internal integration token as its value. Keep the token out of source files, issues, and chat.
4. Run **Update Notion and publish** manually and check the result. Until this secret and the two database permissions are set, daily/manual sync cannot complete; the existing site remains online.

The chat's Notion plugin connection is independent of the GitHub runner and is not used by this workflow.

## Update behavior

- Only the two fixed data sources listed in `scripts/sync_notion.py` are read. New rows in either collection will be published publicly as part of this site.
- Titles, original titles, ratings, notes, supported page blocks, critic scores, external links, and covers are refreshed. Removed rows disappear from the next successful snapshot.
- Expiring Notion image URLs and credentials are not published; covers are downloaded as local files.
- Both collections and all row content must be fetched successfully before data is replaced. Missing permissions, empty collections, or unsupported blocks stop the update and preserve the live site. Cover downloads are retried; unavailable artwork retains the previous local image or uses a text placeholder so notes can still update.
- Unchanged content does not create a new snapshot or deployment. A scheduled GitHub job may be disabled after 60 days of repository inactivity; re-enable it from Actions if necessary.
- `python3 -m unittest discover -s tests -v` checks pagination, empty/failed fetch protection, additions/removals, zero scores and no-change behavior. `python3 scripts/package_site.py` exports only the website into `_site/`.

## Credits

Inter is distributed under the SIL Open Font License; see `assets/Inter-OFL.txt`. Cover artwork belongs to its respective rights holders.
