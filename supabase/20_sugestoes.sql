-- =====================================================================
-- SGI Fácil Consultoria · 20 · Sugestões (melhorias, bugs e ideias para o SGI)
-- Rodar depois do 19.
--
-- Qualquer pessoa ativa envia sugestões, lê todas, apoia as dos outros e comenta.
-- A Presidência (Presidente, Vice e Assessoria) responde: muda a situação (aberta, em análise,
-- planejada, feita, recusada) e escreve uma resposta.
-- Quem sugeriu é avisado no sino quando a sugestão recebe resposta ou comentário de outra pessoa.
-- =====================================================================

create table public.sugestoes (
  id             uuid primary key default gen_random_uuid(),
  autor_id       uuid not null references public.pessoas(id),
  tipo           text not null check (tipo in ('melhoria','bug','outro')),
  titulo         text not null check (length(trim(titulo)) between 1 and 120),
  descricao      text not null check (length(trim(descricao)) between 1 and 2000),
  situacao       text not null default 'aberta' check (situacao in ('aberta','em_analise','planejada','feita','recusada')),
  resposta       text check (resposta is null or length(resposta) <= 1000),
  respondido_por uuid references public.pessoas(id),
  respondido_em  timestamptz,
  criado_em      timestamptz not null default now()
);

create table public.sugestao_apoios (
  sugestao_id uuid not null references public.sugestoes(id) on delete cascade,
  pessoa_id   uuid not null references public.pessoas(id),
  criado_em   timestamptz not null default now(),
  primary key (sugestao_id, pessoa_id)
);

create table public.sugestao_comentarios (
  id          uuid primary key default gen_random_uuid(),
  sugestao_id uuid not null references public.sugestoes(id) on delete cascade,
  autor_id    uuid not null references public.pessoas(id),
  texto       text not null check (length(trim(texto)) between 1 and 1000),
  criado_em   timestamptz not null default now()
);
create index sugestao_comentarios_por_sugestao on public.sugestao_comentarios (sugestao_id, criado_em);

alter table public.sugestoes enable row level security;
alter table public.sugestao_apoios enable row level security;
alter table public.sugestao_comentarios enable row level security;
create policy ler on public.sugestoes            for select to authenticated using ((select privado.eu()) is not null);
create policy ler on public.sugestao_apoios      for select to authenticated using ((select privado.eu()) is not null);
create policy ler on public.sugestao_comentarios for select to authenticated using ((select privado.eu()) is not null);

revoke all on public.sugestoes, public.sugestao_apoios, public.sugestao_comentarios from anon, authenticated;
grant select on public.sugestoes, public.sugestao_apoios, public.sugestao_comentarios to authenticated;

-- ---------- o sino ganha o tipo "sugestao" ----------
alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_check,
  drop constraint if exists notificacoes_check,
  add column sugestao_id uuid references public.sugestoes(id) on delete cascade,
  add column detalhe text;
alter table public.notificacoes
  add constraint notificacoes_tipo_check check (tipo in ('atribuicao','recado','sugestao')),
  add constraint notificacoes_referencia_check check (
       (tipo = 'atribuicao' and demanda_id is not null)
    or (tipo = 'recado' and recado_id is not null)
    or (tipo = 'sugestao' and sugestao_id is not null));

create or replace function privado.nome_situacao_sugestao(p text) returns text
language sql immutable as $$
  select case p when 'aberta' then 'Aberta' when 'em_analise' then 'Em análise' when 'planejada' then 'Planejada'
                when 'feita' then 'Feita' when 'recusada' then 'Recusada' else p end
$$;

-- um aviso por sugestão: o mais novo substitui o anterior ainda não lido
create or replace function privado.notificar_sugestao(p_sugestao uuid, p_detalhe text) returns void
language plpgsql security definer set search_path = public as $$
declare v_autor uuid := (select autor_id from public.sugestoes where id = p_sugestao);
begin
  if v_autor is null or v_autor = privado.eu() then return; end if;
  delete from public.notificacoes
   where pessoa_id = v_autor and tipo = 'sugestao' and sugestao_id = p_sugestao and lida_em is null;
  insert into public.notificacoes (pessoa_id, tipo, sugestao_id, detalhe) values (v_autor, 'sugestao', p_sugestao, p_detalhe);
