-- =====================================================================
-- SGI Fácil Consultoria · 05 · Módulo de Reuniões e atas
-- Rodar depois do 01, 03 e 04.
--
-- Entrega à tela de Reuniões o que ela precisa sem recalcular permissões
-- (ver docs/adr/0001): os públicos em que cada pessoa pode agendar reunião,
-- com quantas pessoas cada um convoca, e três colunas novas em
-- reunioes_visiveis (convocados, faltas e se já dá para encerrar).
-- Todas as visões usam security_invoker: a RLS das tabelas continua valendo.
-- =====================================================================

grant execute on function
  privado.pode_criar_reuniao(uuid, public.escopo_reuniao, text),
  privado.convocados(public.escopo_reuniao, text)
to authenticated;

-- reunioes_visiveis: mesmas colunas do 03; novas só no fim (exigência do "create or replace view")
create or replace view public.reunioes_visiveis with (security_invoker = true) as
select r.id, r.titulo, r.data, r.hora, r.escopo, r.escopo_id, r.pauta, r.encerrada,
       r.ata, r.ata_por, r.ata_em, r.criado_por, r.criado_em,
       privado.pode_gerir_reuniao(privado.eu(), r.id) as pode_gerir,
       exists (select 1 from public.reuniao_convocados rc where rc.reuniao_id = r.id and rc.pessoa_id = privado.eu()) as convocado,
       (select count(*)::int from public.anexos a where a.reuniao_id = r.id) as total_anexos,
       exists (select 1 from public.transcricoes t where t.reuniao_id = r.id) as tem_transcricao,
       (select count(*)::int from public.reuniao_convocados rc where rc.reuniao_id = r.id) as total_convocados,
       (select count(*)::int from public.reuniao_convocados rc where rc.reuniao_id = r.id and rc.presenca = 'falta') as total_faltas,
       (privado.pode_gerir_reuniao(privado.eu(), r.id) and not r.encerrada and r.data <= privado.hoje()) as pode_encerrar
  from public.reunioes r;

-- públicos possíveis de uma reunião, com o nome para exibir, se a pessoa pode agendar para ele
-- (mesma regra de public.criar_reuniao) e quantas pessoas seriam convocadas.
-- A área da Presidência fica de fora: ela já é o público "Presidência".
create view public.escopos_de_reuniao with (security_invoker = true) as
select 'geral'::public.escopo_reuniao as escopo, null::text as escopo_id, 'Reunião geral'::text as titulo,
       privado.pode_criar_reuniao(privado.eu(), 'geral', null) as pode_criar,
       (select count(*)::int from privado.convocados('geral', null)) as total_convocados
 where privado.eu() is not null
union all
select 'presidencia'::public.escopo_reuniao, null::text, 'Presidência'::text,
       privado.pode_criar_reuniao(privado.eu(), 'presidencia', null),
       (select count(*)::int from privado.convocados('presidencia', null))
 where privado.eu() is not null
union all
select 'area'::public.escopo_reuniao, a.id, a.titulo,
       privado.pode_criar_reuniao(privado.eu(), 'area', a.id),
       (select count(*)::int from privado.convocados('area', a.id))
  from public.areas a
 where a.id <> (select c.area_presidencia from public.config c)
union all
select 'nucleo'::public.escopo_reuniao, n.id, n.nome || ' · ' || a.titulo,
       privado.pode_criar_reuniao(privado.eu(), 'nucleo', n.id),
       (select count(*)::int from privado.convocados('nucleo', n.id))
  from public.nucleos n
  join public.areas a on a.id = n.area_id;

revoke all on public.escopos_de_reuniao from anon;
revoke insert, update, delete, truncate on public.reunioes_visiveis, public.escopos_de_reuniao from authenticated;
grant select on public.escopos_de_reuniao to authenticated;
