CREATE TABLE IF NOT EXISTS public.reservation_history (
  id INT PRIMARY KEY,
  user_id UUID,
  space_id INT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  space_name TEXT,
  space_type TEXT,
  user_name TEXT,
  user_phone TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'reservations'
      AND column_name = 'archived_at'
  ) THEN
    INSERT INTO public.reservation_history (
      id, user_id, space_id, start_time, end_time, status, notes,
      space_name, space_type, user_name, user_phone, archived_at
    )
    SELECT
      r.id, r.user_id, r.space_id, r.start_time, r.end_time, r.status, r.notes,
      s.name, s.type, p.full_name, p.phone, r.archived_at
    FROM public.reservations r
    LEFT JOIN public.spaces s ON s.id = r.space_id
    LEFT JOIN public.profiles p ON p.id = r.user_id
    WHERE r.archived_at IS NOT NULL
    ON CONFLICT (id) DO NOTHING;

    DELETE FROM public.reservations WHERE archived_at IS NOT NULL;
    ALTER TABLE public.reservations DROP COLUMN archived_at;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reservation_history_start_time
  ON public.reservation_history (start_time DESC);

ALTER TABLE public.reservation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reservation_history_select_admin ON public.reservation_history;
CREATE POLICY reservation_history_select_admin ON public.reservation_history
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.archive_and_delete_reservation(p_reservation_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete reservations from management' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.reservation_history (
    id, user_id, space_id, start_time, end_time, status, notes,
    space_name, space_type, user_name, user_phone
  )
  SELECT
    r.id, r.user_id, r.space_id, r.start_time, r.end_time, r.status, r.notes,
    s.name, s.type, p.full_name, p.phone
  FROM public.reservations r
  LEFT JOIN public.spaces s ON s.id = r.space_id
  LEFT JOIN public.profiles p ON p.id = r.user_id
  WHERE r.id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  DELETE FROM public.reservations WHERE id = p_reservation_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.archive_and_delete_reservation(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_and_delete_reservation(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_reservation_history_entry(p_reservation_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete reservation history' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.reservation_history WHERE id = p_reservation_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_reservation_history_entry(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_reservation_history_entry(integer) TO authenticated;

NOTIFY pgrst, 'reload schema';