end $$;

-- ---------- operações ----------
create or replace function public.criar_sugestao(p_tipo text, p_titulo text, p_descricao text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid;
begin
  if p_tipo is null or p_tipo not in ('melhoria','bug','outro') then raise exception 'Escolha o tipo da sugestão.'; end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Dê um título à sugestão.'; end if;
  if length(trim(p_titulo)) > 120 then raise exception 'O título tem no máximo 120 caracteres.'; end if;
  if length(trim(coalesce(p_descricao, ''))) = 0 then raise exception 'Descreva a sugestão.'; end if;
  if length(trim(p_descricao)) > 2000 then raise exception 'A descrição tem no máximo 2000 caracteres.'; end if;
  insert into public.sugestoes (autor_id, tipo, titulo, descricao) values (v_eu, p_tipo, trim(p_titulo), trim(p_descricao))
  returning id into v_id;
  perform privado.registrar('Enviou sugestão', trim(p_titulo));
  return v_id;
end $$;

-- apoia ou tira o apoio; devolve se ficou apoiando
create or replace function public.apoiar_sugestao(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_autor uuid;
begin
  select autor_id into v_autor from public.sugestoes where id = p_id;
  if v_autor is null then raise exception 'Sugestão não encontrada.'; end if;
  if v_autor = v_eu then raise exception 'Quem sugeriu não apoia a própria sugestão.'; end if;
  delete from public.sugestao_apoios where sugestao_id = p_id and pessoa_id = v_eu;
  if found then return false; end if;
  insert into public.sugestao_apoios (sugestao_id, pessoa_id) values (p_id, v_eu);
  return true;
end $$;

create or replace function public.comentar_sugestao(p_id uuid, p_texto text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid;
begin
  if not exists (select 1 from public.sugestoes where id = p_id) then raise exception 'Sugestão não encontrada.'; end if;
  if length(trim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva o comentário.'; end if;
  if length(trim(p_texto)) > 1000 then raise exception 'O comentário tem no máximo 1000 caracteres.'; end if;
  insert into public.sugestao_comentarios (sugestao_id, autor_id, texto) values (p_id, v_eu, trim(p_texto)) returning id into v_id;
  perform privado.notificar_sugestao(p_id, 'Novo comentário de ' || (select nome from public.pessoas where id = v_eu));
  return v_id;
end $$;

-- Presidência: muda a situação e responde (resposta opcional; vazia apaga a anterior)
create or replace function public.responder_sugestao(p_id uuid, p_situacao text, p_resposta text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); s public.sugestoes%rowtype; v_resposta text := nullif(trim(coalesce(p_resposta, '')), '');
begin
  if not privado.eh_presidencia(v_eu) then raise exception 'Só a Presidência responde às sugestões.'; end if;
  select * into s from public.sugestoes where id = p_id for update;
  if not found then raise exception 'Sugestão não encontrada.'; end if;
  if p_situacao is null or p_situacao not in ('aberta','em_analise','planejada','feita','recusada') then
    raise exception 'Escolha a situação.';
  end if;
  if length(coalesce(v_resposta, '')) > 1000 then raise exception 'A resposta tem no máximo 1000 caracteres.'; end if;
  update public.sugestoes set situacao = p_situacao, resposta = v_resposta, respondido_por = v_eu, respondido_em = now() where id = p_id;
  perform privado.notificar_sugestao(p_id, 'Situação: ' || privado.nome_situacao_sugestao(p_situacao));
  perform privado.registrar('Respondeu sugestão', s.titulo || ' · ' || privado.nome_situacao_sugestao(p_situacao));
end $$;

revoke all on function public.criar_sugestao(text, text, text), public.apoiar_sugestao(uuid), public.comentar_sugestao(uuid, text),
  public.responder_sugestao(uuid, text, text) from public, anon;
grant execute on function public.criar_sugestao(text, text, text), public.apoiar_sugestao(uuid), public.comentar_sugestao(uuid, text),
  public.responder_sugestao(uuid, text, text) to authenticated;
revoke all on function privado.notificar_sugestao(uuid, text), privado.nome_situacao_sugestao(text) from public;

-- ---------- visões ----------
create or replace view public.sugestoes_painel with (security_invoker = true) as
select s.id, s.tipo, s.titulo, s.descricao, s.situacao, s.resposta, s.autor_id, a.nome as autor_nome, s.criado_em,
       s.respondido_em, r.nome as respondido_por_nome,
       (select count(*)::int from public.sugestao_apoios x where x.sugestao_id = s.id) as apoios,
       exists (select 1 from public.sugestao_apoios x where x.sugestao_id = s.id and x.pessoa_id = privado.eu()) as apoiei,
       (select count(*)::int from public.sugestao_comentarios c where c.sugestao_id = s.id) as comentarios,
       privado.eh_presidencia(privado.eu()) as pode_responder
  from public.sugestoes s
  join public.pessoas a on a.id = s.autor_id
  left join public.pessoas r on r.id = s.respondido_por;

create or replace view public.sugestao_comentarios_painel with (security_invoker = true) as
select c.id, c.sugestao_id, c.autor_id, p.nome as autor_nome, c.texto, c.criado_em
  from public.sugestao_comentarios c
  join public.pessoas p on p.id = c.autor_id;

-- o sino: as mesmas linhas do 19, mais as novidades nas sugestões da pessoa (colunas novas no fim)
create or replace view public.minhas_notificacoes with (security_invoker = true) as
select n.id::text as chave, n.id, n.tipo, d.titulo as titulo, d.codigo, d.prazo, null::text as autor_nome,
       n.demanda_id, null::uuid as recado_id, n.criado_em as em, null::uuid as sugestao_id, null::text as detalhe
  from public.notificacoes n
  join public.demandas d on d.id = n.demanda_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'atribuicao' and d.status <> 'concluida'
   and exists (select 1 from public.demanda_executores e where e.demanda_id = n.demanda_id and e.pessoa_id = n.pessoa_id)
union all
select n.id::text, n.id, n.tipo, r.titulo, null::text, null::date, p.nome,
       null::uuid, n.recado_id, n.criado_em, null::uuid, null::text
  from public.notificacoes n
  join public.recados r on r.id = n.recado_id and r.retirado_em is null and r.situacao = 'publicado' and privado.recado_no_prazo(r.visivel_ate)
  join public.pessoas p on p.id = r.autor_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'recado'
union all
select 'atraso:' || d.id::text, null::uuid, 'atraso', d.titulo, d.codigo, d.prazo, null::text,
       d.id, null::uuid, d.prazo::timestamptz, null::uuid, null::text
  from public.demandas d
  join public.demanda_executores e on e.demanda_id = d.id
 where e.pessoa_id = privado.eu() and d.status <> 'concluida' and d.prazo < privado.hoje()
union all
select 'autorizacao:' || r.id::text, null::uuid, 'autorizacao', r.titulo, null::text, null::date, p.nome,
       null::uuid, r.id, r.criado_em, null::uuid, null::text
  from public.recados r
  join public.pessoas p on p.id = r.autor_id
 where r.situacao = 'pendente' and r.retirado_em is null and privado.recado_no_prazo(r.visivel_ate)
   and privado.pode_autorizar_recado(privado.eu(), r.autor_id)
union all
select n.id::text, n.id, n.tipo, s.titulo, null::text, null::date, null::text,
       null::uuid, null::uuid, n.criado_em, n.sugestao_id, n.detalhe
  from public.notificacoes n
  join public.sugestoes s on s.id = n.sugestao_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'sugestao';

revoke all on public.sugestoes_painel, public.sugestao_comentarios_painel, public.minhas_notificacoes from anon;
revoke insert, update, delete, truncate on public.sugestoes_painel, public.sugestao_comentarios_painel, public.minhas_notificacoes from authenticated;
grant select on public.sugestoes_painel, public.sugestao_comentarios_painel, public.minhas_notificacoes to authenticated;
