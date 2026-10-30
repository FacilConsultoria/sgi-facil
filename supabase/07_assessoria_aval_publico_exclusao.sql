-- =====================================================================
-- SGI Fácil Consultoria · 07 · Assessoria de Presidência, avais, público por
-- pessoas e exclusão de reuniões
-- Rodar depois do 06 (que precisa ter terminado antes).
--
-- 1. A Assessoria de Presidência passa a ter os mesmos acessos da Presidência.
--    Duas coisas dela dependem de aval da Presidente ou da Vice: ajustar a
--    própria pontuação e aprovar acessos por exceção.
-- 2. Avais: pedido que a Presidente ou a Vice aprovam ou negam. Ao aprovar, o
--    sistema executa a ação. Também vale para justificar a falta de um diretor
--    numa reunião.
-- 3. Reunião para pessoas escolhidas, e diretorias também agendam para todos.
-- 4. Excluir reunião (encerrada: só Presidência, Vice e diretoria que organiza,
--    com motivo; as faltas são desconsideradas e os arquivos saem junto).
-- =====================================================================

-- ---------- 1. quem é quem ----------
-- Assessoria de Presidência: papel "assessor" dentro da área da Presidência
create or replace function privado.eh_assessoria_presidencia(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pessoas x cross join public.config c
                  where x.id = p and x.ativo and x.papel = 'assessor' and x.area_id = c.area_presidencia)
$$;

