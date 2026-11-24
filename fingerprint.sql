-- Amatu Fingerprint: daily limit + opt-out list. Search terms are never stored.
-- Apply: supabase db query --linked --project-ref ieyqxmzztoxgpvwexbkj -f fingerprint.sql  (run inside deploy-portal/)
create table if not exists public.fp_count (
  username text not null,
  day date not null default current_date,
  n int not null default 0,
  primary key (username, day)
);
create table if not exists public.fp_optout (
  hash text primary key,
  username text not null,
  created_at timestamptz not null default now()
);
alter table public.fp_count enable row level security;
alter table public.fp_optout enable row level security;
revoke all on public.fp_count, public.fp_optout from anon, authenticated;

-- One search: session, opt-out, 150 searches per account per day.
create or replace function public.fp_use(p_token text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare who text; c int;
begin
  begin
    who := amt_sess(p_token, false);
  exception when others then
    return jsonb_build_object('error', 'Silakan masuk ke Portal AMATU dulu.', 'status', 401);
  end;
  if exists (select 1 from fp_optout where hash = p_hash) then
    return jsonb_build_object('optout', true);
  end if;
  insert into fp_count(username, day, n) values (who, current_date, 1)
    on conflict (username, day) do update set n = fp_count.n + 1 returning n into c;
  delete from fp_count where day < current_date - 7;
  if c > 150 then
    return jsonb_build_object('error', 'Batas 150 pencarian per hari tercapai.', 'status', 429);
  end if;
  return jsonb_build_object('ok', true, 'left', 150 - c);
end $$;

-- Opt out: only a SHA-256 of "kind:value" is kept; at most 10 per account per day.
create or replace function public.fp_optout(p_token text, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare who text;
begin
  begin
    who := amt_sess(p_token, false);
  exception when others then
    return jsonb_build_object('error', 'Silakan masuk ke Portal AMATU dulu.');
  end;
  if p_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('error', 'Data tidak valid.'); end if;
  if (select count(*) from fp_optout o where o.username = who and o.created_at > now() - interval '1 day') >= 10 then
    return jsonb_build_object('error', 'Batas 10 permintaan per hari tercapai.');
  end if;
  insert into fp_optout(hash, username) values (p_hash, who) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.fp_use(text, text), public.fp_optout(text, text) from public;
grant execute on function public.fp_use(text, text), public.fp_optout(text, text) to anon, authenticated;
