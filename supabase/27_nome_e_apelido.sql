-- =====================================================================
-- SGI Fácil Consultoria · 27 · Nome completo e apelido
-- Rodar depois do 26.
--
-- pessoas.nome_completo  nome oficial; só a própria pessoa altera (definir_meu_nome)
-- pessoas.apelido        opcional; só a própria pessoa define
-- pessoas.nome           o nome mostrado em todo o sistema (rankings, listas, recados):
--                        o apelido, se houver, senão o nome completo. Mantido por gatilho,
--                        então quem cadastra pessoas não muda mais o nome de ninguém.
-- Quem já preencheu os dados pessoais passa a aparecer com o nome completo de lá
-- (desfaz nomes trocados por terceiros). As iniciais usam o nome completo.
-- =====================================================================

alter table public.pessoas
  add column if not exists nome_completo text,
  add column if not exists apelido text check (apelido is null or length(apelido) between 2 and 40);

-- todos começam com o nome completo: o dos dados pessoais, se preenchido; senão o nome atual
update public.pessoas p
   set nome_completo = coalesce(nullif(trim(d.nome_completo), ''), p.nome),
       nome = coalesce(nullif(trim(d.nome_completo), ''), p.nome)
  from public.pessoas x
  left join public.dados_pessoais d on d.pessoa_id = x.id
 where x.id = p.id and p.nome_completo is null;

alter table public.pessoas alter column nome_completo set not null;

-- nome mostrado = apelido ou nome completo; o nome completo só muda quando alguém o define de propósito
create or replace function privado.manter_nome_mostrado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.nome_completo := coalesce(nullif(trim(new.nome_completo), ''), trim(new.nome));
  else
    new.nome_completo := coalesce(nullif(trim(new.nome_completo), ''), old.nome_completo);
  end if;
  new.apelido := nullif(trim(coalesce(new.apelido, '')), '');
  new.nome := coalesce(new.apelido, new.nome_completo);
  return new;
end $$;

drop trigger if exists sgi_nome_mostrado on public.pessoas;
create trigger sgi_nome_mostrado before insert or update on public.pessoas
  for each row execute function privado.manter_nome_mostrado();
revoke all on function privado.manter_nome_mostrado() from public;

-- a própria pessoa define o nome completo e o apelido (vazio tira o apelido)
create or replace function public.definir_meu_nome(p_nome_completo text, p_apelido text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_nome text := regexp_replace(trim(coalesce(p_nome_completo, '')), '\s+', ' ', 'g');
        v_apelido text := nullif(regexp_replace(trim(coalesce(p_apelido, '')), '\s+', ' ', 'g'), '');
begin
  if length(v_nome) < 5 or position(' ' in v_nome) = 0 then raise exception 'Informe o nome completo, com nome e sobrenome.'; end if;
  if length(v_nome) > 120 then raise exception 'O nome tem no máximo 120 caracteres.'; end if;
  if v_apelido is not null and length(v_apelido) not between 2 and 40 then raise exception 'O apelido tem de 2 a 40 caracteres.'; end if;
  update public.pessoas set nome_completo = v_nome, apelido = v_apelido where id = v_eu;
  -- mantém os dados pessoais em acordo, se já preenchidos
  update public.dados_pessoais set nome_completo = v_nome where pessoa_id = v_eu and nome_completo is distinct from v_nome;
  perform privado.registrar('Alterou o próprio nome', coalesce(v_apelido || ' (' || v_nome || ')', v_nome), p_membro => v_eu);
end $$;

revoke all on function public.definir_meu_nome(text, text) from public, anon;
grant execute on function public.definir_meu_nome(text, text) to authenticated;