-- Presidente ou Vice: quem dá o aval
create or replace function privado.eh_presex(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(privado.papel_de(p) in ('presidente','vice'), false)
$$;

-- acesso de Presidência: Presidente, Vice e Assessoria de Presidência
create or replace function privado.eh_presidencia(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(privado.papel_de(p) in ('presidente','vice'), false) or privado.eh_assessoria_presidencia(p)
$$;

-- ---------- 2. público das reuniões ----------
-- quem pode ser escolhido pessoalmente por p: Presidência e diretorias, qualquer pessoa ativa;
-- gerência, só o próprio núcleo
create or replace function privado.pode_convocar(p uuid, p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pessoas x where x.id = p_pessoa and x.ativo) and (
       privado.eh_presidencia(p)
    or privado.papel_de(p) = 'diretor'
    or (privado.papel_de(p) = 'gerente' and exists (
          select 1 from public.pessoas x join public.pessoas y on y.id = p
           where x.id = p_pessoa and x.nucleo_id is not null and x.nucleo_id = y.nucleo_id)))
$$;

create or replace function privado.pode_criar_reuniao(p uuid, p_escopo public.escopo_reuniao, p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when privado.eh_presidencia(p) then true
    when privado.papel_de(p) = 'assessor' then p_escopo in ('geral','presidencia')
    when privado.papel_de(p) = 'diretor' then
         p_escopo in ('geral','pessoas')
      or (p_escopo = 'area' and privado.dirige(p, p_id))
      or (p_escopo = 'nucleo' and privado.dirige(p, privado.area_do_nucleo(p_id)))
    when privado.papel_de(p) = 'gerente' then
         p_escopo = 'pessoas'
      or (p_escopo = 'nucleo' and privado.lidera(p, p_id))
    else false end
$$;

-- público "pessoas" não tem id de área ou núcleo
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.reunioes'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%escopo_id IS NULL%'
  loop
    execute format('alter table public.reunioes drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.reunioes add constraint reunioes_publico_check
  check ((escopo in ('geral','presidencia','pessoas')) = (escopo_id is null));

-- p_pessoas só vale para o público "pessoas"; quem agenda entra na lista sozinho
drop function if exists public.criar_reuniao(text, date, time, public.escopo_reuniao, text, text);
create or replace function public.criar_reuniao(p_titulo text, p_data date, p_hora time,
  p_escopo public.escopo_reuniao, p_escopo_id text, p_pauta text, p_pessoas uuid[] default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid;
begin
  if p_escopo = 'area' and not exists (select 1 from public.areas where id = p_escopo_id) then raise exception 'Área não encontrada.'; end if;
  if p_escopo = 'nucleo' and not exists (select 1 from public.nucleos where id = p_escopo_id) then raise exception 'Núcleo não encontrado.'; end if;
  if not privado.pode_criar_reuniao(v_eu, p_escopo, p_escopo_id) then raise exception 'Escolha um público da lista.'; end if;
  if p_escopo = 'pessoas' then
    if coalesce(array_length(p_pessoas, 1), 0) = 0 then raise exception 'Escolha pelo menos uma pessoa para convocar.'; end if;
    if exists (select 1 from unnest(p_pessoas) x where not privado.pode_convocar(v_eu, x)) then
      raise exception 'Há pessoas fora do seu escopo.';
    end if;
  end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Dê um título à reunião.'; end if;
  if p_data is null or p_hora is null then raise exception 'Informe data e horário.'; end if;
  insert into public.reunioes (titulo, data, hora, escopo, escopo_id, pauta, criado_por)
  values (trim(p_titulo), p_data, p_hora, p_escopo,
          case when p_escopo in ('geral','presidencia','pessoas') then null else p_escopo_id end,
          coalesce(trim(p_pauta), ''), v_eu)
  returning id into v_id;
  if p_escopo = 'pessoas' then
    insert into public.reuniao_convocados (reuniao_id, pessoa_id)
      select distinct v_id, x from unnest(array_append(p_pessoas, v_eu)) x;
  else
    insert into public.reuniao_convocados (reuniao_id, pessoa_id)
      select v_id, x from privado.convocados(p_escopo, p_escopo_id) x;
  end if;
  perform privado.registrar('Agendou reunião', trim(p_titulo) || ' em ' || to_char(p_data, 'DD/MM/YYYY'), p_reuniao => v_id);
  return v_id;
end $$;

-- ---------- 3. avais ----------
create type public.tipo_aval as enum ('ajuste_proprio','decidir_solicitacao','justificar_falta');
create type public.status_aval as enum ('pendente','aprovado','negado');

create table public.avais (
  id          uuid primary key default gen_random_uuid(),
  tipo        public.tipo_aval not null,
  solicitante uuid not null references public.pessoas(id),
  payload     jsonb not null,           -- o que será executado se a Presidência aprovar
  resumo      text not null,            -- explicação lida por quem decide
  status      public.status_aval not null default 'pendente',
  decidido_por uuid references public.pessoas(id),
  decidido_em timestamptz,
  nota        text,
  criado_em   timestamptz not null default now()
);
create index on public.avais (status, criado_em desc);
alter table public.avais enable row level security;
create policy ler on public.avais for select to authenticated
  using (solicitante = (select privado.eu()) or privado.eh_presex((select privado.eu())));

create or replace function public.solicitar_aval(p_tipo public.tipo_aval, p_payload jsonb, p_resumo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := privado.exigir_login(); v_id uuid; v_resumo text := trim(coalesce(p_resumo, ''));
  v_payload jsonb; v_tipo text; v_valor int; v_data date; v_sol uuid; v_aprovar boolean; v_nota text;
  v_reuniao uuid; v_pessoa uuid; s public.solicitacoes%rowtype; r public.reunioes%rowtype;
begin
  if length(v_resumo) < 15 then raise exception 'Explique o pedido em pelo menos 15 caracteres.'; end if;
  if p_payload is null then raise exception 'Pedido de aval incompleto.'; end if;

  if p_tipo = 'ajuste_proprio' then
    if not privado.eh_assessoria_presidencia(v_eu) then
      raise exception 'Só a Assessoria de Presidência pede aval para ajustar a própria pontuação.';
    end if;
    v_tipo := p_payload ->> 'tipo'; v_valor := (p_payload ->> 'valor')::int; v_data := (p_payload ->> 'data')::date;
    if coalesce(v_tipo, '') not in ('ajuste','evento') or v_valor is null or v_valor = 0 or abs(v_valor) > 20
       or v_data is null or v_data > privado.hoje() then
      raise exception 'Informe o tipo, um valor inteiro entre −20 e 20 (diferente de zero) e uma data até hoje.';
    end if;
    v_payload := jsonb_build_object('tipo', v_tipo, 'valor', v_valor, 'data', v_data);

  elsif p_tipo = 'decidir_solicitacao' then
    if not privado.eh_assessoria_presidencia(v_eu) then
      raise exception 'Só a Assessoria de Presidência pede aval para decidir acessos por exceção.';
    end if;
    v_sol := (p_payload ->> 'solicitacao')::uuid; v_aprovar := (p_payload ->> 'aprovar')::boolean;
    v_nota := nullif(trim(coalesce(p_payload ->> 'nota', '')), '');
    select * into s from public.solicitacoes where id = v_sol;
    if not found or s.status <> 'pendente' or v_aprovar is null or v_eu in (s.solicitante, s.beneficiario) then
      raise exception 'Escolha um pedido de acesso pendente que não seja seu.';
    end if;
    if exists (select 1 from public.avais a where a.tipo = 'decidir_solicitacao' and a.status = 'pendente' and a.payload ->> 'solicitacao' = v_sol::text) then
      raise exception 'Já existe um pedido de aval pendente para esta solicitação.';
    end if;
    v_payload := jsonb_build_object('solicitacao', v_sol, 'aprovar', v_aprovar, 'nota', v_nota);

  else -- justificar_falta
    if privado.eh_presex(v_eu) then raise exception 'A Presidente e a Vice justificam a falta diretamente.'; end if;
    v_reuniao := (p_payload ->> 'reuniao')::uuid; v_pessoa := (p_payload ->> 'pessoa')::uuid;
    select * into r from public.reunioes where id = v_reuniao;
    if not found or not privado.pode_gerir_reuniao(v_eu, v_reuniao) then raise exception 'Você não pode pedir aval para esta reunião.'; end if;
    if r.encerrada then raise exception 'A reunião já foi encerrada.'; end if;
    if not exists (select 1 from public.reuniao_convocados rc join public.pessoas x on x.id = rc.pessoa_id
                    where rc.reuniao_id = v_reuniao and rc.pessoa_id = v_pessoa and x.papel = 'diretor' and rc.presenca = 'falta') then
      raise exception 'O aval vale para a falta de um diretor já registrada nesta reunião.';
    end if;
    if exists (select 1 from public.avais a where a.tipo = 'justificar_falta' and a.status = 'pendente'
                  and a.payload ->> 'reuniao' = v_reuniao::text and a.payload ->> 'pessoa' = v_pessoa::text) then
      raise exception 'Já existe um pedido de aval pendente para esta falta.';
    end if;
    v_payload := jsonb_build_object('reuniao', v_reuniao, 'pessoa', v_pessoa);
  end if;

  insert into public.avais (tipo, solicitante, payload, resumo) values (p_tipo, v_eu, v_payload, v_resumo) returning id into v_id;
  perform privado.registrar('Pediu aval', v_resumo, p_reuniao => v_reuniao);
  return v_id;
end $$;

create or replace function public.decidir_aval(p_aval uuid, p_aprovar boolean, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); a public.avais%rowtype; v_reuniao uuid;
begin
  select * into a from public.avais where id = p_aval for update;
  if not found or a.status <> 'pendente' or not privado.eh_presex(v_eu) or a.solicitante = v_eu then
    raise exception 'Você não pode decidir este aval.';
  end if;
  if p_aprovar then
    -- a ação roda com a pessoa que aprova, então as regras de sempre valem para ela
    if a.tipo = 'ajuste_proprio' then
      perform public.lancar_pontos(a.solicitante, (a.payload ->> 'tipo')::public.tipo_lancamento,
                                   (a.payload ->> 'valor')::int, (a.payload ->> 'data')::date, a.resumo);
    elsif a.tipo = 'decidir_solicitacao' then
      perform public.decidir_solicitacao((a.payload ->> 'solicitacao')::uuid, (a.payload ->> 'aprovar')::boolean,
                                         coalesce(a.payload ->> 'nota', ''));
    else
      v_reuniao := (a.payload ->> 'reuniao')::uuid;
      if coalesce((select encerrada from public.reunioes where id = v_reuniao), true) then
        raise exception 'A reunião já foi encerrada ou não existe mais.';
      end if;
      update public.reuniao_convocados set presenca = 'justificada'
       where reuniao_id = v_reuniao and pessoa_id = (a.payload ->> 'pessoa')::uuid;
    end if;
  end if;
  update public.avais
     set status = case when p_aprovar then 'aprovado' else 'negado' end::public.status_aval,
         decidido_por = v_eu, decidido_em = now(), nota = nullif(trim(coalesce(p_nota, '')), '')
   where id = p_aval;
  perform privado.registrar(case when p_aprovar then 'Aprovou aval' else 'Negou aval' end, a.resumo,
          p_reuniao => v_reuniao, p_envolvidos => array[a.solicitante]);
end $$;

-- ---------- 4. presença: falta de diretoria só é justificada com aval ----------
create or replace function public.salvar_presencas(p_reuniao uuid, p_presencas jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  if not privado.pode_gerir_reuniao(v_eu, p_reuniao) then raise exception 'Você não pode registrar presença nesta reunião.'; end if;
  if (select encerrada from public.reunioes where id = p_reuniao) then
    raise exception 'A reunião já foi encerrada. Corrija pelo módulo de pontuações.';
  end if;
  if not privado.eh_presex(v_eu) and exists (
       select 1 from public.reuniao_convocados rc join public.pessoas x on x.id = rc.pessoa_id
        where rc.reuniao_id = p_reuniao and x.papel = 'diretor'
          and nullif(p_presencas ->> rc.pessoa_id::text, '') = 'justificada'
          and rc.presenca is distinct from 'justificada') then
    raise exception 'A falta de diretoria só é justificada com aval da Presidência ou da Vice-Presidência. Peça o aval pelo sistema.';
  end if;
  update public.reuniao_convocados
     set presenca = nullif(p_presencas ->> pessoa_id::text, '')::public.presenca
   where reuniao_id = p_reuniao;
end $$;

-- não encerra com pedido de aval pendente (a decisão pode mudar uma presença)
create or replace function public.encerrar_reuniao(p_reuniao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); r public.reunioes%rowtype; c public.config%rowtype; v_faltando int; v_f int; v_j int;
begin
  select * into r from public.reunioes where id = p_reuniao for update;
  if not found or r.encerrada or not privado.pode_gerir_reuniao(v_eu, p_reuniao) then raise exception 'Você não pode encerrar esta reunião.'; end if;
  if r.data > privado.hoje() then raise exception 'A reunião ainda não aconteceu.'; end if;
  if exists (select 1 from public.avais a where a.tipo = 'justificar_falta' and a.status = 'pendente' and a.payload ->> 'reuniao' = p_reuniao::text) then
    raise exception 'Há pedido de aval pendente nesta reunião. Aguarde a decisão antes de encerrar.';
  end if;
  select count(*) into v_faltando from public.reuniao_convocados where reuniao_id = p_reuniao and presenca is null;
  if v_faltando > 0 then raise exception 'Marque a presença de todos (% sem registro).', v_faltando; end if;
  select * into c from public.config;
  update public.reunioes set encerrada = true where id = p_reuniao;
  insert into public.lancamentos (pessoa_id, tipo, descricao, data, valor, reuniao_id, criado_por)
  select rc.pessoa_id, 'falta',
         case when rc.presenca = 'falta' then 'Falta em: ' else 'Falta justificada em: ' end || r.titulo,
         r.data, case when rc.presenca = 'falta' then c.falta else c.falta_justificada end, p_reuniao, v_eu
    from public.reuniao_convocados rc
   where rc.reuniao_id = p_reuniao and rc.presenca in ('falta','justificada');
  select count(*) filter (where presenca = 'falta'), count(*) filter (where presenca = 'justificada')
    into v_f, v_j from public.reuniao_convocados where reuniao_id = p_reuniao;
  perform privado.registrar('Encerrou reunião', r.titulo || ': ' || v_f || ' falta(s), ' || v_j || ' justificada(s)', p_reuniao => p_reuniao);
end $$;

-- ---------- 5. excluir reunião ----------
-- Devolve os caminhos dos arquivos para o site apagá-los do armazenamento.
-- Reunião encerrada: faltas lançadas são desconsideradas (os lançamentos ficam, riscados, sem a reunião).
create or replace function public.excluir_reuniao(p_reuniao uuid, p_motivo text default null) returns text[]
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); r public.reunioes%rowtype; v_caminhos text[]; v_motivo text := trim(coalesce(p_motivo, ''));
begin
  select * into r from public.reunioes where id = p_reuniao for update;
  if not found then raise exception 'Reunião não encontrada.'; end if;
  if not (case when r.encerrada
               then privado.eh_presidencia(v_eu) or (privado.papel_de(v_eu) = 'diretor' and privado.pode_gerir_reuniao(v_eu, p_reuniao))
               else privado.pode_gerir_reuniao(v_eu, p_reuniao) end) then
    raise exception 'Você não pode excluir esta reunião.';
  end if;
  if r.encerrada and length(v_motivo) < 10 then raise exception 'Escreva o motivo da exclusão (mínimo 10 caracteres).'; end if;
  select coalesce(array_agg(caminho), '{}') into v_caminhos from public.anexos where reuniao_id = p_reuniao;
  if r.encerrada then
    update public.lancamentos
       set desconsiderado_por = v_eu, desconsiderado_em = now(), motivo_desconsideracao = 'Reunião excluída: ' || v_motivo
     where reuniao_id = p_reuniao and desconsiderado_em is null;
  end if;
  update public.avais set status = 'negado', decidido_por = v_eu, decidido_em = now(), nota = 'Reunião excluída.'
   where tipo = 'justificar_falta' and status = 'pendente' and payload ->> 'reuniao' = p_reuniao::text;
  delete from public.reunioes where id = p_reuniao;
  perform privado.registrar('Excluiu reunião',
          r.titulo || ' de ' || to_char(r.data, 'DD/MM/YYYY') || case when r.encerrada then ': ' || v_motivo else '' end,
          p_reuniao => p_reuniao);
  return v_caminhos;
end $$;

-- Com a reunião excluída, o site apaga os arquivos dela: nesse caso (e só nele) quem tem cadastro
-- pode ver e apagar o arquivo. Os caminhos são ids aleatórios, e o arquivo pertence a uma reunião que não existe mais.
-- Apagar também exige poder ver o arquivo, por isso a leitura ganha a mesma exceção.
-- (a função consulta sem o filtro de acesso, senão quem não vê a reunião acharia que ela não existe)
create or replace function privado.arquivo_orfao(p_pasta text) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.eu() is not null
     and privado.uuid_ou_nulo(p_pasta) is not null
     and not exists (select 1 from public.reunioes r where r.id = privado.uuid_ou_nulo(p_pasta))
$$;

drop policy if exists sgi_anexos_ler on storage.objects;
create policy sgi_anexos_ler on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and (
       privado.pode_ver_reuniao((select privado.eu()), privado.uuid_ou_nulo((storage.foldername(name))[1]))
    or privado.arquivo_orfao((storage.foldername(name))[1])));

drop policy if exists sgi_anexos_apagar on storage.objects;
create policy sgi_anexos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and (
       privado.pode_gerir_reuniao((select privado.eu()), privado.uuid_ou_nulo((storage.foldername(name))[1]))
    or privado.arquivo_orfao((storage.foldername(name))[1])));

-- ---------- 6. visões ----------
-- reunioes_visiveis: mesmas colunas do 05; novas só no fim
create or replace view public.reunioes_visiveis with (security_invoker = true) as
select r.id, r.titulo, r.data, r.hora, r.escopo, r.escopo_id, r.pauta, r.encerrada,
       r.ata, r.ata_por, r.ata_em, r.criado_por, r.criado_em,
       privado.pode_gerir_reuniao(privado.eu(), r.id) as pode_gerir,
       exists (select 1 from public.reuniao_convocados rc where rc.reuniao_id = r.id and rc.pessoa_id = privado.eu()) as convocado,
       (select count(*)::int from public.anexos a where a.reuniao_id = r.id) as total_anexos,
       exists (select 1 from public.transcricoes t where t.reuniao_id = r.id) as tem_transcricao,
       (select count(*)::int from public.reuniao_convocados rc where rc.reuniao_id = r.id) as total_convocados,
       (select count(*)::int from public.reuniao_convocados rc where rc.reuniao_id = r.id and rc.presenca = 'falta') as total_faltas,
       (privado.pode_gerir_reuniao(privado.eu(), r.id) and not r.encerrada and r.data <= privado.hoje()) as pode_encerrar,
       coalesce(case when r.encerrada
                     then privado.eh_presidencia(privado.eu())
                          or (privado.papel_de(privado.eu()) = 'diretor' and privado.pode_gerir_reuniao(privado.eu(), r.id))
                     else privado.pode_gerir_reuniao(privado.eu(), r.id) end, false) as pode_excluir,
       privado.eh_presex(privado.eu()) as pode_justificar_diretoria
  from public.reunioes r;

-- públicos: ganha "pessoas escolhidas" (sem convocados fixos)
create or replace view public.escopos_de_reuniao with (security_invoker = true) as
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
  join public.areas a on a.id = n.area_id
union all
select 'pessoas'::public.escopo_reuniao, null::text, 'Pessoas escolhidas'::text,
       privado.pode_criar_reuniao(privado.eu(), 'pessoas', null), 0
 where privado.eu() is not null;

-- pessoas que quem está logado pode escolher para uma reunião
create view public.pessoas_convocaveis with (security_invoker = true) as
select x.id, x.nome, x.papel, x.area_id, x.nucleo_id
  from public.pessoas x
 where x.ativo and privado.pode_convocar(privado.eu(), x.id);

-- avais visíveis (quem pediu e a Presidente e a Vice), com se quem consulta pode decidir
create view public.avais_visiveis with (security_invoker = true) as
select a.id, a.tipo, a.solicitante, a.resumo, a.payload, a.status, a.decidido_por, a.decidido_em, a.nota, a.criado_em,
       (a.status = 'pendente' and privado.eh_presex(privado.eu()) and a.solicitante <> privado.eu()) as pode_decidir
  from public.avais a;

-- ---------- 7. permissões ----------
grant execute on function
  privado.eh_assessoria_presidencia(uuid), privado.eh_presex(uuid), privado.pode_convocar(uuid, uuid), privado.arquivo_orfao(text)
to authenticated;

revoke all on function public.criar_reuniao(text, date, time, public.escopo_reuniao, text, text, uuid[]) from public, anon;
revoke all on function public.solicitar_aval(public.tipo_aval, jsonb, text) from public, anon;
revoke all on function public.decidir_aval(uuid, boolean, text) from public, anon;
revoke all on function public.excluir_reuniao(uuid, text) from public, anon;
grant execute on function public.criar_reuniao(text, date, time, public.escopo_reuniao, text, text, uuid[]) to authenticated;
grant execute on function public.solicitar_aval(public.tipo_aval, jsonb, text) to authenticated;
grant execute on function public.decidir_aval(uuid, boolean, text) to authenticated;
grant execute on function public.excluir_reuniao(uuid, text) to authenticated;

revoke all on public.avais, public.avais_visiveis, public.pessoas_convocaveis from anon;
revoke insert, update, delete, truncate on public.avais, public.avais_visiveis, public.pessoas_convocaveis from authenticated;
grant select on public.avais, public.avais_visiveis, public.pessoas_convocaveis to authenticated;
