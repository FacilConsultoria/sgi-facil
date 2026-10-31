-- =====================================================================
-- SGI Fácil Consultoria · 11 · Estrutura e equipe
-- Rodar depois do 10.
--
-- Dá à tela o que ela precisa sem recalcular permissões (ver docs/adr/0001):
-- as pessoas da equipe (o e-mail só para quem cadastra), quem pode editar cada
-- uma, os cargos e áreas que cada pessoa pode usar no cadastro e quem pode
-- definir titulares e coberturas das áreas.
--
-- Também fecha uma brecha das regras de cadastro: a Assessoria de Presidência
-- tem acesso de Presidência (07), então cadastrar ou mover alguém para a área
-- da Presidência passou a exigir a Presidência (antes, a Gente e Gestão podia
-- criar uma "assessora" e dar a ela esse acesso). Além disso:
--   - ninguém altera o próprio cadastro (cargo, área ou situação);
--   - núcleo é obrigatório para gerência, assessoria e membro;
--   - quem conduz uma área (titular ou cobertura) não pode ser desativado nem
--     trocar de cargo antes de a área ter outro responsável;
--   - titular e cobertura de uma área são Presidente, Vice ou diretoria ativa.
-- =====================================================================

-- ---------- regras compartilhadas ----------
create or replace function privado.pode_cadastrar_pessoas(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (privado.eh_presidencia(p) or privado.eh_gestor_pessoas(p))
$$;

-- cadastros que só a Presidência faz: Presidência, Vice, diretorias e qualquer pessoa na área da Presidência
create or replace function privado.cadastro_exige_presidencia(p_papel public.papel, p_area text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_papel in ('presidente','vice','diretor') or p_area = (select area_presidencia from public.config)
$$;

create or replace function privado.pode_editar_pessoa(p uuid, p_alvo uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.pode_cadastrar_pessoas(p) and p <> p_alvo
     and exists (select 1 from public.pessoas x
                  where x.id = p_alvo
                    and (privado.eh_presidencia(p) or not privado.cadastro_exige_presidencia(x.papel, x.area_id)))
$$;

-- confere os campos de um cadastro (novo ou alterado); a mesma conferência vale para os dois
create or replace function privado.conferir_cadastro(p_nome text, p_papel public.papel, p_area text, p_nucleo text) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_pres text := (select area_presidencia from public.config);
begin
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome.'; end if;
  if not exists (select 1 from public.areas where id = p_area) then raise exception 'Área não encontrada.'; end if;
  if p_papel in ('presidente','vice') and p_area is distinct from v_pres then
    raise exception 'Presidente e Vice-Presidente pertencem à Presidência.';
  end if;
  if p_papel in ('gerente','assessor','membro') and p_nucleo is null then raise exception 'Escolha o núcleo.'; end if;
  if p_nucleo is not null and privado.area_do_nucleo(p_nucleo) is distinct from p_area then
    raise exception 'O núcleo escolhido não pertence a essa área.';
  end if;
end $$;

-- ---------- cadastrar ----------
create or replace function public.cadastrar_pessoa(p_email text, p_nome text, p_papel public.papel,
  p_area text, p_nucleo text default null, p_curso text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid; v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not privado.pode_cadastrar_pessoas(v_eu) then
    raise exception 'Só a Presidência e a Gente e Gestão cadastram pessoas.';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Informe um e-mail válido.'; end if;
  perform privado.conferir_cadastro(p_nome, p_papel, p_area, p_nucleo);
  if privado.cadastro_exige_presidencia(p_papel, p_area) and not privado.eh_presidencia(v_eu) then
    raise exception 'Só a Presidência cadastra pessoas da Presidência e das diretorias.';
  end if;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id, curso, auth_user_id)
  values (v_email, trim(p_nome), p_papel, p_area, p_nucleo, nullif(trim(coalesce(p_curso, '')), ''),
          (select id from auth.users where lower(email) = v_email))
  returning id into v_id;
  perform privado.registrar('Cadastrou pessoa', trim(p_nome) || ' (' || p_papel || ')', p_membro => v_id);
  return v_id;
exception when unique_violation then
  raise exception 'Já existe uma pessoa cadastrada com o e-mail %.', v_email;
end $$;

-- ---------- alterar ----------
create or replace function public.atualizar_pessoa(p_id uuid, p_nome text, p_papel public.papel,
  p_area text, p_nucleo text, p_curso text, p_ativo boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_antes public.pessoas%rowtype; v_area text;
begin
  select * into v_antes from public.pessoas where id = p_id;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
  if not privado.pode_cadastrar_pessoas(v_eu) then
    raise exception 'Só a Presidência e a Gente e Gestão alteram cadastros.';
  end if;
  if p_id = v_eu then raise exception 'Ninguém altera o próprio cadastro.'; end if;
  if (privado.cadastro_exige_presidencia(v_antes.papel, v_antes.area_id) or privado.cadastro_exige_presidencia(p_papel, p_area))
     and not privado.eh_presidencia(v_eu) then
    raise exception 'Só a Presidência altera cadastros da Presidência e das diretorias.';
  end if;
  perform privado.conferir_cadastro(p_nome, p_papel, p_area, p_nucleo);
  select a.titulo into v_area from public.areas a where a.titular = p_id or a.cobertura = p_id order by a.id limit 1;
  if v_area is not null and (not p_ativo or p_papel not in ('presidente','vice','diretor')) then
    raise exception 'Esta pessoa conduz a área %. Troque o titular ou a cobertura antes de desativá-la ou mudar o cargo.', v_area;
  end if;
  update public.pessoas set nome = trim(p_nome), papel = p_papel, area_id = p_area, nucleo_id = p_nucleo,
         curso = nullif(trim(coalesce(p_curso, '')), ''), ativo = p_ativo where id = p_id;
  perform privado.registrar('Alterou cadastro', trim(p_nome), p_membro => p_id);
end $$;

-- ---------- titulares e coberturas ----------
create or replace function public.definir_lideranca_area(p_area text, p_titular uuid, p_cobertura uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  if not privado.eh_presidencia(v_eu) then raise exception 'Só a Presidência define titulares e coberturas.'; end if;
  if not exists (select 1 from public.areas where id = p_area) then raise exception 'Área não encontrada.'; end if;
  if exists (select 1 from unnest(array[p_titular, p_cobertura]) x
              where x is not null and coalesce(privado.papel_de(x) not in ('presidente','vice','diretor'), true)) then
    raise exception 'Titular e cobertura precisam ser Presidente, Vice-Presidente ou diretoria ativa.';
  end if;
  if p_titular is not null and p_titular = p_cobertura then
    raise exception 'Titular e cobertura devem ser pessoas diferentes.';
  end if;
  update public.areas set titular = p_titular, cobertura = p_cobertura where id = p_area;
  perform privado.registrar('Definiu liderança', p_area, p_area => p_area);
end $$;

-- ---------- visões para a tela ----------
-- pessoas da equipe: o diretório é aberto a quem tem cadastro (decisão do 01); só quem cadastra vê o e-mail
-- e as pessoas desativadas
create view public.equipe_pessoas with (security_invoker = true) as
select p.id, p.nome, p.papel, p.area_id, p.nucleo_id, p.curso, p.ativo,
       case when privado.pode_cadastrar_pessoas(privado.eu()) then p.email end as email,
       privado.pode_editar_pessoa(privado.eu(), p.id) as pode_editar
  from public.pessoas p
 where p.ativo or privado.pode_cadastrar_pessoas(privado.eu());

-- cargos que quem consulta pode dar a alguém (vazio para quem não cadastra)
create view public.papeis_cadastraveis with (security_invoker = true) as
select r::text as papel
  from unnest(enum_range(null::public.papel)) r
 where privado.pode_cadastrar_pessoas(privado.eu())
   and (privado.eh_presidencia(privado.eu()) or r in ('gerente','assessor','membro'));

-- áreas em que quem consulta pode cadastrar (a da Presidência só a Presidência)
create view public.areas_cadastraveis with (security_invoker = true) as
select a.id, a.titulo
  from public.areas a
 where privado.pode_cadastrar_pessoas(privado.eu())
   and (privado.eh_presidencia(privado.eu()) or a.id <> (select area_presidencia from public.config));

-- áreas com titular, cobertura, se é a área da Presidência e se quem consulta pode definir os responsáveis
create view public.areas_da_estrutura with (security_invoker = true) as
select a.id, a.titulo, a.sigla, a.titular, a.cobertura, a.nota,
       privado.eh_presidencia(privado.eu()) as pode_definir_lideranca,
       (a.id = (select c.area_presidencia from public.config c)) as area_da_presidencia
  from public.areas a;

-- quem pode ser titular ou cobertura (só aparece para quem define)
create view public.candidatos_a_lideranca with (security_invoker = true) as
select p.id, p.nome, p.papel
  from public.pessoas p
 where p.ativo and p.papel in ('presidente','vice','diretor') and privado.eh_presidencia(privado.eu());

grant execute on function privado.pode_cadastrar_pessoas(uuid), privado.pode_editar_pessoa(uuid, uuid),
                          privado.cadastro_exige_presidencia(public.papel, text), privado.eh_gestor_pessoas(uuid),
                          privado.eh_presidencia(uuid), privado.area_do_nucleo(text), privado.papel_de(uuid) to authenticated;
revoke all on public.equipe_pessoas, public.papeis_cadastraveis, public.areas_cadastraveis,
              public.areas_da_estrutura, public.candidatos_a_lideranca from anon;
-- o Supabase concede insert/update/delete por padrão em objetos novos; visões são só leitura
revoke insert, update, delete, truncate on public.equipe_pessoas, public.papeis_cadastraveis, public.areas_cadastraveis,
                                           public.areas_da_estrutura, public.candidatos_a_lideranca from authenticated;
grant select on public.equipe_pessoas, public.papeis_cadastraveis, public.areas_cadastraveis,
                public.areas_da_estrutura, public.candidatos_a_lideranca to authenticated;
