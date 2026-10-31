-- =====================================================================
-- SGI Fácil Consultoria · 10 · Presenças
-- Rodar depois do 09.
--
-- Relatório de frequência: para cada pessoa que quem consulta acompanha, quantas
-- reuniões encerradas a convocaram e como ficou a presença. Quem aparece segue a
-- mesma regra da pontuação detalhada (privado.pode_ver_pontuacao): a própria
-- pessoa, a Presidência (com a Assessoria), a Gente e Gestão, a diretoria da
-- área e a gerência do núcleo. Só números: o título e o conteúdo das reuniões
-- continuam protegidos pela regra de cada reunião.
-- Reunião ainda aberta não entra (a presença só vale depois de encerrada).
-- A taxa de frequência (presenças ÷ convocações) é calculada no site.
-- =====================================================================

create or replace function public.frequencia()
returns table (pessoa_id uuid, nome text, setor text, convocacoes int, presencas int, justificadas int, faltas int)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, coalesce(n.nome, a.titulo),
         (count(x.pessoa_id))::int,
         (count(*) filter (where x.presenca = 'presente'))::int,
         (count(*) filter (where x.presenca = 'justificada'))::int,
         (count(*) filter (where x.presenca = 'falta'))::int
    from public.pessoas p
    join public.areas a on a.id = p.area_id
    left join public.nucleos n on n.id = p.nucleo_id
    left join (select rc.pessoa_id, rc.presenca
                 from public.reuniao_convocados rc
                 join public.reunioes r on r.id = rc.reuniao_id and r.encerrada) x on x.pessoa_id = p.id
   where p.ativo and privado.eu() is not null and privado.pode_ver_pontuacao(privado.eu(), p.id)
   group by p.id, p.nome, n.nome, a.titulo
   order by p.nome
$$;

revoke all on function public.frequencia() from public, anon;
grant execute on function public.frequencia() to authenticated;
