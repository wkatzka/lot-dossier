-- Synthetic transaction only. All users, rows and object metadata are rolled back.
begin;
insert into auth.users(id) values ('c0100000-0000-4000-8000-000000000001'),('c0100000-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','c0100000-0000-4000-8000-000000000001',true);
insert into public.cornerpin_projects(id,revision,record) values ('cp-rls-test',1,'{"id":"cp-rls-test","revision":1,"schemaVersion":1}');
insert into storage.objects(bucket_id,name) values ('cornerpin-private','c0100000-0000-4000-8000-000000000001/test/hash');
do $$ begin
 if (select count(*) from public.cornerpin_projects where id='cp-rls-test')<>1 then raise exception 'Owner cannot read own project';end if;
 if (select count(*) from storage.objects where bucket_id='cornerpin-private')<>1 then raise exception 'Owner cannot read own file';end if;
end $$;
select set_config('request.jwt.claim.sub','c0100000-0000-4000-8000-000000000002',true);
do $$ declare changed integer; begin
 if exists(select 1 from public.cornerpin_projects where id='cp-rls-test') then raise exception 'Other user can read project';end if;
 if exists(select 1 from storage.objects where bucket_id='cornerpin-private') then raise exception 'Other user can read file';end if;
 update public.cornerpin_projects set revision=2,record='{"id":"cp-rls-test","revision":2}' where id='cp-rls-test';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Other user can update project';end if;
 begin
 insert into public.cornerpin_projects(id,owner_id,revision,record) values('cp-forged','c0100000-0000-4000-8000-000000000001',1,'{"id":"cp-forged","revision":1}');
 raise exception 'Forged owner insert accepted';
 exception when insufficient_privilege then null;end;
 begin
 insert into storage.objects(bucket_id,name) values ('cornerpin-private','c0100000-0000-4000-8000-000000000001/forged/hash');
 raise exception 'Other user can upload to owner folder';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','c0100000-0000-4000-8000-000000000001',true);
do $$ declare changed integer; begin
 update storage.objects set name='changed' where bucket_id='cornerpin-private';get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Immutable file can be overwritten';end if;
 update public.cornerpin_projects set revision=2,record='{"id":"cp-rls-test","revision":2}' where id='cp-rls-test' and revision=0;get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Stale revision accepted';end if;
 update public.cornerpin_projects set revision=2,record='{"id":"cp-rls-test","revision":2}' where id='cp-rls-test' and revision=1;get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Current owner revision update failed';end if;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin
 perform * from public.cornerpin_projects;
 raise exception 'Anonymous project access allowed';
 exception when insufficient_privilege then null;end;
 if exists(select 1 from storage.objects where bucket_id='cornerpin-private') then raise exception 'Anonymous file access allowed';end if;
end $$;
reset role;
select 'PASS: owner access, cross-user isolation, forged owners, private file paths, immutable files, stale revisions and anonymous denial' as verification;
rollback;
