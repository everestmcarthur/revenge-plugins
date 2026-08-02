-- Every displayed field can now be overridden here, not just status/broken/tags - editing anything
-- from the admin plugin should show up on the live site immediately, no git push needed. A row can
-- also stand entirely on its own (is_draft = 1): a plugin that doesn't exist in the git repo at all,
-- created straight from the admin plugin for quick testing, with its own manifest/JS served directly
-- from here instead of from the built dist/ output.
DROP TABLE IF EXISTS overlay;
CREATE TABLE overlay (
    id TEXT PRIMARY KEY,
    name TEXT,
    description TEXT,
    category TEXT,
    status TEXT,
    accent TEXT,
    tagline TEXT,
    note TEXT,
    how_it_works TEXT,
    features TEXT,              -- JSON array of strings
    commands TEXT,               -- JSON array of {cmd, desc}
    limitations TEXT,
    authors TEXT,                 -- JSON array of strings
    broken_reason TEXT,
    broken_since TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    is_draft INTEGER NOT NULL DEFAULT 0,
    manifest TEXT,                -- full manifest.json content - only used when is_draft = 1
    main_js TEXT,                 -- index.js source - only used when is_draft = 1
    updated_at TEXT NOT NULL
);
