-- =====================================================================
-- SGI Fácil Consultoria · 26 · Justificativa de falta, regras do trainee e documentos gerais
-- Rodar depois do 25 (que precisa ter terminado antes).
--
-- 1. Quem foi convocado justifica a própria falta (ou avisa antes que vai faltar). Quem organiza
--    a reunião aceita ou recusa; falta de Presidência, Vice ou diretoria, só a Presidente ou a Vice.
--    Aceita com a reunião aberta: a presença vira "justificada". Aceita com a reunião encerrada
--    (até 7 dias depois da data): a falta lançada é desconsiderada e entra a falta justificada.
-- 2. Trainee: cadastro igual ao de membro (com núcleo); qualquer liderança que cria demandas pode
--    atribuir demandas a um trainee; o resto segue as regras de membro (vê só o que é dele).
--    As abas que aparecem para o trainee são decididas no site (Demandas, Reuniões, Presenças e
--    Disponibilidade); documentos gerais o banco também não entrega a trainee.
-- 3. Documentos gerais (Estatuto, relatórios e outros): todos os cadastrados, menos trainees, leem;
--    Presidência e diretorias enviam; quem enviou ou a Presidência exclui. Arquivos no bucket
--    privado "documentos", até 50 MB.
-- =====================================================================

-- ---------- 1. justificativa de falta ----------
create table public.justificativas_falta (
  id           uuid primary key default gen_random_uuid(),
  reuniao_id   uuid not null references public.reunioes(id) on delete cascade,
  pessoa_id    uuid not null references public.pessoas(id),
  motivo       text not null check (length(trim(motivo)) between 10 and 500),
  situacao     text not null default 'pendente' check (situacao in ('pendente','aceita','recusada')),
  decidido_por uuid references public.pessoas(id),
  decidido_em  timestamptz,
  nota         text check (nota is null or length(nota) <= 300),
  criado_em    timestamptz not null default now()
);
-- uma justificativa em aberto ou aceita por pessoa e reunião (recusada pode ser refeita com outro motivo)
create unique index justificativas_uma_valida on public.justificativas_falta (reuniao_id, pessoa_id) where situacao in ('pendente','aceita');

