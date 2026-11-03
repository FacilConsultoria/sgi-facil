-- =====================================================================
-- SGI Fácil Consultoria · 19 · Recados: autorização para toda a equipe e prazo de exibição
-- Rodar depois do 18.
--
-- Toda a equipe:
--   Presidência (Presidente, Vice e Assessoria de Presidência) publica direto, como no 18.
--   Diretorias também podem, mas o recado fica "aguardando autorização"
--   até alguém da Presidência (Presidente, Vice ou Assessoria) autorizar; ninguém autoriza o próprio.
--   Enquanto aguarda, ninguém do público vê nem é avisado. Autorizado, entra no sino de todos;
--   recusado, só quem pediu vê (com o motivo, se houver).
--   Áreas e núcleos continuam como no 18 (sem autorização).
--
-- Prazo: ao criar, dá para escolher até que dia o recado aparece (visivel_ate, opcional, até um ano).
--   Passado esse dia, ele some da Tela Inicial e do sino de todos (fica guardado no banco).
-- =====================================================================

alter table public.recados
  add column situacao      text not null default 'publicado' check (situacao in ('pendente','publicado','recusado')),
  add column visivel_ate   date,
  add column publicado_em  timestamptz,
  add column decidido_por  uuid references public.pessoas(id),
  add column decidido_em   timestamptz,
  add column motivo_recusa text;

update public.recados set publicado_em = criado_em where situacao = 'publicado' and publicado_em is null;

-- ---------- regras ----------
-- publicar direto continua como no 18 (privado.pode_publicar_recado): toda a equipe é da Presidência,
-- que inclui a Assessoria de Presidência

