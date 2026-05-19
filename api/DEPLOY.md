# Deploying the Krabsy analytics backend on Coolify

The backend is a small FastAPI app that lives in this `/api/` subdirectory
and is deployed as a **separate Coolify application** from the static site.
Both apps point at the same GitHub repo; Coolify just builds different
paths.

Recommended routing: subdomain (`api.krabsy.com`). Cleaner, easier to
debug, scales independently of the static site. The alternative of
reverse-proxying `/api/*` and `/dashboard/*` through the static site's
nginx is documented at the bottom for completeness, but is not the
recommended path.

---

## 1. DNS

At the domain registrar (or wherever Krabsy's DNS is hosted), add:

```
Type: A
Name: api
Value: <Coolify server's public IP>
TTL:  300 (or default)
```

Wait until `dig +short api.krabsy.com` returns the right IP before moving
on. Usually under five minutes; can be longer.

## 2. Create the Coolify application

In Coolify:

1. **+ New Resource → Application**
2. Source: the same GitHub repo as the main site (`krabsy-homepage`)
3. Branch: `main`
4. **Build pack: Dockerfile**
5. **Base directory: `/api`** (so Coolify builds from this subfolder)
6. **Dockerfile location: `/api/Dockerfile`**
7. Port: `8000`
8. Domain: `https://api.krabsy.com` (Coolify auto-provisions Let's
   Encrypt; make sure DNS from step 1 has propagated first)

## 3. Environment variables

Set in Coolify's "Environment Variables" panel (not committed to git):

| Key                  | Value                                            |
|----------------------|--------------------------------------------------|
| `DASHBOARD_USERNAME` | Pick a username (e.g. `jan`)                     |
| `DASHBOARD_PASSWORD` | A long random password — generate with `openssl rand -base64 24` |
| `GEOIP_DB_PATH`      | `/data/GeoLite2-Country.mmdb`                    |

## 4. Persistent volume

Add a Coolify volume:

- **Source**: a named volume, e.g. `krabsy-analytics-data`
- **Destination (container path)**: `/data`

This is where `events.jsonl` will accumulate and where the GeoIP DB lives.
Volumes survive redeploys; container filesystems do not.

## 5. (Optional, recommended) GeoIP database

Without this, every event's `country` field is `"unknown"` — events are
still recorded, the dashboard just can't show the country breakdown.

1. Register a free MaxMind account: <https://www.maxmind.com/en/geolite2/signup>
2. From the MaxMind account dashboard, download `GeoLite2-Country.mmdb`
   (binary `.mmdb` format, not CSV)
3. Upload the file into the Coolify volume at `/data/GeoLite2-Country.mmdb`.
   In Coolify this is usually done via "Terminal" on the running container
   plus a `wget` from a temporary URL, or by `docker cp` on the host:

   ```sh
   docker cp GeoLite2-Country.mmdb <container-name>:/data/GeoLite2-Country.mmdb
   ```

4. Restart the container so it picks up the file. The startup log should
   say `GeoIP DB loaded from /data/GeoLite2-Country.mmdb`.

MaxMind's terms require periodic updates (the database changes monthly).
Re-uploading once a quarter is plenty for our purposes.

## 6. Verify

After the first deploy completes:

```sh
# Health check
curl https://api.krabsy.com/healthz
# → {"ok":true}

# Send a test event
curl -X POST https://api.krabsy.com/api/track \
  -H "Content-Type: application/json" \
  -d '{"path":"/test","timestamp":"2026-05-19T20:00:00Z","viewport_width":1280,"language":"en"}'
# → {"ok":true}

# View the dashboard
open https://api.krabsy.com/dashboard/
# Browser prompts for basic auth; use the credentials from step 3.
# The /test event should appear under "Page views by path".
```

## 7. Flip the client tracker live

The tracker in `lib/krabsy-analytics.js` already points at
`https://api.krabsy.com/api/track` with `SHOULD_POST = true`. As soon as
the static site is redeployed (after merging the related PR), real browser
events will start flowing.

If something looks wrong, set `window.KRABSY_ANALYTICS_DISABLED = true` in
the static site's HTML to kill the tracker without redeploying the backend.

---

## Operations notes

**Backup the data file.** `events.jsonl` accumulates inside the Coolify
volume. To grab a snapshot:

```sh
docker exec <container-name> cat /data/events.jsonl > backup-$(date +%F).jsonl
```

**Check the raw feed.** `GET https://api.krabsy.com/dashboard/raw` returns
the last 1000 events as JSON (same basic auth).

**Outgrowing JSONL.** At ~100k lines the dashboard will start to feel
sluggish (each request scans the whole file). When that happens, migrate
to SQLite with a one-time `import-jsonl-into-sqlite.py` script.

**Forgot the dashboard password.** Update `DASHBOARD_PASSWORD` in Coolify
and redeploy. No data is lost — credentials are not stored in the volume.

---

## Alternative routing: same domain (not recommended)

If you ever want `https://krabsy.com/api/track` and
`https://krabsy.com/dashboard/` instead of the subdomain, the static
site's Coolify nginx config has to reverse-proxy those two paths to the
Python container. This requires:

1. Both apps on the same Coolify Docker network
2. A custom `nginx.conf` override on the static site that adds
   `location /api/ { proxy_pass http://krabsy-analytics:8000; }` and the
   same for `/dashboard/`
3. CORS in `main.py` becomes irrelevant (same-origin)
4. The tracker `ENDPOINT` flips back to the relative `/api/track`

It works but adds a moving part to the static site's deployment. Stick
with the subdomain unless there's a concrete reason to switch.
