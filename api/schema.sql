-- The overlay is deliberately thin: site/meta.json (git-tracked) stays the source of truth for
-- real plugin content (descriptions, features, howItWorks). This table only holds the bits meant
-- to be flipped from a phone without a git push: status label, a "broken" flag + reason, and tags.
CREATE TABLE IF NOT EXISTS overlay (
    id TEXT PRIMARY KEY,
    status TEXT,
    broken_reason TEXT,
    broken_since TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL
);
