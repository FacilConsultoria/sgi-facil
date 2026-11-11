-- =====================================================================
-- SGI Fácil Consultoria · 21 · Dados pessoais: a Assessoria de Presidência também lê
-- Rodar depois do 20.
--
-- Antes (15): os dados pessoais (nome completo, RGA, CPF, nascimento e gênero) eram lidos só pela
-- própria pessoa e pela Presidente. Agora a Assessoria de Presidência também lê.
-- Continua igual: só a própria pessoa altera os próprios dados; Vice, diretorias, gerências e membros
-- não leem os dados dos outros.
-- O perfil (meu_perfil) ganha o indicador pode_ver_dados_pessoais, que o site usa para mostrar o
-- botão "Dados pessoais" em Estrutura e equipe.
-- =====================================================================

create or replace function privado.pode_ver_dados_pessoais(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (privado.eh_presidente(p) or privado.eh_assessoria_presidencia(p))
$$;
revoke all on function privado.pode_ver_dados_pessoais(uuid) from public;
grant execute on function privado.pode_ver_dados_pessoais(uuid) to authenticated;

drop policy ler on public.dados_pessoais;
create policy ler on public.dados_pessoais for select to authenticated
  using (pessoa_id = (select privado.eu()) or privado.pode_ver_dados_pessoais((select privado.eu())));

-- o mesmo perfil do 15, com o indicador novo no fim
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
       privado.pode_ver_dados_pessoais(p.id) as pode_ver_dados_pessoais
  from public.pessoas p
  join public.areas a on a.id = p.area_id
  left join public.nucleos n on n.id = p.nucleo_id
  cross join public.config c
 where p.id = privado.eu();
