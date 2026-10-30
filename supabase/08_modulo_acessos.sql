-- =====================================================================
-- SGI Fácil Consultoria · 08 · Pedidos de acesso por exceção (tela Autorizações)
-- Rodar depois do 07.
--
-- Dá à tela o que ela precisa sem recalcular permissões (ver docs/adr/0001):
-- para quem a pessoa pode pedir acesso, quais projetos podem ser pedidos,
-- o nome do que foi pedido e se a Assessoria de Presidência pode pedir aval
-- para decidir um pedido. As regras de pedir não mudam; só passam a morar
-- numa função única, usada pela tela e por public.solicitar_acesso.
-- =====================================================================

-- quem p pode pedir acesso em nome de b: a própria pessoa, o diretor para a sua área e a gerência
-- para o seu núcleo. A Presidência (incluindo a Assessoria) não pede: decide.
create or replace function privado.pode_pedir_acesso_para(p uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and not privado.eh_presidencia(p) and exists (
    select 1 from public.pessoas x
     where x.id = b and x.ativo and (
          x.id = p
       or (privado.papel_de(p) = 'diretor' and privado.dirige(p, x.area_id) and x.papel not in ('presidente','vice'))
       or (privado.papel_de(p) in ('gerente','assessor')
           and x.nucleo_id = (select nucleo_id from public.pessoas where id = p))))
$$;

-- nome do que foi pedido, para exibir (projeto: "Nome · Cliente"; demanda: "COD-001 · Título").
-- Consulta sem o filtro de acesso: quem vê o pedido precisa ler o nome do alvo mesmo sem ver o item.
create or replace function privado.nome_do_alvo(p_sol uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when s.alvo = 'projeto'
              then pr.nome || case when pr.cliente <> '' then ' · ' || pr.cliente else '' end
              else d.codigo || ' · ' || d.titulo end
    from public.solicitacoes s
    left join public.demandas d on d.id = s.demanda_id
    join public.projetos pr on pr.id = coalesce(s.projeto_id, d.projeto_id)
   where s.id = p_sol
$$;

-- public.solicitar_acesso: igual à do 01, com a regra de "quem pode pedir para quem" na função acima
create or replace function public.solicitar_acesso(p_beneficiario uuid, p_alvo public.alvo_solicitacao, p_projeto uuid,
  p_codigo text, p_justificativa text, p_valido_ate date) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); b public.pessoas%rowtype; v_demanda uuid; v_id uuid;
begin
  select * into b from public.pessoas where id = p_beneficiario and ativo;
  if not found or not privado.pode_pedir_acesso_para(v_eu, b.id) then
    raise exception 'Você não pode pedir acesso para essa pessoa.';
  end if;
  if length(trim(coalesce(p_justificativa, ''))) < 20 then raise exception 'Escreva uma justificativa com pelo menos 20 caracteres.'; end if;
  if p_valido_ate is null or p_valido_ate <= privado.hoje() or p_valido_ate > privado.hoje() + 90 then
    raise exception 'Escolha uma validade entre amanhã e 90 dias.';
  end if;
  if p_alvo = 'projeto' then
    if not exists (select 1 from public.projetos where id = p_projeto and not restrito)
       or privado.escopo_projeto(b.id, p_projeto)
       or exists (select 1 from public.solicitacoes s where s.beneficiario = b.id and s.projeto_id = p_projeto
                  and (s.status = 'pendente' or (s.status = 'aprovada' and s.valido_ate >= privado.hoje()))) then
      raise exception 'Escolha um projeto da lista.';
    end if;
  else
    select id into v_demanda from public.demandas where codigo = upper(trim(coalesce(p_codigo, '')));
    if v_demanda is null or privado.pode_ver_demanda(b.id, v_demanda) then
      raise exception 'Não há demanda com esse código que precise de liberação para essa pessoa.';
    end if;
  end if;
  insert into public.solicitacoes (solicitante, beneficiario, alvo, projeto_id, demanda_id, justificativa, valido_ate)
  values (v_eu, b.id, p_alvo, case when p_alvo = 'projeto' then p_projeto end, v_demanda, trim(p_justificativa), p_valido_ate)
  returning id into v_id;
  perform privado.registrar('Solicitou acesso', 'para ' || b.nome, p_area => privado.area_alvo(v_id), p_envolvidos => array[b.id]);
  return v_id;
end $$;

-- pessoas para quem quem está logado pode pedir acesso
create view public.beneficiarios_de_acesso with (security_invoker = true) as
select x.id, x.nome, x.papel, x.area_id, x.nucleo_id
  from public.pessoas x
 where x.ativo and privado.pode_pedir_acesso_para(privado.eu(), x.id);

-- projetos que podem ser pedidos para uma pessoa: abertos ao pedido (não restritos), fora do escopo
-- dela e sem pedido pendente ou acesso vigente. Só responde a quem pode pedir para essa pessoa.
create or replace function public.projetos_solicitaveis(p_beneficiario uuid)
returns table (id uuid, nome text, cliente text, nucleo_nome text, area_id text)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.nome, pr.cliente, n.nome, n.area_id
    from public.projetos pr
    join public.nucleos n on n.id = pr.nucleo_id
   where privado.pode_pedir_acesso_para(privado.eu(), p_beneficiario)
     and pr.ativo and not pr.restrito
     and not privado.escopo_projeto(p_beneficiario, pr.id)
     and not exists (select 1 from public.solicitacoes s
                      where s.beneficiario = p_beneficiario and s.projeto_id = pr.id
                        and (s.status = 'pendente' or (s.status = 'aprovada' and s.valido_ate >= privado.hoje())))
   order by pr.nome
$$;

-- solicitacoes_visiveis: mesmas colunas do 03; novas só no fim
--   alvo_nome        o que foi pedido
--   pode_pedir_aval  Assessoria de Presidência: pode pedir aval da Presidente ou da Vice para decidir o pedido
create or replace view public.solicitacoes_visiveis with (security_invoker = true) as
select s.id, s.solicitante, s.beneficiario, s.alvo, s.projeto_id, s.demanda_id, s.justificativa, s.valido_ate, s.status,
       s.decidido_por, s.decidido_em, s.nota, s.revogado_por, s.revogado_em, s.criado_em,
       case when s.status = 'aprovada' and s.valido_ate < privado.hoje() then 'expirada' else s.status::text end as situacao,
       privado.area_alvo(s.id) as area_id,
       privado.alvo_restrito(s.id) as alvo_restrito,
       privado.pode_aprovar(privado.eu(), s.id) as pode_aprovar,
       (s.status = 'aprovada' and s.valido_ate >= privado.hoje()
        and (privado.eh_presidente(privado.eu()) or s.decidido_por = privado.eu())) as pode_revogar,
       privado.nome_do_alvo(s.id) as alvo_nome,
       (s.status = 'pendente' and privado.eh_assessoria_presidencia(privado.eu())
        and privado.eu() not in (s.solicitante, s.beneficiario)
        and not exists (select 1 from public.avais a where a.tipo = 'decidir_solicitacao' and a.status = 'pendente'
                         and a.payload ->> 'solicitacao' = s.id::text)) as pode_pedir_aval
  from public.solicitacoes s;

grant execute on function privado.pode_pedir_acesso_para(uuid, uuid), privado.nome_do_alvo(uuid) to authenticated;
revoke all on function public.projetos_solicitaveis(uuid) from public, anon;
grant execute on function public.projetos_solicitaveis(uuid) to authenticated;
revoke all on public.beneficiarios_de_acesso from anon;
revoke insert, update, delete, truncate on public.beneficiarios_de_acesso, public.solicitacoes_visiveis from authenticated;
grant select on public.beneficiarios_de_acesso to authenticated;
