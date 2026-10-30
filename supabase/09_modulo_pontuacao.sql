-- =====================================================================
-- SGI Fácil Consultoria · 09 · Pontuação e ranking
-- Rodar depois do 08.
--
-- Dá à tela o que ela precisa sem recalcular permissões (ver docs/adr/0001):
-- as pessoas cuja pontuação detalhada quem consulta pode ver (com saldo,
-- entregas, faltas e projetos ativos), a linha do tempo de lançamentos com o
-- que cada pessoa pode fazer em cada um, e se pode ajustar ou, na Assessoria
-- de Presidência, pedir aval para ajustar a própria pontuação.
-- As regras de lançar, desconsiderar e do ranking não mudam: continuam em
-- public.lancar_pontos, public.desconsiderar_lancamento e public.ranking.
-- =====================================================================

-- projetos em que a pessoa tem demanda em aberto, sem filtro de acesso
-- (a visão separa os que quem consulta pode ver dos que não pode)
create or replace function privado.projetos_ativos_de(p_pessoa uuid) returns table (projeto_id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select distinct pr.id, pr.nome
    from public.demanda_executores e
    join public.demandas d on d.id = e.demanda_id and d.status <> 'concluida'
    join public.projetos pr on pr.id = d.projeto_id
   where e.pessoa_id = p_pessoa
$$;

-- pessoas ativas cuja pontuação detalhada quem consulta pode ver.
-- Saldo = pontos iniciais + lançamentos não desconsiderados. Entregas e faltas contam como no ranking;
-- justificadas são as faltas lançadas sem perda de pontos.
create view public.pontuacao_pessoas with (security_invoker = true) as
select p.id, p.nome, p.papel, p.area_id, p.nucleo_id, p.curso,
       coalesce(n.nome, a.titulo) as setor,
       (c.pontos_iniciais + s.saldo)::int as pontos,
       s.entregas, s.faltas, s.justificadas,
       array(select pa.nome from privado.projetos_ativos_de(p.id) pa
              where privado.pode_ver_projeto(privado.eu(), pa.projeto_id) order by pa.nome) as projetos_ativos,
       (select count(*)::int from privado.projetos_ativos_de(p.id) pa
         where not privado.pode_ver_projeto(privado.eu(), pa.projeto_id)) as projetos_ocultos,
       privado.pode_ajustar(privado.eu(), p.id) as pode_ajustar,
       (p.id = privado.eu() and privado.eh_assessoria_presidencia(p.id)) as pode_pedir_aval
  from public.pessoas p
  join public.areas a on a.id = p.area_id
  left join public.nucleos n on n.id = p.nucleo_id
  cross join public.config c
  cross join lateral (
    select coalesce(sum(l.valor), 0)::int as saldo,
           (count(*) filter (where l.tipo = 'demanda' and l.valor > 0))::int as entregas,
           (count(*) filter (where l.tipo = 'falta' and l.valor < 0))::int as faltas,
           (count(*) filter (where l.tipo = 'falta' and l.valor >= 0))::int as justificadas
      from public.lancamentos l
     where l.pessoa_id = p.id and l.desconsiderado_em is null) s
 where p.ativo and privado.pode_ver_pontuacao(privado.eu(), p.id);

-- linha do tempo: os lançamentos que a RLS mostra, com o código e o título da demanda só quando
-- quem consulta pode ver a demanda (a junção também passa pela RLS) e se pode desconsiderar
create view public.lancamentos_visiveis with (security_invoker = true) as
select l.id, l.pessoa_id, l.tipo, l.descricao, l.data, l.valor, l.demanda_id, l.reuniao_id, l.criado_por, l.criado_em,
       l.desconsiderado_por, l.desconsiderado_em, l.motivo_desconsideracao,
       d.codigo as demanda_codigo, d.titulo as demanda_titulo,
       (l.desconsiderado_em is null and privado.pode_ajustar(privado.eu(), l.pessoa_id)) as pode_desconsiderar
  from public.lancamentos l
  left join public.demandas d on d.id = l.demanda_id;

grant execute on function privado.projetos_ativos_de(uuid), privado.pode_ajustar(uuid, uuid),
                          privado.eh_assessoria_presidencia(uuid), privado.pode_ver_pontuacao(uuid, uuid),
                          privado.pode_ver_projeto(uuid, uuid) to authenticated;
revoke all on public.pontuacao_pessoas, public.lancamentos_visiveis from anon;
-- o Supabase concede insert/update/delete por padrão em objetos novos; visões são só leitura
revoke insert, update, delete, truncate on public.pontuacao_pessoas, public.lancamentos_visiveis from authenticated;
grant select on public.pontuacao_pessoas, public.lancamentos_visiveis to authenticated;
