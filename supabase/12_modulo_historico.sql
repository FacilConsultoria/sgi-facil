-- =====================================================================
-- SGI Fácil Consultoria · 12 · Histórico completo
-- Rodar depois do 11.
--
-- Os registros de auditoria já são filtrados por pessoa pela regra de leitura
-- da tabela (ver 01): a Presidência (com a Assessoria) vê tudo; as demais pessoas
-- veem o que fizeram, o que as envolve e o que está no escopo delas (demandas,
-- reuniões, pontuação e a área que dirigem). Esta visão só acrescenta o nome de
-- quem fez a ação, para a tela mostrar e buscar, sem mudar quem vê o quê.
-- ator nulo = integração automática (por exemplo, a transcrição do Meet).
-- =====================================================================

create view public.historico_visivel with (security_invoker = true) as
select a.id, a.em, a.ator, p.nome as ator_nome, a.acao, a.detalhe
  from public.auditoria a
  left join public.pessoas p on p.id = a.ator;

revoke all on public.historico_visivel from anon;
-- o Supabase concede insert/update/delete por padrão em objetos novos; visões são só leitura
revoke insert, update, delete, truncate on public.historico_visivel from authenticated;
grant select on public.historico_visivel to authenticated;