-- pedir recado para toda a equipe (fica aguardando autorização): diretorias
create or replace function privado.pode_pedir_recado_geral(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and coalesce(privado.papel_de(p) = 'diretor', false)
$$;

-- quem autoriza: Presidência (Presidente, Vice ou Assessoria), menos quem pediu
create or replace function privado.pode_autorizar_recado(p uuid, p_autor uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and p is distinct from p_autor and privado.eh_presidencia(p)
$$;

-- o recado ainda está no prazo de exibição?
create or replace function privado.recado_no_prazo(p_visivel_ate date) returns boolean
language sql stable security definer set search_path = public as $$
  select p_visivel_ate is null or p_visivel_ate >= privado.hoje()
$$;

drop policy ler on public.recados;
create policy ler on public.recados for select to authenticated
  using (retirado_em is null and (
       autor_id = (select privado.eu())
    or (situacao = 'pendente' and privado.pode_autorizar_recado((select privado.eu()), autor_id))
    or (situacao = 'publicado' and privado.recado_no_prazo(visivel_ate) and (
         privado.eh_presidencia((select privado.eu()))
      or privado.recebe_recado((select privado.eu()), escopo, escopo_id)
      or privado.dirige((select privado.eu()), case escopo when 'area' then escopo_id when 'nucleo' then privado.area_do_nucleo(escopo_id) end)))));

-- avisa o público de um recado publicado (menos quem escreveu)
create or replace function privado.notificar_recado(p_recado uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.notificacoes (pessoa_id, tipo, recado_id)
  select x.id, 'recado', r.id
    from public.recados r
    join public.pessoas x on x.ativo and x.id <> r.autor_id and privado.recebe_recado(x.id, r.escopo, r.escopo_id)
   where r.id = p_recado
  on conflict do nothing
$$;

-- ---------- operações ----------
drop function public.publicar_recado(text, text, text, text);

create or replace function public.publicar_recado(p_titulo text, p_texto text, p_escopo text, p_escopo_id text default null,
  p_visivel_ate date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_eu      uuid := privado.exigir_login();
  v_id      uuid;
  v_alvo    text := case when p_escopo = 'todos' then null else nullif(trim(coalesce(p_escopo_id, '')), '') end;
  v_direto  boolean;
  v_publico text;
begin
  if p_escopo is null or p_escopo not in ('todos','area','nucleo') then raise exception 'Escolha para quem é o recado.'; end if;
  if p_escopo = 'area' and not exists (select 1 from public.areas where id = v_alvo) then raise exception 'Área não encontrada.'; end if;
  if p_escopo = 'nucleo' and not exists (select 1 from public.nucleos where id = v_alvo) then raise exception 'Núcleo não encontrado.'; end if;
  v_direto := privado.pode_publicar_recado(v_eu, p_escopo, v_alvo);
  if not v_direto and not (p_escopo = 'todos' and privado.pode_pedir_recado_geral(v_eu)) then
    raise exception 'Você não pode enviar recados para este público.';
  end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Dê um título ao recado.'; end if;
  if length(trim(p_titulo)) > 80 then raise exception 'O título do recado tem no máximo 80 caracteres.'; end if;
  if length(trim(coalesce(p_texto, ''))) = 0 then raise exception 'Escreva o recado.'; end if;
  if length(trim(p_texto)) > 1000 then raise exception 'O recado tem no máximo 1000 caracteres.'; end if;
  if p_visivel_ate is not null and p_visivel_ate < privado.hoje() then raise exception 'A data limite não pode ser anterior a hoje.'; end if;
  if p_visivel_ate is not null and p_visivel_ate > privado.hoje() + 365 then raise exception 'A data limite pode ser no máximo um ano à frente.'; end if;

  insert into public.recados (autor_id, titulo, texto, escopo, escopo_id, visivel_ate, situacao, publicado_em)
  values (v_eu, trim(p_titulo), trim(p_texto), p_escopo, v_alvo, p_visivel_ate,
          case when v_direto then 'publicado' else 'pendente' end, case when v_direto then now() end)
  returning id into v_id;

  v_publico := case p_escopo when 'todos' then 'toda a equipe'
                 when 'area' then (select titulo from public.areas where id = v_alvo)
                 else (select nome from public.nucleos where id = v_alvo) end;
  if v_direto then
    perform privado.notificar_recado(v_id);
    perform privado.registrar('Publicou recado', trim(p_titulo) || ' · ' || v_publico,
      p_area => case p_escopo when 'area' then v_alvo when 'nucleo' then privado.area_do_nucleo(v_alvo) end);
  else
    perform privado.registrar('Pediu autorização de recado', trim(p_titulo) || ' · ' || v_publico);
  end if;
  return v_id;
end $$;

-- autoriza (publica e avisa o público) ou recusa um recado que aguarda autorização
create or replace function public.decidir_recado(p_id uuid, p_autorizar boolean, p_motivo text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); r public.recados%rowtype;
begin
  select * into r from public.recados where id = p_id and retirado_em is null for update;
  if not found or r.situacao <> 'pendente' then raise exception 'Este recado não está aguardando autorização.'; end if;
  if r.autor_id = v_eu then raise exception 'Ninguém autoriza o próprio recado.'; end if;
  if not privado.pode_autorizar_recado(v_eu, r.autor_id) then
    raise exception 'Só a Presidência, a Vice-Presidência ou a Assessoria autorizam recados para toda a equipe.';
  end if;
  if p_autorizar is null then raise exception 'Escolha autorizar ou recusar.'; end if;
  if p_autorizar then
    if not privado.recado_no_prazo(r.visivel_ate) then raise exception 'O prazo deste recado já passou. Recuse e peça um novo.'; end if;
    update public.recados set situacao = 'publicado', publicado_em = now(), decidido_por = v_eu, decidido_em = now() where id = p_id;
    perform privado.notificar_recado(p_id);
    perform privado.registrar('Autorizou recado', r.titulo);
  else
    if length(coalesce(trim(p_motivo), '')) > 300 then raise exception 'O motivo tem no máximo 300 caracteres.'; end if;
    update public.recados set situacao = 'recusado', decidido_por = v_eu, decidido_em = now(), motivo_recusa = nullif(trim(coalesce(p_motivo, '')), '')
     where id = p_id;
    perform privado.registrar('Recusou recado', r.titulo);
  end if;
end $$;

revoke all on function public.publicar_recado(text, text, text, text, date), public.decidir_recado(uuid, boolean, text) from public, anon;
grant execute on function public.publicar_recado(text, text, text, text, date), public.decidir_recado(uuid, boolean, text) to authenticated;
revoke all on function privado.pode_pedir_recado_geral(uuid), privado.pode_autorizar_recado(uuid, uuid), privado.recado_no_prazo(date),
  privado.notificar_recado(uuid) from public;
grant execute on function privado.pode_pedir_recado_geral(uuid), privado.pode_autorizar_recado(uuid, uuid), privado.recado_no_prazo(date) to authenticated;

-- ---------- visões (colunas novas sempre no fim) ----------
create or replace view public.recados_painel with (security_invoker = true) as
select r.id, r.titulo, r.texto, r.escopo, r.escopo_id, r.autor_id, p.nome as autor_nome,
       case r.escopo when 'todos' then 'Toda a equipe'
                     when 'area' then (select a.titulo from public.areas a where a.id = r.escopo_id)
                     else (select n.nome from public.nucleos n where n.id = r.escopo_id) end as publico,
       r.criado_em,
       (r.autor_id = privado.eu() or privado.eh_presidencia(privado.eu())) as pode_retirar,
       r.situacao, r.visivel_ate, r.publicado_em, r.motivo_recusa,
       (r.situacao = 'pendente' and privado.pode_autorizar_recado(privado.eu(), r.autor_id)) as pode_autorizar
  from public.recados r
  join public.pessoas p on p.id = r.autor_id
 where r.retirado_em is null and privado.recado_no_prazo(r.visivel_ate);

create or replace view public.destinos_de_recado with (security_invoker = true) as
select 'todos'::text as escopo, null::text as escopo_id, 'Toda a equipe'::text as nome, 0 as ordem,
       not privado.pode_publicar_recado(privado.eu(), 'todos', null) as precisa_autorizacao
 where privado.pode_publicar_recado(privado.eu(), 'todos', null) or privado.pode_pedir_recado_geral(privado.eu())
union all
select 'area', a.id, a.titulo, 1, false from public.areas a where privado.pode_publicar_recado(privado.eu(), 'area', a.id)
union all
select 'nucleo', n.id, n.nome, 2, false from public.nucleos n where privado.pode_publicar_recado(privado.eu(), 'nucleo', n.id);

-- o sino ganha os recados que aguardam a autorização de quem consulta
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
  join public.recados r on r.id = n.recado_id and r.retirado_em is null and r.situacao = 'publicado' and privado.recado_no_prazo(r.visivel_ate)
  join public.pessoas p on p.id = r.autor_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'recado'
union all
select 'atraso:' || d.id::text, null::uuid, 'atraso', d.titulo, d.codigo, d.prazo, null::text,
       d.id, null::uuid, d.prazo::timestamptz
  from public.demandas d
  join public.demanda_executores e on e.demanda_id = d.id
 where e.pessoa_id = privado.eu() and d.status <> 'concluida' and d.prazo < privado.hoje()
union all
select 'autorizacao:' || r.id::text, null::uuid, 'autorizacao', r.titulo, null::text, null::date, p.nome,
       null::uuid, r.id, r.criado_em
  from public.recados r
  join public.pessoas p on p.id = r.autor_id
 where r.situacao = 'pendente' and r.retirado_em is null and privado.recado_no_prazo(r.visivel_ate)
   and privado.pode_autorizar_recado(privado.eu(), r.autor_id);

revoke all on public.recados_painel, public.destinos_de_recado, public.minhas_notificacoes from anon;
revoke insert, update, delete, truncate on public.recados_painel, public.destinos_de_recado, public.minhas_notificacoes from authenticated;
grant select on public.recados_painel, public.destinos_de_recado, public.minhas_notificacoes to authenticated;
