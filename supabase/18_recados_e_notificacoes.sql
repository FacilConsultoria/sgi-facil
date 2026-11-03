-- =====================================================================
-- SGI Fácil Consultoria · 18 · Recados internos e notificações (sino)
-- Rodar depois do 17.
--
-- Recados internos: avisos curtos da liderança para a equipe, para um núcleo ou para uma área.
--   Quem publica: Presidência e Vice-Presidência (toda a equipe, qualquer área ou núcleo),
--   diretoria (a própria área e seus núcleos) e gerência/assessoria (o próprio núcleo).
--   Quem lê: o público do recado, quem o publicou, a Presidência e a diretoria da área a que o recado se refere.
--
-- Notificações (o sino): três tipos, todas só da própria pessoa.
--   atraso      demanda em que a pessoa é executora com prazo vencido e sem conclusão (calculada na hora; some ao concluir)
--   atribuicao  a pessoa foi colocada como executora de uma demanda por outra pessoa (gravada; vira lida ao abrir)
--   recado      um recado interno publicado para ela (gravada; vira lida ao abrir)
-- =====================================================================

create table public.recados (
  id          uuid primary key default gen_random_uuid(),
  autor_id    uuid not null references public.pessoas(id),
  titulo      text not null check (length(trim(titulo)) between 1 and 80),
  texto       text not null check (length(trim(texto)) between 1 and 1000),
  escopo      text not null check (escopo in ('todos','area','nucleo')),
  escopo_id   text,
  criado_em   timestamptz not null default now(),
  retirado_em timestamptz,
  check ((escopo = 'todos') = (escopo_id is null))
);

