-- Card 136: the Supabase security advisor on the remote project (06-11-2026).
--
-- 1. Trigger functions that run as their owner (security definer) were executable by everyone, so
--    PostgREST exposed them at /rest/v1/rpc. They are only meant to run as triggers, and Postgres does
--    not check EXECUTE when a trigger fires, so nobody needs the privilege. These are all the security
--    definer trigger functions of the repo (checked in pg_proc on 07-11-2026); `rls_auto_enable`, the
--    function of the `ensure_rls` event trigger, is not here: the Supabase platform created it on the
--    remote project and it is not part of these migrations.

revoke execute on function public.weight_logs_check_date() from public, anon, authenticated;
revoke execute on function public.weight_logs_guard_delete() from public, anon, authenticated;
revoke execute on function public.questionnaire_responses_flag_question() from public, anon, authenticated;
revoke execute on function public.review_measurements_flag_type() from public, anon, authenticated;

-- 2. `menu_reads` stays a view that runs as its owner, on purpose (card 123, E12). It has to hide four
--    columns of `menus` from a client whose macros_visible is false, and RLS filters rows, not
--    columns: with security_invoker the client would need SELECT on those columns, which is what E12
--    takes away. So the view skips the RLS of `menus` and `clients`, and its own `where` is the row
--    filter: the same two conditions as menus_trainer_select and menus_client_select (trainer, their
--    own menus; active client, their own active menus). security_barrier keeps a caller's predicates
--    from running before that filter. supabase/tests/menu_macros_hidden.test.sql checks who stays out:
--    another trainer, another client of the same trainer, the client's drafts and archived menus, a
--    client dado de baja and a signed-out user.

comment on view public.menu_reads is
  'Runs as its owner on purpose (card 123, E12): hides the menu macros from a client with macros_visible false. Its where repeats the RLS of menus; see 20261103120300_menu_macros_hidden.sql and 20261107120000_security_advisors.sql.';

-- 3. `trainer_payment_accounts` has RLS and no policies on purpose (card 125): nobody signed in reads
--    or writes it. It is read only by online_payment_status() and record_online_payment(), which run
--    as their owner, and by the Stripe Edge Functions with the service role.

comment on table public.trainer_payment_accounts is
  'RLS without policies on purpose (card 125): read only by online_payment_status(), record_online_payment() and the Stripe Edge Functions with the service role.';
