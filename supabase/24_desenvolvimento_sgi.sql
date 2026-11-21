-- =====================================================================
-- SGI Fácil Consultoria · 24 · Desenvolvimento do SGI responde às sugestões
-- Rodar depois do 23.
--
-- Quem desenvolve o SGI passa a responder às sugestões como a Presidência:
-- muda a situação (inclusive "feita" e "recusada", que encerram o chamado) e
-- escreve a resposta. A marca fica na pessoa (pessoas.desenvolve_sgi) e só a
-- Presidente liga ou desliga, pela função definir_desenvolvimento_sgi.
-- A marca não dá nenhum outro acesso.
-- =====================================================================

alter table public.pessoas add column if not exists desenvolve_sgi boolean not null default false;

create or replace function privado.desenvolve_sgi(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pessoas x where x.id = p and x.ativo and x.desenvolve_sgi)
$$;

-- Presidência (Presidente, Vice e Assessoria) ou desenvolvimento do SGI
create or replace function privado.pode_responder_sugestao(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (privado.eh_presidencia(p) or privado.desenvolve_sgi(p))
$$;

-- igual à do 20, com a nova regra de quem responde
create or replace function public.responder_sugestao(p_id uuid, p_situacao text, p_resposta text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); s public.sugestoes%rowtype; v_resposta text := nullif(trim(coalesce(p_resposta, '')), '');
begin
  if not privado.pode_responder_sugestao(v_eu) then
    raise exception 'Só a Presidência e o desenvolvimento do SGI respondem às sugestões.';
  end if;
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

-- só a Presidente marca ou desmarca quem desenvolve o SGI
create or replace function public.definir_desenvolvimento_sgi(p_pessoa uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_nome text;
begin
  if not privado.eh_presidente(v_eu) then raise exception 'Só a Presidente define quem desenvolve o SGI.'; end if;
  if p_ativo is null then raise exception 'Informe se a pessoa desenvolve o SGI.'; end if;
  update public.pessoas set desenvolve_sgi = p_ativo where id = p_pessoa returning nome into v_nome;
  if v_nome is null then raise exception 'Pessoa não encontrada.'; end if;
  perform privado.registrar(case when p_ativo then 'Marcou desenvolvimento do SGI' else 'Desmarcou desenvolvimento do SGI' end,
    v_nome, p_membro => p_pessoa);
end $$;

revoke all on function public.definir_desenvolvimento_sgi(uuid, boolean) from public, anon;
grant execute on function public.definir_desenvolvimento_sgi(uuid, boolean) to authenticated;

-- mesma visão do 20; pode_responder segue a nova regra
create or replace view public.sugestoes_painel with (security_invoker = true) as
select s.id, s.tipo, s.titulo, s.descricao, s.situacao, s.resposta, s.autor_id, a.nome as autor_nome, s.criado_em,
       s.respondido_em, r.nome as respondido_por_nome,
       (select count(*)::int from public.sugestao_apoios x where x.sugestao_id = s.id) as apoios,
       exists (select 1 from public.sugestao_apoios x where x.sugestao_id = s.id and x.pessoa_id = privado.eu()) as apoiei,
       (select count(*)::int from public.sugestao_comentarios c where c.sugestao_id = s.id) as comentarios,
       privado.pode_responder_sugestao(privado.eu()) as pode_responder
  from public.sugestoes s
  join public.pessoas a on a.id = s.autor_id
  left join public.pessoas r on r.id = s.respondido_por;
