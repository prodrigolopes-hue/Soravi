\set ON_ERROR_STOP on

DO $$
BEGIN
  IF to_regclass('public.category_request_resolved_categories') IS NOT NULL THEN
    RAISE EXCEPTION 'Esta fixture deve ser aplicada antes da migration 20261116000100.';
  END IF;
END
$$;

INSERT INTO "users" ("id", "name", "email", "email_normalized", "password_hash", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000101', 'Profissional de backfill', 'backfill@example.invalid', 'backfill@example.invalid', 'migration-validation-only', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "professional_profiles" ("id", "user_id", "display_name", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000101', 'Profissional de backfill', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "categories" ("id", "name", "slug", "is_active", "display_order", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000201', 'Eletricista', 'eletricista-backfill-test', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "category_requests" ("id", "professional_profile_id", "suggested_name", "suggested_name_normalized", "status", "review_notes", "resolved_category_id", "created_at", "updated_at")
VALUES ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000102', 'Eletricista residencial', 'eletricista residencial', 'APPROVED', 'Decisão existente antes da migration.', '00000000-0000-0000-0000-000000000201', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
