# FastAPI AI Scheduler

## Database configuration

- Set the `DATABASE_URL` environment variable to point to a reachable PostgreSQL instance for production use, e.g. `postgresql://user:password@hostname:5432/dbname`.
- If `DATABASE_URL` is not provided, the application falls back to a local SQLite database at `sqlite:///./local.db`, which is suitable for quick local development.
- Ensure the configured database is accessible before starting the service; the application now checks connectivity and provides clearer errors during startup if the database cannot be reached or tables cannot be created.