-- quem decide: falta de Presidência, Vice ou diretoria, só Presidente ou Vice; as demais, quem gere a reunião
create or replace function privado.pode_decidir_justificativa(p uuid, p_reuniao uuid, p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and p <> p_pessoa
     and case when coalesce(privado.papel_de(p_pessoa) in ('presidente','vice','diretor'), false)
              then privado.eh_presex(p)
              else privado.pode_gerir_reuniao(p, p_reuniao) end
$$;

-- o que impede p de justificar a falta nesta reunião (nulo = pode)
create or replace function privado.impedimento_justificativa(p uuid, p_reuniao uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when rc.pessoa_id is null then 'Você não foi convocado para esta reunião.'
    when rc.presenca = 'presente' then 'Sua presença já está registrada nesta reunião.'
    when rc.presenca = 'justificada' then 'Sua falta nesta reunião já está justificada.'
    when exists (select 1 from public.justificativas_falta j
                  where j.reuniao_id = p_reuniao and j.pessoa_id = p and j.situacao = 'pendente')
      then 'Você já enviou uma justificativa para esta reunião. Aguarde a decisão.'
    when r.encerrada and r.data < privado.hoje() - 7
      then 'O prazo para justificar esta falta (7 dias depois da reunião) já passou.'
  end
  from (select p_reuniao as id) alvo
  left join public.reunioes r on r.id = alvo.id
  left join public.reuniao_convocados rc on rc.reuniao_id = alvo.id and rc.pessoa_id = p
$$;

alter table public.justificativas_falta enable row level security;
create policy ler on public.justificativas_falta for select to authenticated
  using (pessoa_id = (select privado.eu())
      or privado.eh_presidencia((select privado.eu()))
      or privado.pode_decidir_justificativa((select privado.eu()), reuniao_id, pessoa_id));
revoke all on public.justificativas_falta from anon, authenticated;
grant select on public.justificativas_falta to authenticated;

create or replace function public.justificar_minha_falta(p_reuniao uuid, p_motivo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_motivo text := trim(coalesce(p_motivo, '')); v_erro text; v_id uuid;
begin
  v_erro := privado.impedimento_justificativa(v_eu, p_reuniao);
  if v_erro is not null then raise exception '%', v_erro; end if;
  if length(v_motivo) < 10 then raise exception 'Explique o motivo em pelo menos 10 caracteres.'; end if;
  if length(v_motivo) > 500 then raise exception 'O motivo tem no máximo 500 caracteres.'; end if;
  insert into public.justificativas_falta (reuniao_id, pessoa_id, motivo) values (p_reuniao, v_eu, v_motivo) returning id into v_id;
  perform privado.registrar('Justificou falta', (select titulo from public.reunioes where id = p_reuniao), p_reuniao => p_reuniao);
  return v_id;
end $$;

create or replace function public.decidir_justificativa(p_id uuid, p_aceitar boolean, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_eu uuid := privado.exigir_login(); j public.justificativas_falta%rowtype; r public.reunioes%rowtype;
  c public.config%rowtype; v_nota text := nullif(trim(coalesce(p_nota, '')), ''); v_nome text;
begin
  select * into j from public.justificativas_falta where id = p_id for update;
  if not found or j.situacao <> 'pendente' then raise exception 'Esta justificativa não está aguardando decisão.'; end if;
  if not privado.pode_decidir_justificativa(v_eu, j.reuniao_id, j.pessoa_id) then
    if j.pessoa_id = v_eu then raise exception 'Ninguém decide a própria justificativa.'; end if;
    if privado.papel_de(j.pessoa_id) in ('presidente','vice','diretor') then
      raise exception 'Falta de Presidência, Vice ou diretoria só é justificada pela Presidente ou pela Vice-Presidente.';
    end if;
    raise exception 'Só quem organiza a reunião decide esta justificativa.';
  end if;
  if p_aceitar is null then raise exception 'Escolha aceitar ou recusar.'; end if;
  if length(coalesce(v_nota, '')) > 300 then raise exception 'A observação tem no máximo 300 caracteres.'; end if;
  select * into r from public.reunioes where id = j.reuniao_id;
  if p_aceitar then
    update public.reuniao_convocados set presenca = 'justificada' where reuniao_id = j.reuniao_id and pessoa_id = j.pessoa_id;
    if r.encerrada then
      select * into c from public.config;
      update public.lancamentos
         set desconsiderado_por = v_eu, desconsiderado_em = now(), motivo_desconsideracao = 'Falta justificada depois do encerramento.'
       where reuniao_id = j.reuniao_id and pessoa_id = j.pessoa_id and tipo = 'falta' and desconsiderado_em is null;
      insert into public.lancamentos (pessoa_id, tipo, descricao, data, valor, reuniao_id, criado_por)
      values (j.pessoa_id, 'falta', 'Falta justificada em: ' || r.titulo, r.data, c.falta_justificada, j.reuniao_id, v_eu);
    end if;
  end if;
  update public.justificativas_falta
     set situacao = case when p_aceitar then 'aceita' else 'recusada' end, decidido_por = v_eu, decidido_em = now(), nota = v_nota
   where id = p_id;
  select nome into v_nome from public.pessoas where id = j.pessoa_id;
  perform privado.registrar(case when p_aceitar then 'Aceitou justificativa' else 'Recusou justificativa' end,
          v_nome || ' · ' || r.titulo, p_reuniao => j.reuniao_id, p_envolvidos => array[j.pessoa_id]);
end $$;

revoke all on function public.justificar_minha_falta(uuid, text), public.decidir_justificativa(uuid, boolean, text) from public, anon;
grant execute on function public.justificar_minha_falta(uuid, text), public.decidir_justificativa(uuid, boolean, text) to authenticated;

-- as reuniões de quem consulta, com a presença e a última justificativa
create or replace view public.minhas_presencas with (security_invoker = true) as
select r.id as reuniao_id, r.titulo, r.data, r.hora, r.encerrada, rc.presenca::text as presenca,
       j.situacao as justificativa, j.motivo, j.nota as nota_da_decisao,
       (privado.impedimento_justificativa(privado.eu(), r.id) is null) as pode_justificar
  from public.reuniao_convocados rc
  join public.reunioes r on r.id = rc.reuniao_id
  left join lateral (select x.situacao, x.motivo, x.nota from public.justificativas_falta x
                      where x.reuniao_id = r.id and x.pessoa_id = rc.pessoa_id
                      order by x.criado_em desc limit 1) j on true
 where rc.pessoa_id = privado.eu();

-- justificativas que quem consulta decide
create or replace view public.justificativas_para_decidir with (security_invoker = true) as
select j.id, j.reuniao_id, r.titulo, r.data, r.encerrada, j.pessoa_id, p.nome as pessoa_nome, j.motivo, j.criado_em
  from public.justificativas_falta j
  join public.reunioes r on r.id = j.reuniao_id
  join public.pessoas p on p.id = j.pessoa_id
 where j.situacao = 'pendente' and privado.pode_decidir_justificativa(privado.eu(), j.reuniao_id, j.pessoa_id);

-- ---------- 2. trainee ----------
-- trainee tem núcleo, como membro
create or replace function privado.conferir_cadastro(p_nome text, p_papel public.papel, p_area text, p_nucleo text) returns void
language plpgsql stable security definer set search_path = public as $$
declare v_pres text := (select area_presidencia from public.config);
begin
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Informe o nome.'; end if;
  if not exists (select 1 from public.areas where id = p_area) then raise exception 'Área não encontrada.'; end if;
  if p_papel in ('presidente','vice') and p_area is distinct from v_pres then
    raise exception 'Presidente e Vice-Presidente pertencem à Presidência.';
  end if;
  if p_papel in ('gerente','assessor','membro','trainee') and p_nucleo is null then raise exception 'Escolha o núcleo.'; end if;
  if p_nucleo is not null and privado.area_do_nucleo(p_nucleo) is distinct from p_area then
    raise exception 'O núcleo escolhido não pertence a essa área.';
  end if;
end $$;

-- a Gente e Gestão também cadastra trainees
create or replace view public.papeis_cadastraveis with (security_invoker = true) as
select r::text as papel
  from unnest(enum_range(null::public.papel)) r
 where privado.pode_cadastrar_pessoas(privado.eu())
   and (privado.eh_presidencia(privado.eu()) or r in ('gerente','assessor','membro','trainee'));

-- quem cria demandas atribui trainees de qualquer área (o resto igual ao 01)
create or replace function privado.pode_atribuir(p uuid, p_projeto uuid, p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.eh_presidencia(p)
      or exists (select 1 from public.pessoas x
                 where x.id = p_pessoa and x.ativo and (
                      x.id = p
                   or (x.papel = 'trainee' and coalesce(privado.papel_de(p) in ('diretor','gerente','assessor'), false))
                   or (privado.papel_de(p) = 'diretor' and privado.dirige(p, x.area_id))
                   or (privado.papel_de(p) in ('gerente','assessor')
                       and x.nucleo_id = (select nucleo_id from public.pessoas where id = p))))
$$;

-- ---------- 3. documentos gerais ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 52428800)
on conflict (id) do nothing;

create table public.documentos (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null check (length(trim(titulo)) between 1 and 150),
  categoria    text not null check (categoria in ('estatuto','relatorio','regimento','ata','modelo','outro')),
  descricao    text not null default '' check (length(descricao) <= 1000),
  caminho      text not null unique,      -- <pasta aleatória>/<arquivo> no bucket "documentos"
  nome_arquivo text not null,
  tipo         text not null,
  tamanho      bigint not null check (tamanho > 0 and tamanho <= 52428800),
  enviado_por  uuid references public.pessoas(id),
  enviado_em   timestamptz not null default now()
);

create or replace function privado.pode_ver_documentos(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(privado.papel_de(p) <> 'trainee', false)
$$;

create or replace function privado.pode_enviar_documento(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.eh_presidencia(p) or coalesce(privado.papel_de(p) = 'diretor', false)
$$;

create or replace function privado.pode_excluir_documento(p uuid, p_doc uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (privado.eh_presidencia(p)
      or exists (select 1 from public.documentos d where d.id = p_doc and d.enviado_por = p and privado.pode_enviar_documento(p)))
$$;

alter table public.documentos enable row level security;
create policy ler on public.documentos for select to authenticated using (privado.pode_ver_documentos((select privado.eu())));
revoke all on public.documentos from anon, authenticated;
grant select on public.documentos to authenticated;

create or replace function public.registrar_documento(p_titulo text, p_categoria text, p_descricao text,
  p_nome text, p_tipo text, p_tamanho bigint, p_caminho text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid; v_titulo text := trim(coalesce(p_titulo, ''));
begin
  if not privado.pode_enviar_documento(v_eu) then raise exception 'Só a Presidência e as diretorias enviam documentos.'; end if;
  if v_titulo = '' then raise exception 'Dê um título ao documento.'; end if;
  if length(v_titulo) > 150 then raise exception 'O título tem no máximo 150 caracteres.'; end if;
  if p_categoria is null or p_categoria not in ('estatuto','relatorio','regimento','ata','modelo','outro') then
    raise exception 'Escolha a categoria do documento.';
  end if;
  if length(coalesce(p_descricao, '')) > 1000 then raise exception 'A descrição tem no máximo 1000 caracteres.'; end if;
  if coalesce(p_tamanho, 0) <= 0 or p_tamanho > 52428800 then raise exception 'O arquivo precisa ter até 50 MB.'; end if;
  if coalesce(trim(p_caminho), '') = '' or coalesce(trim(p_nome), '') = '' then raise exception 'Arquivo não informado.'; end if;
  insert into public.documentos (titulo, categoria, descricao, caminho, nome_arquivo, tipo, tamanho, enviado_por)
  values (v_titulo, p_categoria, trim(coalesce(p_descricao, '')), p_caminho, trim(p_nome), coalesce(nullif(p_tipo, ''), 'application/octet-stream'), p_tamanho, v_eu)
  returning id into v_id;
  perform privado.registrar('Enviou documento', v_titulo);
  return v_id;
exception when unique_violation then
  raise exception 'Este arquivo já foi registrado.';
end $$;

-- apaga o registro e devolve o caminho para o site apagar o arquivo
create or replace function public.remover_documento(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); d public.documentos%rowtype;
begin
  select * into d from public.documentos where id = p_id for update;
  if not found or not privado.pode_excluir_documento(v_eu, p_id) then raise exception 'Você não pode excluir este documento.'; end if;
  delete from public.documentos where id = p_id;
  perform privado.registrar('Excluiu documento', d.titulo);
  return d.caminho;
end $$;

revoke all on function public.registrar_documento(text, text, text, text, text, bigint, text), public.remover_documento(uuid) from public, anon;
grant execute on function public.registrar_documento(text, text, text, text, text, bigint, text), public.remover_documento(uuid) to authenticated;

drop policy if exists sgi_documentos_ler on storage.objects;
create policy sgi_documentos_ler on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and privado.pode_ver_documentos((select privado.eu())));
drop policy if exists sgi_documentos_enviar on storage.objects;
create policy sgi_documentos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and privado.pode_enviar_documento((select privado.eu())));
-- apagar: o arquivo de um documento que a pessoa pode excluir, ou um arquivo que ficou sem registro
drop policy if exists sgi_documentos_apagar on storage.objects;
create policy sgi_documentos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and (
       exists (select 1 from public.documentos d where d.caminho = name and privado.pode_excluir_documento((select privado.eu()), d.id))
    or (privado.pode_enviar_documento((select privado.eu())) and not exists (select 1 from public.documentos d where d.caminho = name))));

create or replace view public.documentos_painel with (security_invoker = true) as
select d.id, d.titulo, d.categoria, d.descricao, d.caminho, d.nome_arquivo, d.tipo, d.tamanho, d.enviado_em,
       p.nome as enviado_por_nome, privado.pode_excluir_documento(privado.eu(), d.id) as pode_excluir
  from public.documentos d
  left join public.pessoas p on p.id = d.enviado_por;

-- quem pode enviar (para mostrar o botão)
create or replace view public.permissoes_documentos with (security_invoker = true) as
select privado.pode_enviar_documento(privado.eu()) as pode_enviar
 where privado.eu() is not null;

revoke all on public.minhas_presencas, public.justificativas_para_decidir, public.documentos_painel, public.permissoes_documentos from anon;
revoke insert, update, delete, truncate on public.minhas_presencas, public.justificativas_para_decidir, public.documentos_painel,
  public.permissoes_documentos from authenticated;
grant select on public.minhas_presencas, public.justificativas_para_decidir, public.documentos_painel, public.permissoes_documentos to authenticated;

-- ---------- 4. sino: justificativas para decidir ----------
-- as mesmas linhas do 23, mais as justificativas que quem consulta decide
create or replace view public.minhas_notificacoes with (security_invoker = true) as
select n.id::text as chave, n.id, n.tipo, d.titulo as titulo, d.codigo, d.prazo, null::text as autor_nome,
       n.demanda_id, null::uuid as recado_id, n.criado_em as em, null::uuid as sugestao_id, null::text as detalhe
  from public.notificacoes n
  join public.demandas d on d.id = n.demanda_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'atribuicao' and d.status <> 'concluida'
   and exists (select 1 from public.demanda_executores e where e.demanda_id = n.demanda_id and e.pessoa_id = n.pessoa_id)
union all
select n.id::text, n.id, n.tipo, r.titulo, null::text, null::date, p.nome,
       null::uuid, n.recado_id, n.criado_em, null::uuid, null::text
  from public.notificacoes n
  join public.recados r on r.id = n.recado_id and r.retirado_em is null and r.situacao = 'publicado' and privado.recado_no_prazo(r.visivel_ate)
  join public.pessoas p on p.id = r.autor_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'recado'
union all
select 'atraso:' || d.id::text, null::uuid, 'atraso', d.titulo, d.codigo, d.prazo, null::text,
       d.id, null::uuid, d.prazo::timestamptz, null::uuid, null::text
  from public.demandas d
  join public.demanda_executores e on e.demanda_id = d.id
 where e.pessoa_id = privado.eu() and d.status <> 'concluida' and d.prazo < privado.hoje()
union all
select 'autorizacao:' || r.id::text, null::uuid, 'autorizacao', r.titulo, null::text, null::date, p.nome,
       null::uuid, r.id, r.criado_em, null::uuid, null::text
  from public.recados r
  join public.pessoas p on p.id = r.autor_id
 where r.situacao = 'pendente' and r.retirado_em is null and privado.recado_no_prazo(r.visivel_ate)
   and privado.pode_autorizar_recado(privado.eu(), r.autor_id)
union all
select n.id::text, n.id, n.tipo, s.titulo, null::text, null::date, null::text,
       null::uuid, null::uuid, n.criado_em, n.sugestao_id, n.detalhe
  from public.notificacoes n
  join public.sugestoes s on s.id = n.sugestao_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'sugestao'
union all
select n.id::text, n.id, n.tipo, d.titulo, d.codigo, d.prazo, null::text,
       n.demanda_id, null::uuid, n.criado_em, null::uuid, n.detalhe
  from public.notificacoes n
  join public.demandas d on d.id = n.demanda_id
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'raci'
union all
select 'justificativa:' || j.id::text, null::uuid, 'justificativa', r.titulo, null::text, r.data, p.nome,
       null::uuid, null::uuid, j.criado_em, null::uuid, 'Justificativa de falta'::text
  from public.justificativas_falta j
  join public.reunioes r on r.id = j.reuniao_id
  join public.pessoas p on p.id = j.pessoa_id
 where j.situacao = 'pendente' and privado.pode_decidir_justificativa(privado.eu(), j.reuniao_id, j.pessoa_id);
