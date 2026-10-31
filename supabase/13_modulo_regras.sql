-- =====================================================================
-- SGI Fácil Consultoria · 13 · Regras
-- Rodar depois do 12.
--
-- A tela Regras lê os valores de pontuação direto da tabela config (leitura aberta
-- a quem tem cadastro) e grava por public.salvar_config, que já existe e confere a
-- permissão (Presidência, com a Assessoria, ou a Diretoria Administrativa).
-- O que falta é a "simulação de visibilidade": para cada pessoa, quantas demandas
-- e quantas pontuações ela enxerga com os dados de agora. Serve para a Presidência
-- conferir se a hierarquia está valendo. Usa as mesmas funções que a regra de
-- leitura (pode_ver_demanda, pode_ver_pontuacao), por isso responde exatamente o
-- que cada pessoa veria. Só a Presidência recebe linhas; as demais pessoas recebem
-- uma lista vazia.
-- =====================================================================

create or replace function public.simulacao_de_visibilidade()
returns table (pessoa_id uuid, nome text, papel public.papel, setor text,
               demandas_visiveis int, por_excecao int, pontuacoes_visiveis int, total_demandas int)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.papel, coalesce(n.nome, a.titulo),
         (select count(*)::int from public.demandas d where privado.pode_ver_demanda(p.id, d.id)),
         -- só por exceção: vê por uma liberação ativa, não por escopo nem por ser executor
         (select count(*)::int from public.demandas d
           where privado.concessao_ativa(p.id, d.id)
             and not privado.pode_gerir_demanda(p.id, d.id)
             and not exists (select 1 from public.demanda_executores e where e.demanda_id = d.id and e.pessoa_id = p.id)),
         (select count(*)::int from public.pessoas q where q.ativo and privado.pode_ver_pontuacao(p.id, q.id)),
         (select count(*)::int from public.demandas)
    from public.pessoas p
    join public.areas a on a.id = p.area_id
    left join public.nucleos n on n.id = p.nucleo_id
   where p.ativo and privado.eh_presidencia(privado.eu())
   order by p.nome
$$;

revoke all on function public.simulacao_de_visibilidade() from public, anon;
grant execute on function public.simulacao_de_visibilidade() to authenticated;
