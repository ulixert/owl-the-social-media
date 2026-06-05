-- Full-text search support for Post.text, backing the Postgres fallback in
-- searchPostsFromDb (used when Elasticsearch is cold or down). Replaces an
-- unindexable `ILIKE '%q%'` seq scan with an indexed, ranked, stemmed query.

-- A STORED generated tsvector that Postgres keeps in sync on every write, so the
-- app never maintains it. Adding the column backfills all existing rows (a
-- one-time table rewrite). 'english' applies stemming + stopword removal.
ALTER TABLE "Post"
  ADD COLUMN "textsearch" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("text", ''))) STORED;

-- GIN index over the vector so `textsearch @@ query` is index-backed.
CREATE INDEX "Post_textsearch_idx" ON "Post" USING GIN ("textsearch");
