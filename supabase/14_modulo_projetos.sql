-- =====================================================================
-- SGI Fácil Consultoria · 14 · Projetos
-- Rodar depois do 13.
--
-- A tela Projetos mostra, para cada projeto que a pessoa enxerga, o andamento
-- das demandas e o tipo de acesso que ela tem. Esta visão devolve isso pronto,
-- para o site não recalcular permissão:
--   acesso   'integral' (o projeto está no escopo da pessoa pela hierarquia),
--            'excecao' (liberação aprovada para o projeto inteiro, só consulta) ou
--            'parcial' (a pessoa só vê as demandas em que atua)
--   total_demandas, concluidas, atrasadas
--            contam só as demandas que a pessoa enxerga (a regra de leitura de
--            demandas vale dentro da visão), por isso "parcial" mostra um
--            andamento parcial.
-- Quais projetos aparecem continua sendo decidido pela regra de leitura de
-- projetos. Visão somente de leitura.
-- =====================================================================

create or replace view public.projetos_painel with (security_invoker = true) as
select pr.id, pr.nome, pr.cliente, pr.nucleo_id, n.nome as nucleo_nome, n.area_id, a.titulo as area_titulo,
       pr.restrito, pr.ativo,
       case
         when privado.escopo_projeto(privado.eu(), pr.id) then 'integral'
         when exists (select 1 from public.solicitacoes s
                       where s.beneficiario = privado.eu() and s.projeto_id = pr.id
                         and s.status = 'aprovada' and s.valido_ate >= privado.hoje()) then 'excecao'
         else 'parcial'
       end as acesso,
       (select count(*)::int from public.demandas d where d.projeto_id = pr.id) as total_demandas,
       (select count(*)::int from public.demandas d where d.projeto_id = pr.id and d.status = 'concluida') as concluidas,
       (select count(*)::int from public.demandas d
         where d.projeto_id = pr.id and d.status <> 'concluida' and d.prazo < privado.hoje()) as atrasadas
  from public.projetos pr
  join public.nucleos n on n.id = pr.nucleo_id
  join public.areas a on a.id = n.area_id;

revoke all on public.projetos_painel from anon;
revoke insert, update, delete, truncate on public.projetos_painel from authenticated;
grant select on public.projetos_painel to authenticated;
