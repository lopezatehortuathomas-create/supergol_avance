-- Ejecutar una sola vez en Supabase SQL Editor.
-- Permite al usuario actualizar sus reservas pendientes y cancelarlas desde "Mis Reservas".

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      COALESCE(
        auth.jwt() -> 'app_metadata' ->> 'user_role',
        auth.jwt() -> 'app_metadata' ->> 'role',
        auth.jwt() -> 'app_metadata' ->> 'userRole'
      ) IN ('admin', 'superadmin')
      OR EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('admin', 'superadmin')
      )
    ),
    false
  );
$$;

DROP POLICY IF EXISTS reservations_update_own ON public.reservations;
CREATE POLICY reservations_update_own ON public.reservations
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pendiente')
  WITH CHECK (user_id = auth.uid() AND status IN ('pendiente', 'cancelada'));

DROP POLICY IF EXISTS reservations_delete_own ON public.reservations;
CREATE POLICY reservations_delete_own ON public.reservations
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.delete_my_reservation(p_reservation_id integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.reservations
  WHERE id = p_reservation_id
    AND user_id = auth.uid();
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_reservation(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_reservation(integer) TO authenticated;