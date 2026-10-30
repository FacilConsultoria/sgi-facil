-- =====================================================================
-- SGI Fácil Consultoria · 04 · Módulo de Demandas
-- Rodar depois do 01 e do 03.
--
-- Visões que a tela de Demandas usa para montar listas e formulários sem
-- recalcular permissões no site (ver docs/adr/0001), e um ajuste de regra:
-- só quem gere a demanda reabre uma demanda concluída, porque reabrir
-- desconsidera os pontos de entrega dos executores.
-- =====================================================================

-- ---------- regra: reabrir é decisão da liderança ----------
-- igual à do 01, com a checagem de reabertura antes de qualquer alteração
create or replace function privado.aplicar_status(p_demanda uuid, p_novo public.status_demanda) returns void
language plpgsql security definer set search_path = public as $$
declare d public.demandas%rowtype; c public.config%rowtype; v_hoje date := privado.hoje(); v_ok boolean;
begin
  select * into d from public.demandas where id = p_demanda for update;
  if d.status = p_novo then return; end if;
  if p_novo = 'concluida' and not privado.pode_gerir_demanda(privado.eu(), p_demanda) then
    raise exception 'Só a liderança do núcleo, a diretoria ou a Presidência validam a conclusão.';
  end if;
  if d.status = 'concluida' and not privado.pode_gerir_demanda(privado.eu(), p_demanda) then
    raise exception 'Só a liderança do núcleo, a diretoria ou a Presidência reabrem uma demanda concluída.';
  end if;
  if d.status = 'concluida' then
    update public.lancamentos
       set desconsiderado_por = privado.eu(), desconsiderado_em = now(), motivo_desconsideracao = 'Demanda reaberta.'
     where demanda_id = p_demanda and desconsiderado_em is null;
  end if;
  update public.demandas
     set status = p_novo, concluida_em = case when p_novo = 'concluida' then v_hoje end, atualizado_em = now()
   where id = p_demanda;
  if p_novo = 'concluida' then
    select * into c from public.config;
    v_ok := v_hoje <= d.prazo;
    insert into public.lancamentos (pessoa_id, tipo, descricao, data, valor, demanda_id, criado_por)
    select e.pessoa_id, 'demanda', case when v_ok then 'Entrega no prazo' else 'Entrega com atraso' end,
           v_hoje, case when v_ok then c.entrega_no_prazo else c.entrega_atrasada end, p_demanda, privado.eu()
      from public.demanda_executores e where e.demanda_id = p_demanda;
  end if;
end $$;

-- ---------- demandas: mesma visão do 03, com o novo indicador de status ----------
-- Colunas novas só no fim (exigência do "create or replace view"):
--   nucleo_nome  nome do núcleo dono do projeto
--   excecao_ate  último dia da liberação por exceção de quem consulta (nulo se não houver)
create or replace view public.demandas_visiveis with (security_invoker = true) as
select d.id, d.codigo, d.projeto_id, d.titulo, d.descricao, d.status, d.prioridade, d.prazo,
       d.concluida_em, d.criado_por, d.criado_em, d.atualizado_em,
       pr.nome as projeto_nome, pr.cliente as projeto_cliente,
       n.id as nucleo_id, n.area_id,
       (d.restrito or pr.restrito) as restrita,
       array(select e.pessoa_id from public.demanda_executores e where e.demanda_id = d.id) as executores,
       privado.pode_gerir_demanda(privado.eu(), d.id) as pode_gerir,
       (privado.pode_gerir_demanda(privado.eu(), d.id)
        or (d.status <> 'concluida'
            and exists (select 1 from public.demanda_executores e where e.demanda_id = d.id and e.pessoa_id = privado.eu()))) as pode_mudar_status,
       case
         when privado.eh_presidencia(privado.eu()) then 'presidencia'
         when not (d.restrito or pr.restrito) and privado.dirige(privado.eu(), n.area_id) then 'diretoria'
         when not (d.restrito or pr.restrito) and privado.lidera(privado.eu(), n.id) then 'nucleo'
         when exists (select 1 from public.demanda_executores e where e.demanda_id = d.id and e.pessoa_id = privado.eu()) then 'executor'
         else 'excecao'
       end as motivo_acesso,
       n.nome as nucleo_nome,
       (select max(s.valido_ate) from public.solicitacoes s
         where s.beneficiario = privado.eu() and s.status = 'aprovada' and s.valido_ate >= privado.hoje()
           and (s.demanda_id = d.id or s.projeto_id = d.projeto_id)) as excecao_ate
  from public.demandas d
  join public.projetos pr on pr.id = d.projeto_id
  join public.nucleos n on n.id = pr.nucleo_id;

-- ---------- projetos visíveis, com o que a pessoa pode fazer em cada um ----------
-- pode_criar_demanda segue a checagem de public.criar_demanda
create view public.projetos_visiveis with (security_invoker = true) as
select pr.id, pr.nome, pr.cliente, pr.nucleo_id, n.nome as nucleo_nome, n.area_id, pr.restrito, pr.ativo,
       (coalesce(privado.papel_de(privado.eu()) <> 'membro', false)
        and privado.escopo_projeto(privado.eu(), pr.id)) as pode_criar_demanda
  from public.projetos pr
  join public.nucleos n on n.id = pr.nucleo_id;

-- ---------- núcleos, com onde a pessoa pode criar projetos ----------
-- pode_criar_projeto segue a checagem de public.criar_projeto
create view public.nucleos_visiveis with (security_invoker = true) as
select n.id, n.nome, n.area_id, n.vaga,
       (privado.eh_presidencia(privado.eu()) or privado.dirige(privado.eu(), n.area_id)
        or privado.lidera(privado.eu(), n.id)) as pode_criar_projeto
  from public.nucleos n;

-- ---------- pessoas que quem está logado pode pôr como executoras ----------
-- privado.pode_atribuir não depende do projeto (o parâmetro existe para regras futuras),
-- por isso a visão passa nulo; criar_demanda e editar_demanda aplicam a mesma função.
create view public.pessoas_atribuiveis with (security_invoker = true) as
select x.id, x.nome, x.papel, x.area_id, x.nucleo_id
  from public.pessoas x
 where x.ativo and privado.pode_atribuir(privado.eu(), null, x.id);

grant execute on function privado.pode_atribuir(uuid, uuid, uuid) to authenticated;
revoke all on public.projetos_visiveis, public.nucleos_visiveis, public.pessoas_atribuiveis from anon;
revoke insert, update, delete, truncate on public.demandas_visiveis, public.projetos_visiveis, public.nucleos_visiveis, public.pessoas_atribuiveis from authenticated;
grant select on public.projetos_visiveis, public.nucleos_visiveis, public.pessoas_atribuiveis to authenticated;
