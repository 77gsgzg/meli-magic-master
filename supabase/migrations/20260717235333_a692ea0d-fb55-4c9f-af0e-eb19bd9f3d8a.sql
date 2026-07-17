
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_locked_order_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.support_tickets_guard() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.revoke_ml_token_for_user(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_order_wallet_debit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.wallet_add_credit(uuid, numeric, text) FROM PUBLIC, anon, authenticated;
