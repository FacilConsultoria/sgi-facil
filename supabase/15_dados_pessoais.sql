-- =====================================================================
-- SGI Fácil Consultoria · 15 · Dados pessoais
-- Rodar depois do 14.
--
-- 1) O e-mail das pessoas deixa de ser legível por todas: a coluna sai da leitura
--    direta de public.pessoas. Cada pessoa continua vendo o próprio e-mail, e quem
--    cadastra pessoas continua vendo o de todas (pelas visões meu_perfil e
--    equipe_pessoas, que passam a pegar o e-mail por uma função do banco).
-- 2) Dados pessoais (nome completo, RGA, CPF, data de nascimento, gênero) numa
--    tabela à parte. Lê quem é a dona ou o dono dos dados e a Presidente. Ninguém
--    escreve na tabela diretamente: a pessoa grava os próprios dados por
--    public.salvar_meus_dados, que valida tudo e só mexe no registro de quem chama.
-- 3) meu_perfil ganha dados_pendentes (verdadeiro enquanto a pessoa não preencheu).
-- Os valores (CPF, RGA, nascimento, gênero) não vão para a auditoria.
-- =====================================================================

-- ---------- validação de CPF (dígitos verificadores) ----------
create or replace function privado.cpf_valido(p_cpf text) returns boolean
language plpgsql immutable as $$
declare
  d int[] := '{}'; soma int; i int; v1 int; v2 int;
begin
  if p_cpf is null or p_cpf !~ '^[0-9]{11}$' or p_cpf ~ '^(.)\1{10}$' then return false; end if;
  for i in 1..11 loop d[i] := substr(p_cpf, i, 1)::int; end loop;
  soma := 0;
  for i in 1..9 loop soma := soma + d[i] * (11 - i); end loop;
  v1 := (soma * 10) % 11; if v1 = 10 then v1 := 0; end if;
  soma := 0;
  for i in 1..10 loop soma := soma + d[i] * (12 - i); end loop;
  v2 := (soma * 10) % 11; if v2 = 10 then v2 := 0; end if;
  return v1 = d[10] and v2 = d[11];
end $$;

-- ---------- dados pessoais ----------
create table public.dados_pessoais (
  pessoa_id     uuid primary key references public.pessoas(id) on delete cascade,
  nome_completo text not null check (length(nome_completo) between 5 and 120),
  rga           text not null check (rga ~ '^[A-Z0-9]{12}$'),
  cpf           text not null check (cpf ~ '^[0-9]{11}$'),
  nascimento    date not null,
  genero        text not null check (genero in ('feminino', 'masculino', 'outro', 'nao_informar')),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.dados_pessoais enable row level security;
create policy ler on public.dados_pessoais for select to authenticated
  using (pessoa_id = (select privado.eu()) or privado.eh_presidente((select privado.eu())));

revoke all on public.dados_pessoais from anon, authenticated;
grant select on public.dados_pessoais to authenticated;

create or replace function public.salvar_meus_dados(p_nome_completo text, p_rga text, p_cpf text, p_nascimento date, p_genero text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_eu     uuid := privado.eu();
  v_nome   text := regexp_replace(trim(coalesce(p_nome_completo, '')), '\s+', ' ', 'g');
  v_rga    text := upper(regexp_replace(coalesce(p_rga, ''), '[^A-Za-z0-9]', '', 'g'));
  v_cpf    text := regexp_replace(coalesce(p_cpf, ''), '[^0-9]', '', 'g');
begin
  if v_eu is null then raise exception 'Seu e-mail não tem cadastro ativo no SGI.'; end if;
  if length(v_nome) < 5 or length(v_nome) > 120 or v_nome !~ '^\S+ \S+' then
    raise exception 'Informe o nome completo, com nome e sobrenome.';
  end if;
  if v_rga !~ '^[A-Z0-9]{12}$' then raise exception 'O RGA tem 12 caracteres (letras e números).'; end if;
  if not privado.cpf_valido(v_cpf) then raise exception 'CPF inválido. Confira os 11 números.'; end if;
  if p_nascimento is null or p_nascimento > privado.hoje() or p_nascimento < date '1930-01-01' then
    raise exception 'Informe uma data de nascimento válida.';
  end if;
  if p_genero is null or p_genero not in ('feminino', 'masculino', 'outro', 'nao_informar') then
    raise exception 'Escolha uma opção de gênero.';
  end if;

  insert into public.dados_pessoais (pessoa_id, nome_completo, rga, cpf, nascimento, genero)
  values (v_eu, v_nome, v_rga, v_cpf, p_nascimento, p_genero)
  on conflict (pessoa_id) do update
     set nome_completo = excluded.nome_completo, rga = excluded.rga, cpf = excluded.cpf,
         nascimento = excluded.nascimento, genero = excluded.genero, atualizado_em = now();
  perform privado.registrar('Atualizou dados pessoais', (select nome from public.pessoas where id = v_eu), p_membro => v_eu);
end $$;

revoke all on function public.salvar_meus_dados(text, text, text, date, text) from public, anon;
grant execute on function public.salvar_meus_dados(text, text, text, date, text) to authenticated;

-- ---------- e-mail: só a própria pessoa e quem cadastra pessoas ----------
create or replace function privado.email_visivel(p_pessoa uuid) returns text
language sql stable security definer set search_path = public as $$
  select case when p.id = privado.eu() or privado.pode_cadastrar_pessoas(privado.eu()) then p.email end
    from public.pessoas p where p.id = p_pessoa
$$;

revoke all on function privado.cpf_valido(text), privado.email_visivel(uuid) from public;
grant execute on function privado.email_visivel(uuid) to authenticated;

create or replace view public.equipe_pessoas with (security_invoker = true) as
select p.id, p.nome, p.papel, p.area_id, p.nucleo_id, p.curso, p.ativo,
       privado.email_visivel(p.id) as email,
       privado.pode_editar_pessoa(privado.eu(), p.id) as pode_editar
  from public.pessoas p
 where p.ativo or privado.pode_cadastrar_pessoas(privado.eu());

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
       not exists (select 1 from public.dados_pessoais d where d.pessoa_id = p.id) as dados_pendentes
  from public.pessoas p
  join public.areas a on a.id = p.area_id
  left join public.nucleos n on n.id = p.nucleo_id
  cross join public.config c
 where p.id = privado.eu();

-- a leitura direta de pessoas passa a não incluir o e-mail (nem o vínculo de login)
revoke select on public.pessoas from authenticated;
grant select (id, nome, papel, area_id, nucleo_id, curso, ativo, criado_em) on public.pessoas to authenticated;
