-- Run once in the Supabase SQL Editor to cancel expired pending reservations.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job RECORD;
BEGIN
  FOR existing_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cancel-expired-pending-reservations'
  LOOP
    PERFORM cron.unschedule(existing_job.jobid);
  END LOOP;

  PERFORM cron.schedule(
    'cancel-expired-pending-reservations',
    '* * * * *',
    $job$
      UPDATE public.reservations
      SET status = 'cancelada'
      WHERE status = 'pendiente'
        AND end_time <= now();
    $job$
  );
END;
$$;
