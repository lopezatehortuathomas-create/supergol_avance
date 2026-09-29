CREATE OR REPLACE FUNCTION public.validate_reservation_times()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.start_time <= clock_timestamp() THEN
      RAISE EXCEPTION 'No se puede reservar una hora que ya pasó';
    END IF;
  ELSIF NEW.start_time IS DISTINCT FROM OLD.start_time
     OR NEW.end_time IS DISTINCT FROM OLD.end_time THEN
    IF NEW.start_time <= clock_timestamp() THEN
      RAISE EXCEPTION 'No se puede reservar una hora que ya pasó';
    END IF;
  END IF;

  IF NEW.status = 'completada' AND NEW.end_time > clock_timestamp() THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'No se puede completar la reserva antes de su hora de finalización';
    ELSIF OLD.status IS DISTINCT FROM 'completada' THEN
      RAISE EXCEPTION 'No se puede completar la reserva antes de su hora de finalización';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_reservation_times ON public.reservations;
CREATE TRIGGER validate_reservation_times
  BEFORE INSERT OR UPDATE OF start_time, end_time, status
  ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_reservation_times();