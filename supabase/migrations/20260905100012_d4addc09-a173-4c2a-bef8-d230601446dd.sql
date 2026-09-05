REVOKE EXECUTE ON FUNCTION public.current_business_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_business_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;