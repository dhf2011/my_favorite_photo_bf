# BE
back-end

## DB connection (MySQL in Docker)

This backend connects to MySQL using `.env`:

- `DB_HOST=127.0.0.1` — host where MySQL is reachable
- `DB_PORT=3307` — host port that forwards to MySQL in Docker

**If you see `ECONNREFUSED 127.0.0.1:3307`:**

1. Start the MySQL container from the **project root** (where `docker-compose.yml` is):
   ```bash
   docker compose up -d db
   ```
   or `docker-compose up -d db`.

2. Confirm the container is running and port 3307 is published:
   ```bash
   docker ps
   ```
   You should see `favorite-db` (or the db service) with `0.0.0.0:3307->3306/tcp`.

3. If the container was started without the compose file, ensure the host port is **3307** (e.g. `-p 3307:3306`).

4. Wait a few seconds after `docker start` — MySQL inside the container may need time to become ready.
