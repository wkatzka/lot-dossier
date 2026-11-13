-- Private, leased jobs; public clients never read or write checkpoints directly.
create schema if not exists cornerpin_private;
revoke all on schema cornerpin_private from public, anon, authenticated;
create table if not exists cornerpin_private.research_config(singleton boolean primary key default true check(singleton), dispatch_secret text not null, worker_url text not null);
create table if not exists cornerpin_private.research_jobs(
 id uuid primary key default gen_random_uuid(), county text not null, parcel_id text not null,
 status text not null default 'queued', phase text not null default 'discover',
 checkpoint jsonb not null default '{}'::jsonb, result jsonb not null default '{}'::jsonb,
 lease uuid, lease_until timestamptz, attempts integer not null default 0,
 available_at timestamptz not null default now(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(county,parcel_id), check(county='Weber'), check(parcel_id ~ '^[0-9]{9}$')
);
create table if not exists cornerpin_private.research_readings(
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), reader_version integer not null,
 reading jsonb not null, updated_at timestamptz not null default now(), primary key(sha256,reader_version)
);
revoke all on all tables in schema cornerpin_private from public, anon, authenticated;
create or replace function public.cornerpin_research(p_secret text,p_action text,p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='15s' as $$
declare j cornerpin_private.research_jobs%rowtype; total integer;
begin
 if not exists(select 1 from cornerpin_private.ai_budget_auth where secret_hash=encode(sha256(convert_to(p_secret,'UTF8')),'hex')) then raise exception 'Research authentication failed'; end if;
 if p_action='reading_get' then
  return (select reading from cornerpin_private.research_readings where sha256=p_payload->>'sha256' and reader_version=(p_payload->>'version')::integer);
 elsif p_action='reading_put' then
  if pg_column_size(p_payload->'reading')>10000000 or jsonb_typeof(p_payload->'reading'->'pages')<>'array' then raise exception 'Invalid public reading cache'; end if;
  insert into cornerpin_private.research_readings(sha256,reader_version,reading) values(p_payload->>'sha256',(p_payload->>'version')::integer,p_payload->'reading') on conflict(sha256,reader_version) do update set reading=excluded.reading,updated_at=now();
  return jsonb_build_object('saved',true);
 elsif p_action='authorize_dispatch' then
  return jsonb_build_object('allowed',exists(select 1 from cornerpin_private.research_config where dispatch_secret=p_payload->>'token'));
 elsif p_action='enqueue' then
  perform pg_advisory_xact_lock(786223110);
  select * into j from cornerpin_private.research_jobs where county=p_payload->>'county' and parcel_id=p_payload->>'parcelId';
  if not found then
   select count(*) into total from cornerpin_private.research_jobs where created_at>now()-interval '1 day';
   if total>=20 then return jsonb_build_object('limited',true,'message','Daily research intake is full; try again tomorrow.'); end if;
   insert into cornerpin_private.research_jobs(county,parcel_id,checkpoint) values(p_payload->>'county',p_payload->>'parcelId',p_payload->'checkpoint') returning * into j;
  end if;
  return jsonb_build_object('id',j.id,'status',j.status,'phase',j.phase,'createdAt',j.created_at,'updatedAt',j.updated_at,'result',j.result);
 elsif p_action='status' then
  select * into j from cornerpin_private.research_jobs where county=p_payload->>'county' and parcel_id=p_payload->>'parcelId';
  if not found then return null; end if;
  return jsonb_build_object('id',j.id,'county',j.county,'parcelId',j.parcel_id,'status',j.status,'phase',j.phase,'createdAt',j.created_at,'updatedAt',j.updated_at,'result',j.result);
 elsif p_action='claim' then
  select * into j from cornerpin_private.research_jobs where status in ('queued','running','retry_wait') and available_at<=now() and (lease_until is null or lease_until<now()) order by updated_at for update skip locked limit 1;
  if not found then return null; end if;
  update cornerpin_private.research_jobs set status='running',lease=gen_random_uuid(),lease_until=now()+interval '6 minutes',attempts=attempts+1,updated_at=now() where id=j.id returning * into j;
  return to_jsonb(j);
 elsif p_action='progress' then
  if pg_column_size(p_payload->'checkpoint')>12000000 then raise exception 'Research checkpoint too large'; end if;
  update cornerpin_private.research_jobs set checkpoint=p_payload->'checkpoint',phase=p_payload->>'phase',updated_at=now()
   where id=(p_payload->>'id')::uuid and lease=(p_payload->>'lease')::uuid and lease_until>now() returning id,status into j.id,j.status;
  if not found then raise exception 'Research lease expired'; end if;
  return jsonb_build_object('saved',true);
 elsif p_action='save' then
  if pg_column_size(p_payload)>12000000 then raise exception 'Research checkpoint too large'; end if;
  update cornerpin_private.research_jobs set checkpoint=p_payload->'checkpoint',result=p_payload->'result',phase=p_payload->>'phase',status=p_payload->>'status',lease=null,lease_until=null,available_at=now()+make_interval(secs=>least(86400,greatest(0,coalesce((p_payload->>'delaySeconds')::integer,0)))),updated_at=now()
   where id=(p_payload->>'id')::uuid and lease=(p_payload->>'lease')::uuid and lease_until>now() returning id,status into j.id,j.status;
  if not found then raise exception 'Research lease expired'; end if;
  return jsonb_build_object('saved',true,'status',j.status);
 elsif p_action='set_permits' then
  -- Record the user's planned permits. If the approvals answer is already finished, retire it to
  -- history and request a synthesis-only regeneration for those permits (no re-crawl or re-reading).
  -- Never while a worker holds the lease; at most one regeneration per 15 minutes; daily AI cap still applies.
  select * into j from cornerpin_private.research_jobs where county=p_payload->>'county' and parcel_id=p_payload->>'parcelId' for update;
  if not found then return null; end if;
  if jsonb_typeof(p_payload->'plannedPermits'->'typeIds')<>'array' or jsonb_array_length(p_payload->'plannedPermits'->'typeIds')>6 then raise exception 'Invalid planned permits'; end if;
  if j.checkpoint->'plannedPermits'->'typeIds' = p_payload->'plannedPermits'->'typeIds' then return jsonb_build_object('id',j.id,'unchanged',true); end if;
  if j.lease_until is not null and j.lease_until>now() then return jsonb_build_object('id',j.id,'busy',true); end if;
  if j.status='complete_with_gaps' and jsonb_typeof(j.checkpoint->'synthesis')='object'
     and coalesce((j.checkpoint->'synthesisRegeneration'->>'pending')::boolean,false)=false
     and coalesce((select max((e->>'retiredAt')::timestamptz) from jsonb_array_elements(coalesce(j.checkpoint->'synthesisHistory','[]'::jsonb)) e),'-infinity'::timestamptz)<now()-interval '15 minutes' then
   update cornerpin_private.research_jobs set checkpoint=jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(checkpoint,'{plannedPermits}',p_payload->'plannedPermits'),
     '{synthesisHistory}',coalesce(checkpoint->'synthesisHistory','[]'::jsonb)||jsonb_build_array(jsonb_build_object('synthesis',checkpoint->'synthesis','retiredAt',now(),'reason','Planned permits changed; permit-specific answer requested'))),
     '{synthesis}','null'::jsonb),'{synthesisAttempts}','0'::jsonb),
     '{synthesisRegeneration}',jsonb_build_object('pending',true,'requestedAt',now(),'scope','final synthesis only; planned permits changed','reason','Permit-specific approvals answer')),
     status='queued',phase='synthesis_regeneration',available_at=now(),updated_at=now() where id=j.id;
   return jsonb_build_object('id',j.id,'regenerating',true);
  end if;
  update cornerpin_private.research_jobs set checkpoint=jsonb_set(checkpoint,'{plannedPermits}',p_payload->'plannedPermits'),updated_at=now() where id=j.id;
  return jsonb_build_object('id',j.id,'recorded',true);
 end if;
 raise exception 'Unknown research operation';
end $$;
revoke all on function public.cornerpin_research(text,text,jsonb) from public;
grant execute on function public.cornerpin_research(text,text,jsonb) to anon;
create extension if not exists pg_cron;
create extension if not exists pg_net;
create or replace function cornerpin_private.dispatch_research() returns void language plpgsql security definer set search_path=pg_catalog as $$
declare c cornerpin_private.research_config%rowtype;
begin
 if exists(select 1 from cornerpin_private.research_jobs where status in ('queued','running','retry_wait') and available_at<=now() and (lease_until is null or lease_until<now())) then
  select * into c from cornerpin_private.research_config where singleton;
  perform net.http_post(url:=c.worker_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||c.dispatch_secret),body:='{}'::jsonb,timeout_milliseconds:=290000);
 end if;
end $$;
revoke all on function cornerpin_private.dispatch_research() from public,anon,authenticated;
select cron.schedule('cornerpin-automatic-investigations','* * * * *','select cornerpin_private.dispatch_research()');
