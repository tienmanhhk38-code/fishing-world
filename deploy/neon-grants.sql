-- Run as the database owner in Neon SQL Editor. Create fishing_app via SQL (not Console/API default roles, which may inherit
-- neon_superuser). Use a strong password privately in SQL Editor, never here.
-- CREATE ROLE fishing_app LOGIN PASSWORD 'your-generated-secret' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT CONNECT ON DATABASE neondb TO fishing_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO fishing_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fishing_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fishing_app;
-- Execute as the SAME owner used by MIGRATION_DATABASE_URL.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fishing_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO fishing_app;
-- After initial migrate deploy, run this once more to protect migration history:
-- REVOKE ALL ON TABLE public._prisma_migrations FROM fishing_app;
