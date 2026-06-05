import { Client } from '@elastic/elasticsearch';

// Search-layer client for the derived search indices (owl-posts, owl-users),
// maintained from the CDC stream by the searchIndexer consumer. Like the Redis
// client, requests fail fast so callers can fall back to a Postgres ILIKE query
// instead of hanging when Elasticsearch is down — the index is a cache, not the
// source of truth. ES is plain HTTP (no persistent connection), so there's no
// `.status` to gate on; callers detect unavailability by catching errors.
export const es = new Client({
  node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200',
  requestTimeout: 2000,
  maxRetries: 1,
});
