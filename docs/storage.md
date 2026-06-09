# Image storage & uploads

Images (post attachments, profile pictures) used to be external URLs pasted into a
text box. They're now real **uploads** that go through a storage abstraction, so the
backend can be a local disk today and S3 later without touching the rest of the app.

```
client file picker ──> POST /api/v1/upload (multipart, protectRoute)
                              │  multer parses to a Buffer in memory
                              ▼
                       storage.save(buffer, contentType)      ← the seam
                              │
              ┌───────────────┴────────────────┐
        DiskStorage                        S3Storage
   writes UPLOAD_DIR/<uuid>.<ext>     PutObject to a bucket
   returns /api/v1/media/<uuid>.<ext>  returns the CDN (or bucket) URL
                              │
        GET /api/v1/media/<file> ──> express.static(UPLOAD_DIR)   (disk only)
```

## The seam

`server/src/storage/` is the whole abstraction:

- **`types.ts`** — the `Storage` interface (`save`, `delete`) and the allowed image
  MIME → extension map.
- **`diskStorage.ts`** — writes bytes to a directory, serves them back as relative
  URLs under the API prefix.
- **`s3Storage.ts`** — the S3 backend (also works against S3-compatible stores like
  Cloudflare R2 or MinIO via `S3_ENDPOINT`). Turning it on is self-contained: set
  `STORAGE_DRIVER=s3` and `S3_BUCKET`. The AWS SDK is imported lazily, so a disk-only
  deploy never loads it. Nothing in the controllers, the client, or the seed knows
  which backend ran — they only see the returned `url`.
- **`index.ts`** — the factory that picks a backend from `STORAGE_DRIVER` (default
  `disk`) plus the path/URL config.

Serving uploads **under the API prefix** (`/api/v1/media/...`) is deliberate: the Vite
dev proxy (`/api`) and Caddy (`/api/v1/*`) already forward that path to Express, so one
relative URL works in dev and prod with no proxy or Caddyfile changes. When you move to
S3 the stored URL just becomes the bucket/CDN URL and this static route goes idle.

## Config

| Env | Default | Notes |
| --- | --- | --- |
| `STORAGE_DRIVER` | `disk` | `disk` or `s3` |
| `UPLOAD_DIR` | `./uploads` (cwd) | Disk backend: write dir. Absolute in prod. |
| `S3_BUCKET` | — | S3 backend: target bucket (required when `s3`). |
| `AWS_REGION` | `us-east-1` | S3 backend: region (and URL construction). |
| `S3_CDN_URL` | — | Public CDN base in front of the bucket (e.g. CloudFront). Falls back to the bucket URL. |
| `S3_KEY_PREFIX` | — | Optional "folder" within the bucket, e.g. `media`. |
| `S3_ENDPOINT` | — | Custom endpoint for S3-compatible stores (R2, MinIO). |
| `S3_FORCE_PATH_STYLE` | `false` | `true` for stores that need path-style URLs (MinIO). |

Credentials come from the standard AWS chain (env vars, shared config, or the
instance/task IAM role) — they are never read or stored by the app directly.

The upload endpoint accepts up to 4 image files (`jpeg/png/webp/gif/svg`), 5 MB each.

## Production

`uploads/` is gitignored. In prod the server writes to `/app/uploads`, which
`docker-compose.yml` backs with a named `uploads` volume so images survive restarts and
redeploys. (If you later switch to S3, drop the volume and set the S3 env.)

## Demo seed

`pnpm --filter server seed:demo` (gated by `DEMO_SEED_CONFIRM=1`) populates a curated,
tasteful dataset for the public site — ~8 real-looking accounts and a couple dozen
handwritten posts with reply threads and likes — so prod doesn't look empty.

- It exercises the **real upload path**: the committed SVG assets in
  `server/prisma/seed/assets/` are pushed through `storage.save`, not hot-linked.
- It is **prod-safe and idempotent**: it never truncates. It owns only the demo
  accounts (by username) and on each run replaces *their* posts/follows/likes, leaving
  all real data untouched.
- Any demo handle logs in with `DEMO_PASSWORD` (default `owldemo123`).

### Running it locally

```
DEMO_SEED_CONFIRM=1 pnpm --filter server seed:demo   # tsx, against .env / dev DB
```

### Running it in prod

The seed compiles to `dist/seed-demo.mjs` (a second `tsdown` entry) so it runs with
plain `node` in the prod image — no `tsx`, and the bundle pulls in `src/storage`. A
one-off `seed-demo` compose service runs it **inside the server container**, sharing the
`uploads` volume and `UPLOAD_DIR=/app/uploads` so seeded media files land where the
server serves them. It's behind the `seed` profile, so it never runs on a normal `up`:

```
docker compose --profile seed run --rm seed-demo
```

Note: re-running orphans the previous run's upload files (new UUIDs each time) —
harmless, but clear the `uploads` volume if you care.
