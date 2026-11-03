-- =====================================================================
-- SGI Fácil Consultoria · 17 · Disponibilidade semanal
-- Rodar depois do 16.
--
-- Cada pessoa marca uma vez, numa grade semanal (dia da semana × hora), os horários em que
-- costuma poder participar de reuniões e atividades. A grade serve de referência para
-- escolher horários; não é agenda de compromissos.
--
-- Um horário é um número: dia * 24 + hora, com dia 0 = segunda-feira ... 6 = domingo e a
-- hora de início (de 7 a 21, ou seja, das 7h às 22h). Uma linha por pessoa guarda a lista.
-- Quem lê: a própria pessoa e quem enxerga a pessoa pela hierarquia (a mesma regra da
-- pontuação: Presidência vê todas, diretoria as das suas áreas, gerência as do núcleo).
-- Quem grava: só a própria pessoa, por public.salvar_minha_disponibilidade.
-- =====================================================================

create table public.disponibilidade_semanal (
  pessoa_id     uuid primary key references public.pessoas(id) on delete cascade,
  slots         smallint[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

alter table public.disponibilidade_semanal enable row level security;
create policy ler on public.disponibilidade_semanal for select to authenticated
  using (pessoa_id = (select privado.eu()) or privado.pode_ver_pontuacao((select privado.eu()), pessoa_id));

revoke all on public.disponibilidade_semanal from anon, authenticated;
grant select on public.disponibilidade_semanal to authenticated;

create or replace function public.salvar_minha_disponibilidade(p_slots smallint[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_eu    uuid := privado.eu();
  v_slots smallint[];
begin
  if v_eu is null then raise exception 'Seu e-mail não tem cadastro ativo no SGI.'; end if;
  if exists (select 1 from unnest(coalesce(p_slots, '{}'::smallint[])) s
              where s is null or s < 0 or s > 167 or s % 24 < 7 or s % 24 > 21) then
    raise exception 'Horário fora da grade (segunda a domingo, das 7h às 22h).';
  end if;
  select coalesce(array_agg(distinct s order by s), '{}'::smallint[]) into v_slots from unnest(coalesce(p_slots, '{}'::smallint[])) s;

  insert into public.disponibilidade_semanal (pessoa_id, slots) values (v_eu, v_slots)
  on conflict (pessoa_id) do update set slots = excluded.slots, atualizado_em = now();
end $$;

revoke all on function public.salvar_minha_disponibilidade(smallint[]) from public, anon;
grant execute on function public.salvar_minha_disponibilidade(smallint[]) to authenticated;

-- as pessoas cuja grade quem consulta pode ver, e se já preencheram
create or replace view public.disponibilidade_pessoas with (security_invoker = true) as
select p.id, p.nome, coalesce(n.nome, a.titulo) as setor,
       (d.pessoa_id is not null) as preenchida, d.atualizado_em
  from public.pessoas p
  join public.areas a on a.id = p.area_id
  left join public.nucleos n on n.id = p.nucleo_id
  left join public.disponibilidade_semanal d on d.pessoa_id = p.id
 where p.ativo and (p.id = privado.eu() or privado.pode_ver_pontuacao(privado.eu(), p.id));

revoke all on public.disponibilidade_pessoas from anon;
revoke insert, update, delete, truncate on public.disponibilidade_pessoas from authenticated;
grant select on public.disponibilidade_pessoas to authenticated;
