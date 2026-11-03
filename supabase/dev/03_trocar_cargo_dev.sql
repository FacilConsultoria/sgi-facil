-- =====================================================================
-- SGI Fácil Consultoria · AMBIENTE DE DESENVOLVIMENTO · trocar o cargo da conta de teste
-- Rodar SÓ no projeto de desenvolvimento (sgi-facil-dev), depois do dev/02_dados_dev.sql.
-- Nunca na produção: o script se recusa a rodar num banco com pessoas reais.
--
-- Cria public.dev_trocar_meu_cargo(papel, área, núcleo): a conta de teste (e só ela) passa a ocupar
-- outro cargo para ver a plataforma pela ótica dele (Presidência, Vice, diretoria de uma área,
-- gerência, assessoria ou membro de um núcleo). As outras pessoas continuam como estão; as
-- lideranças das áreas voltam ao que eram no 02_dados_dev a cada troca.
-- O site de desenvolvimento mostra a escolha na faixa do topo ("Ver como").
-- =====================================================================

do $$
begin
  if not exists (select 1 from public.pessoas where email like '%@example.com') then
    raise exception 'Este script é só para o ambiente de desenvolvimento: rode antes o dev/02_dados_dev.sql.';
  end if;
  if (select count(*) from public.pessoas where email not like '%@example.com') <> 1 then
    raise exception 'Este script é só para o ambiente de desenvolvimento: o banco tem pessoas reais.';
  end if;
end $$;

-- a conta de teste e as lideranças das áreas como ficaram no 02_dados_dev
create table privado.ambiente_dev (
  id        boolean primary key default true check (id),
  conta     uuid not null references public.pessoas(id),
  titulares jsonb not null
);
-- fechada a todos: só a função abaixo (security definer) lê; o RLS sem políticas é uma trava a mais
alter table privado.ambiente_dev enable row level security;
revoke all on privado.ambiente_dev from public, anon, authenticated;

insert into privado.ambiente_dev (conta, titulares)
select p.id, (select jsonb_object_agg(a.id, jsonb_build_object('titular', a.titular, 'cobertura', a.cobertura)) from public.areas a)
  from public.pessoas p
 where p.email not like '%@example.com';

-- papel e, conforme o papel: área (diretoria; para a Vice, a área que ela conduz) ou núcleo (gerência, assessoria, membro)
create or replace function public.dev_trocar_meu_cargo(p_papel public.papel, p_area text default null, p_nucleo text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_eu     uuid := privado.exigir_login();
  v_conta  uuid;
  v_inicio jsonb;
  v_area   text;
  v_nucleo text;
  v_conduz text;
begin
  select conta, titulares into v_conta, v_inicio from privado.ambiente_dev;
  if v_conta is null or v_conta <> v_eu then
    raise exception 'Só a conta de teste do ambiente de desenvolvimento troca de cargo.';
  end if;
  if p_papel is null then raise exception 'Escolha o cargo.'; end if;

  if p_papel in ('presidente', 'vice') then
    v_area := 'pres';
    if p_papel = 'vice' then
      v_conduz := coalesce(p_area, 'fin');
      if v_conduz = 'pres' or not exists (select 1 from public.areas where id = v_conduz) then
        raise exception 'Escolha a diretoria que a Vice-Presidência conduz.';
      end if;
    end if;
  elsif p_papel = 'diretor' then
    if p_area is null or p_area = 'pres' or not exists (select 1 from public.areas where id = p_area) then
      raise exception 'Escolha a diretoria.';
    end if;
    v_area := p_area;
    v_conduz := p_area;
  else
    select area_id into v_area from public.nucleos where id = p_nucleo;
    if v_area is null then raise exception 'Escolha o núcleo.'; end if;
    v_nucleo := p_nucleo;
  end if;

  -- lideranças das áreas como no início, sem a conta de teste
  update public.areas a
     set titular   = nullif((v_inicio -> a.id ->> 'titular')::uuid, v_eu),
         cobertura = nullif((v_inicio -> a.id ->> 'cobertura')::uuid, v_eu)
   where a.id is not null;

  update public.pessoas set papel = p_papel, area_id = v_area, nucleo_id = v_nucleo where id = v_eu;

  if p_papel = 'presidente' then
    -- de volta ao início: titular da Presidência e o que mais cobria
    update public.areas a
       set titular   = case when (v_inicio -> a.id ->> 'titular')::uuid = v_eu then v_eu else a.titular end,
           cobertura = case when (v_inicio -> a.id ->> 'cobertura')::uuid = v_eu then v_eu else a.cobertura end
     where a.id is not null;
  elsif v_conduz is not null then
    update public.areas set titular = v_eu where id = v_conduz;
  end if;

  perform privado.registrar('Trocou o próprio cargo (desenvolvimento)',
    p_papel::text || coalesce(' · ' || coalesce(v_nucleo, v_conduz), ''));
end $$;

revoke all on function public.dev_trocar_meu_cargo(public.papel, text, text) from public, anon;
grant execute on function public.dev_trocar_meu_cargo(public.papel, text, text) to authenticated;
