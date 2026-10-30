-- =====================================================================
-- SGI Fácil Consultoria · 03 · Visões para a interface
-- Rodar depois do 01 (pode ser antes ou depois do 02).
--
-- A interface não recalcula permissões (ver docs/adr/0001). Estas visões
-- devolvem os mesmos dados das tabelas, já filtrados pela RLS, com
-- indicadores calculados pelas funções do schema "privado". Todas usam
-- security_invoker: rodam com as permissões de quem consulta, então a
-- RLS das tabelas continua valendo.
-- =====================================================================

-- quem está logado e o que pode fazer em termos gerais
create view public.meu_perfil with (security_invoker = true) as
select p.id, p.nome, p.email, p.papel,
       p.area_id, a.titulo as area_titulo,
       p.nucleo_id, n.nome as nucleo_nome,
       array(select x.id from public.areas x
              where p.papel = 'diretor' and (x.titular = p.id or x.cobertura = p.id)
              order by x.id) as areas_que_conduz,
       privado.eh_presidencia(p.id) as eh_presidencia,
       (privado.eh_presidencia(p.id) or privado.eh_gestor_pessoas(p.id)) as pode_ajustar_pontos,
       (privado.eh_presidencia(p.id) or privado.eh_gestor_pessoas(p.id)) as pode_cadastrar_pessoas,
       (privado.eh_presidencia(p.id) or privado.dirige(p.id, c.area_gestao_pessoas)) as pode_editar_regras
  from public.pessoas p
  join public.areas a on a.id = p.area_id
  left join public.nucleos n on n.id = p.nucleo_id
  cross join public.config c
 where p.id = privado.eu();

-- demandas visíveis, com o motivo do acesso e o que a pessoa pode fazer
create view public.demandas_visiveis with (security_invoker = true) as
select d.id, d.codigo, d.projeto_id, d.titulo, d.descricao, d.status, d.prioridade, d.prazo,
       d.concluida_em, d.criado_por, d.criado_em, d.atualizado_em,
       pr.nome as projeto_nome, pr.cliente as projeto_cliente,
       n.id as nucleo_id, n.area_id,
       (d.restrito or pr.restrito) as restrita,
       array(select e.pessoa_id from public.demanda_executores e where e.demanda_id = d.id) as executores,
       privado.pode_gerir_demanda(privado.eu(), d.id) as pode_gerir,
       (privado.pode_gerir_demanda(privado.eu(), d.id)
        or exists (select 1 from public.demanda_executores e where e.demanda_id = d.id and e.pessoa_id = privado.eu())) as pode_mudar_status,
       case
         when privado.eh_presidencia(privado.eu()) then 'presidencia'
         when not (d.restrito or pr.restrito) and privado.dirige(privado.eu(), n.area_id) then 'diretoria'
         when not (d.restrito or pr.restrito) and privado.lidera(privado.eu(), n.id) then 'nucleo'
         when exists (select 1 from public.demanda_executores e where e.demanda_id = d.id and e.pessoa_id = privado.eu()) then 'executor'
         else 'excecao'
       end as motivo_acesso
  from public.demandas d
  join public.projetos pr on pr.id = d.projeto_id
  join public.nucleos n on n.id = pr.nucleo_id;

-- reuniões visíveis, com indicadores de gestão, anexos e transcrição
create view public.reunioes_visiveis with (security_invoker = true) as
select r.id, r.titulo, r.data, r.hora, r.escopo, r.escopo_id, r.pauta, r.encerrada,
       r.ata, r.ata_por, r.ata_em, r.criado_por, r.criado_em,
       privado.pode_gerir_reuniao(privado.eu(), r.id) as pode_gerir,
       exists (select 1 from public.reuniao_convocados rc where rc.reuniao_id = r.id and rc.pessoa_id = privado.eu()) as convocado,
       (select count(*)::int from public.anexos a where a.reuniao_id = r.id) as total_anexos,
       exists (select 1 from public.transcricoes t where t.reuniao_id = r.id) as tem_transcricao
  from public.reunioes r;

-- pedidos de acesso visíveis, com situação calculada e ações possíveis
create view public.solicitacoes_visiveis with (security_invoker = true) as
select s.id, s.solicitante, s.beneficiario, s.alvo, s.projeto_id, s.demanda_id, s.justificativa,
       s.valido_ate, s.status, s.decidido_por, s.decidido_em, s.nota, s.revogado_por, s.revogado_em, s.criado_em,
       case when s.status = 'aprovada' and s.valido_ate < privado.hoje() then 'expirada' else s.status::text end as situacao,
       privado.area_alvo(s.id) as area_id,
       privado.alvo_restrito(s.id) as alvo_restrito,
       privado.pode_aprovar(privado.eu(), s.id) as pode_aprovar,
       (s.status = 'aprovada' and s.valido_ate >= privado.hoje()
        and (privado.eh_presidencia(privado.eu()) or s.decidido_por = privado.eu())) as pode_revogar
  from public.solicitacoes s;

grant execute on function privado.pode_aprovar(uuid, uuid) to authenticated;
revoke all on public.meu_perfil, public.demandas_visiveis, public.reunioes_visiveis, public.solicitacoes_visiveis from anon;
-- o Supabase concede insert/update/delete por padrão em objetos novos; visões são só leitura
revoke insert, update, delete, truncate on public.meu_perfil, public.demandas_visiveis, public.reunioes_visiveis, public.solicitacoes_visiveis from authenticated;
grant select on public.meu_perfil, public.demandas_visiveis, public.reunioes_visiveis, public.solicitacoes_visiveis to authenticated;
