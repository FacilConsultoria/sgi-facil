-- =====================================================================
-- SGI Fácil Consultoria · 22 · Dados pessoais: cada diretoria lê os do seu time
-- Rodar depois do 21.
--
-- Quem lê os dados pessoais de uma pessoa (nome completo, RGA, CPF, nascimento e gênero):
--   - a própria pessoa;
--   - a Presidente e a Assessoria de Presidência (todas as pessoas, desde o 21);
--   - NOVO: quem conduz a área da pessoa (titular ou cobertura da diretoria; inclui a Vice na área
--     que ela conduz), para gerências, assessorias e membros dessa área. Uma diretoria não lê os
--     dados de outra diretoria, da Vice nem da Presidente.
-- Continua igual: só a própria pessoa altera os próprios dados.
--
-- equipe_pessoas ganha pode_ver_dados e dados_preenchidos (só para quem pode ver), e meu_perfil
-- ganha ve_dados_do_time, que o site usa para mostrar a aba "Dados do time" em Estrutura e equipe.
-- =====================================================================

create or replace function privado.pode_ver_dados_de(p uuid, p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (
       p = p_pessoa
    or privado.pode_ver_dados_pessoais(p)
    or exists (select 1 from public.pessoas x
                where x.id = p_pessoa and x.papel not in ('presidente','vice','diretor')
                  and privado.dirige(p, x.area_id)))
$$;
revoke all on function privado.pode_ver_dados_de(uuid, uuid) from public;
grant execute on function privado.pode_ver_dados_de(uuid, uuid) to authenticated;

drop policy ler on public.dados_pessoais;
create policy ler on public.dados_pessoais for select to authenticated
  using (privado.pode_ver_dados_de((select privado.eu()), pessoa_id));

-- a mesma lista do 15, com as colunas novas no fim
create or replace view public.equipe_pessoas with (security_invoker = true) as
select p.id, p.nome, p.papel, p.area_id, p.nucleo_id, p.curso, p.ativo,
       privado.email_visivel(p.id) as email,
       privado.pode_editar_pessoa(privado.eu(), p.id) as pode_editar,
       privado.pode_ver_dados_de(privado.eu(), p.id) as pode_ver_dados,
       case when privado.pode_ver_dados_de(privado.eu(), p.id)
            then exists (select 1 from public.dados_pessoais d where d.pessoa_id = p.id) end as dados_preenchidos
  from public.pessoas p
 where p.ativo or privado.pode_cadastrar_pessoas(privado.eu());

-- o mesmo perfil do 21, com o indicador novo no fim
create or replace view public.meu_perfil with (security_invoker = true) as
select p.id, p.nome, privado.email_visivel(p.id) as email, p.papel,
       p.area_id, a.titulo as area_titulo,
       p.nucleo_id, n.nome as nucleo_nome,
       array(select x.id from public.areas x
              where p.papel in ('diretor','vice') and (x.titular = p.id or x.cobertura = p.id)
              order by x.id) as areas_que_conduz,
       privado.eh_presidencia(p.id) as eh_presidencia,
       privado.eh_presidente(p.id) as eh_presidente,
       (privado.eh_presidencia(p.id) or privado.eh_gestor_pessoas(p.id)) as pode_ajustar_pontos,
       (privado.eh_presidencia(p.id) or privado.eh_gestor_pessoas(p.id)) as pode_cadastrar_pessoas,
       (privado.eh_presidencia(p.id) or privado.dirige(p.id, c.area_gestao_pessoas)) as pode_editar_regras,
       not exists (select 1 from public.dados_pessoais d where d.pessoa_id = p.id) as dados_pendentes,
       privado.pode_ver_dados_pessoais(p.id) as pode_ver_dados_pessoais,
       exists (select 1 from public.pessoas x where x.id <> p.id and x.ativo and privado.pode_ver_dados_de(p.id, x.id)) as ve_dados_do_time
  from public.pessoas p
  join public.areas a on a.id = p.area_id
  left join public.nucleos n on n.id = p.nucleo_id
  cross join public.config c
 where p.id = privado.eu();
