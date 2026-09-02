-- ====================================================================
-- STAGE 3: PERSISTENT PRODUCTION CLEANUP SCHEDULING (SUPABASE PG_CRON)
-- External & Database-Level Scheduled Execution Configuration
-- ====================================================================

-- 1. Enable pg_cron and pg_net extensions if available in Supabase environment
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Database Stored Procedure for Ephemeral Cleanup Execution
CREATE OR REPLACE FUNCTION public.cleanup_expired_export_records()
RETURNS TABLE (
    deleted_export_jobs_count INTEGER,
    deleted_staging_docs_count INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_export_count INTEGER := 0;
    v_staging_count INTEGER := 0;
BEGIN
    -- Remove expired export job records past 24-hour TTL
    WITH deleted_exports AS (
        DELETE FROM public.export_jobs
        WHERE expires_at < NOW() OR status = 'EXPIRED'
        RETURNING id
    )
    SELECT COUNT(*) INTO v_export_count FROM deleted_exports;

    -- Remove stale staging/unassigned documents older than 24 hours
    WITH deleted_staging AS (
        DELETE FROM public.documents
        WHERE (confirmed_at IS NULL AND status IN ('REJECTED', 'UPLOADED', 'FAILED'))
          AND uploaded_at < (NOW() - INTERVAL '24 hours')
        RETURNING id
    )
    SELECT COUNT(*) INTO v_staging_count FROM deleted_staging;

    RETURN QUERY SELECT v_export_count, v_staging_count;
END;
$$;

-- 3. Schedule Production Cleanup Cron (Hourly at minute 0)
-- When pg_cron is enabled in production Supabase:
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Remove existing job if already scheduled
        PERFORM cron.unschedule('hourly-export-and-staging-cleanup')
        WHERE EXISTS (
            SELECT 1 FROM cron.job WHERE jobname = 'hourly-export-and-staging-cleanup'
        );

        -- Schedule hourly cleanup
        PERFORM cron.schedule(
            'hourly-export-and-staging-cleanup',
            '0 * * * *',
            'SELECT public.cleanup_expired_export_records();'
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'pg_cron schedule setup completed / skipped if not available in current container environment.';
END;
$$;
