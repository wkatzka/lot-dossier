-- Global Cornerpin-only API budget. All amounts are integer millionths of USD.
-- Provision the secret hash separately; never commit an API key or budget credential.
create schema if not exists cornerpin_private;
revoke all on schema cornerpin_private from public, anon, authenticated;
create table if not exists cornerpin_private.ai_budget_auth (singleton boolean primary key default true check(singleton), secret_hash text not null);
create table if not exists cornerpin_private.ai_budget_days (day date primary key, committed bigint not null default 0 check(committed >= 0));
create table if not exists cornerpin_private.ai_budget_calls (id uuid primary key, day date not null references cornerpin_private.ai_budget_days(day), reserved bigint not null, charged bigint, created_at timestamptz not null default now());
create or replace function public.cornerpin_ai_budget(p_secret text, p_action text, p_id uuid, p_amount bigint)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare d date; total bigint; call_row cornerpin_private.ai_budget_calls%rowtype;
begin
 if not exists(select 1 from cornerpin_private.ai_budget_auth where secret_hash = encode(sha256(convert_to(p_secret,'UTF8')),'hex')) then raise exception 'Budget authentication failed'; end if;
 if p_amount is null or p_amount < 0 or p_amount > 5000000 then raise exception 'Invalid budget amount'; end if;
 if p_action = 'reserve' then
  d := (clock_timestamp() at time zone 'America/New_York')::date;
  insert into cornerpin_private.ai_budget_days(day) values(d) on conflict do nothing;
  select committed into total from cornerpin_private.ai_budget_days where day=d for update;
  if exists(select 1 from cornerpin_private.ai_budget_calls where id=p_id) then raise exception 'Duplicate reservation'; end if;
  if total+p_amount > 5000000 then return jsonb_build_object('allowed',false,'day',d,'remainingMicros',5000000-total); end if;
  insert into cornerpin_private.ai_budget_calls(id,day,reserved) values(p_id,d,p_amount);
  update cornerpin_private.ai_budget_days set committed=committed+p_amount where day=d;
  return jsonb_build_object('allowed',true,'day',d);
 elsif p_action = 'settle' then
  select * into call_row from cornerpin_private.ai_budget_calls where id=p_id for update;
  if not found then raise exception 'Unknown reservation'; end if;
  if call_row.charged is not null then return jsonb_build_object('settled',true); end if;
  if p_amount > call_row.reserved then raise exception 'Usage exceeds reservation'; end if;
  update cornerpin_private.ai_budget_days set committed=committed-call_row.reserved+p_amount where day=call_row.day;
  update cornerpin_private.ai_budget_calls set charged=p_amount where id=p_id;
  return jsonb_build_object('settled',true);
 end if;
 raise exception 'Invalid budget operation';
end $$;
revoke all on function public.cornerpin_ai_budget(text,text,uuid,bigint) from public;
grant execute on function public.cornerpin_ai_budget(text,text,uuid,bigint) to anon;