create table public.notificacoes (
  id         uuid primary key default gen_random_uuid(),
  pessoa_id  uuid not null references public.pessoas(id) on delete cascade,
  tipo       text not null check (tipo in ('atribuicao','recado')),
  demanda_id uuid references public.demandas(id) on delete cascade,
  recado_id  uuid references public.recados(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  lida_em    timestamptz,
  check ((tipo = 'atribuicao' and demanda_id is not null) or (tipo = 'recado' and recado_id is not null))
);
create unique index notificacoes_atribuicao on public.notificacoes (pessoa_id, demanda_id) where tipo = 'atribuicao';
create unique index notificacoes_recado on public.notificacoes (pessoa_id, recado_id) where tipo = 'recado';
create index notificacoes_nao_lidas on public.notificacoes (pessoa_id) where lida_em is null;

-- ---------- regras ----------
-- o recado chega a esta pessoa?
create or replace function privado.recebe_recado(p uuid, p_escopo text, p_escopo_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pessoas x
                  where x.id = p and x.ativo
                    and (p_escopo = 'todos'
                      or (p_escopo = 'area' and x.area_id = p_escopo_id)
                      or (p_escopo = 'nucleo' and x.nucleo_id = p_escopo_id)))
$$;

-- esta pessoa pode publicar um recado para este público?
create or replace function privado.pode_publicar_recado(p uuid, p_escopo text, p_escopo_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and coalesce(case p_escopo
    when 'todos'  then privado.eh_presidencia(p)
    when 'area'   then privado.eh_presidencia(p) or privado.dirige(p, p_escopo_id)
    when 'nucleo' then privado.eh_presidencia(p) or privado.dirige(p, privado.area_do_nucleo(p_escopo_id)) or privado.lidera(p, p_escopo_id)
    else false end, false)
$$;

alter table public.recados enable row level security;
create policy ler on public.recados for select to authenticated
  using (retirado_em is null and (
       autor_id = (select privado.eu())
    or privado.eh_presidencia((select privado.eu()))
    or privado.recebe_recado((select privado.eu()), escopo, escopo_id)
    or privado.dirige((select privado.eu()), case escopo when 'area' then escopo_id when 'nucleo' then privado.area_do_nucleo(escopo_id) end)));

alter table public.notificacoes enable row level security;
create policy ler on public.notificacoes for select to authenticated
  using (pessoa_id = (select privado.eu()));

revoke all on public.recados, public.notificacoes from anon, authenticated;
grant select on public.recados, public.notificacoes to authenticated;

-- ---------- atribuição de demanda gera notificação ----------
-- quem se atribui a si mesma não é avisada; quem já foi avisada dessa demanda não é avisada de novo
create or replace function privado.notificar_atribuicao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.pessoa_id is distinct from privado.eu() then
    insert into public.notificacoes (pessoa_id, tipo, demanda_id) values (new.pessoa_id, 'atribuicao', new.demanda_id)
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger sgi_notificar_atribuicao after insert on public.demanda_executores
  for each row execute function privado.notificar_atribuicao();

-- ---------- operações ----------
create or replace function public.publicar_recado(p_titulo text, p_texto text, p_escopo text, p_escopo_id text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_eu     uuid := privado.exigir_login();
  v_id     uuid;
  v_alvo   text := case when p_escopo = 'todos' then null else nullif(trim(coalesce(p_escopo_id, '')), '') end;
  v_publico text;
begin
  if p_escopo is null or p_escopo not in ('todos','area','nucleo') then raise exception 'Escolha para quem é o recado.'; end if;
  if p_escopo = 'area' and not exists (select 1 from public.areas where id = v_alvo) then raise exception 'Área não encontrada.'; end if;
  if p_escopo = 'nucleo' and not exists (select 1 from public.nucleos where id = v_alvo) then raise exception 'Núcleo não encontrado.'; end if;
  if not privado.pode_publicar_recado(v_eu, p_escopo, v_alvo) then raise exception 'Você não pode enviar recados para este público.'; end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Dê um título ao recado.'; end if;
  if length(trim(p_titulo)) > 80 then raise exception 'O título do recado tem no máximo 80 caracteres.'; end if;
  if length(trim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva o recado.'; end if;
  if length(trim(p_texto)) > 1000 then raise exception 'O recado tem no máximo 1000 caracteres.'; end if;

  insert into public.recados (autor_id, titulo, texto, escopo, escopo_id)
  values (v_eu, trim(p_titulo), trim(p_texto), p_escopo, v_alvo)
  returning id into v_id;

  insert into public.notificacoes (pessoa_id, tipo, recado_id)
  select x.id, 'recado', v_id from public.pessoas x
   where x.ativo and x.id <> v_eu and privado.recebe_recado(x.id, p_escopo, v_alvo);

  v_publico := case p_escopo when 'todos' then 'toda a equipe'
                 when 'area' then (select titulo from public.areas where id = v_alvo)
                 else (select nome from public.nucleos where id = v_alvo) end;
  perform privado.registrar('Publicou recado', trim(p_titulo) || ' · ' || v_publico,
    p_area => case p_escopo when 'area' then v_alvo when 'nucleo' then privado.area_do_nucleo(v_alvo) end);
  return v_id;
end $$;

-- retira o recado de circulação (não apaga: fica no histórico); só quem publicou ou a Presidência
create or replace function public.retirar_recado(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); r public.recados%rowtype;
begin
  select * into r from public.recados where id = p_id and retirado_em is null;
  if not found then raise exception 'Recado não encontrado.'; end if;
  if r.autor_id <> v_eu and not privado.eh_presidencia(v_eu) then raise exception 'Só quem publicou o recado ou a Presidência pode retirá-lo.'; end if;
  update public.recados set retirado_em = now() where id = p_id;
  perform privado.registrar('Retirou recado', r.titulo);
end $$;

-- marca como lidas as notificações da própria pessoa (sem argumento, todas)
create or replace function public.marcar_notificacoes_lidas(p_ids uuid[] default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  update public.notificacoes set lida_em = now()
   where pessoa_id = v_eu and lida_em is null and (p_ids is null or id = any(p_ids));
end $$;

revoke all on function public.publicar_recado(text, text, text, text), public.retirar_recado(uuid),
  public.marcar_notificacoes_lidas(uuid[]) from public, anon;
grant execute on function public.publicar_recado(text, text, text, text), public.retirar_recado(uuid),
  public.marcar_notificacoes_lidas(uuid[]) to authenticated;
revoke all on function privado.recebe_recado(uuid, text, text), privado.pode_publicar_recado(uuid, text, text),
  privado.notificar_atribuicao() from public;
grant execute on function privado.recebe_recado(uuid, text, text), privado.pode_publicar_recado(uuid, text, text) to authenticated;

-- ---------- visões ----------
-- recados que a pessoa pode ler, do mais novo para o mais antigo
create or replace view public.recados_painel with (security_invoker = true) as
select r.id, r.titulo, r.texto, r.escopo, r.escopo_id, r.autor_id, p.nome as autor_nome,
       case r.escopo when 'todos' then 'Toda a equipe'
                     when 'area' then (select a.titulo from public.areas a where a.id = r.escopo_id)
                     else (select n.nome from public.nucleos n where n.id = r.escopo_id) end as publico,
       r.criado_em,
       (r.autor_id = privado.eu() or privado.eh_presidencia(privado.eu())) as pode_retirar
  from public.recados r
  join public.pessoas p on p.id = r.autor_id
 where r.retirado_em is null;

-- para quem a pessoa pode publicar (vazio: não publica recados)
create or replace view public.destinos_de_recado with (security_invoker = true) as
select 'todos'::text as escopo, null::text as escopo_id, 'Toda a equipe'::text as nome, 0 as ordem
 where privado.pode_publicar_recado(privado.eu(), 'todos', null)
union all
select 'area', a.id, a.titulo, 1 from public.areas a where privado.pode_publicar_recado(privado.eu(), 'area', a.id)
union all
select 'nucleo', n.id, n.nome, 2 from public.nucleos n where privado.pode_publicar_recado(privado.eu(), 'nucleo', n.id);

-- o sino: o que a pessoa ainda não viu, mais as demandas dela com prazo vencido
create or replace view public.minhas_notificacoes with (security_invoker = true) as
select n.id::text as chave, n.id, n.tipo, d.titulo as titulo, d.codigo, d.prazo, null::text as autor_nome,
       n.demanda_id, null::uuid as recado_id, n.criado_em as em
  from public.notificacoes n
  join public.demandas d on d.id = n.demanda_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'atribuicao' and d.status <> 'concluida'
   and exists (select 1 from public.demanda_executores e where e.demanda_id = n.demanda_id and e.pessoa_id = n.pessoa_id)
union all
select n.id::text, n.id, n.tipo, r.titulo, null::text, null::date, p.nome,
       null::uuid, n.recado_id, n.criado_em
  from public.notificacoes n
  join public.recados r on r.id = n.recado_id and r.retirado_em is null
  join public.pessoas p on p.id = r.autor_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'recado'
union all
select 'atraso:' || d.id::text, null::uuid, 'atraso', d.titulo, d.codigo, d.prazo, null::text,
       d.id, null::uuid, d.prazo::timestamptz
  from public.demandas d
  join public.demanda_executores e on e.demanda_id = d.id
 where e.pessoa_id = privado.eu() and d.status <> 'concluida' and d.prazo < privado.hoje();

revoke all on public.recados_painel, public.destinos_de_recado, public.minhas_notificacoes from anon;
revoke insert, update, delete, truncate on public.recados_painel, public.destinos_de_recado, public.minhas_notificacoes from authenticated;
grant select on public.recados_painel, public.destinos_de_recado, public.minhas_notificacoes to authenticated;
