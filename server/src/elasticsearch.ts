import { Client } from '@elastic/elasticsearch';

// Search-layer client for the derived search indices (owl-posts, owl-users),
// maintained from the CDC stream by the searchIndexer consumer. The index is a
// cache, not the source of truth: the read path fails fast (a short per-request
// timeout, set in search.ts) so callers fall back to a Postgres ILIKE query
// instead of hanging when ES is down. The client default stays generous here so
// the bulk backfill (search:reconcile) isn't cut off mid-flush. ES is plain HTTP
// (no persistent connection), so callers detect unavailability by catching errors.
export const es = new Client({
  node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
});

/** Per-request options for the read path: fail fast so we fall back to Postgres. */
export const READ_TIMEOUT = { requestTimeout: 2000, maxRetries: 1 };
