-- =====================================================================
-- SGI Fácil Consultoria · 23 · Matriz RACI das demandas (R → A → I)
-- Rodar depois do 22.
--
-- Cada demanda passa a ter:
--   R  executores (já existiam, demanda_executores);
--   A  aprovador: uma pessoa da liderança do projeto (gerência ou assessoria do
--      núcleo, diretoria da área ou Presidência), sugerida pela diretoria da área;
--   I  informados: com alcance "A Fácil como um todo", a Presidente entra sozinha
--      e dá para incluir Vice, Assessoria e diretorias. Com alcance "Apenas uma
--      parte do time", ninguém é informado.
-- Não há "C" (consultado): dúvidas vão direto ao aprovador.
-- Quando há um só executor e ele também aprova, a demanda é "A/R": concluir
-- encerra direto, sem etapa de autoaprovação.
--
-- A demanda anda sozinha entre as caixas:
--   A fazer / Em andamento   caixa de quem executa
--   Dúvida aberta            caixa de quem aprova (até a resposta)
--   Em aprovação (revisao)   caixa de quem aprova (aprova ou pede ajuste)
--   Concluída                sai das caixas; com alcance geral, avisa os informados
-- Cada passagem avisa no sino quem passa a ter a demanda na caixa.
--
-- As demandas que já existem ganham como aprovador a diretoria da área
-- (titular, depois cobertura) ou, sem ela, a Presidente; alcance "parte".
-- =====================================================================

-- ---------- estrutura ----------
alter table public.demandas
  add column aprovador_id  uuid references public.pessoas(id),
  add column alcance       text not null default 'parte' check (alcance in ('parte','geral')),
  add column duvida_aberta boolean not null default false;

create table public.demanda_informados (
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas(id),
  primary key (demanda_id, pessoa_id)
);
create index demanda_informados_por_pessoa on public.demanda_informados (pessoa_id);
create index demandas_por_aprovador on public.demandas (aprovador_id);

-- o que foi dito em cada passagem: dúvida, resposta, pedido de ajuste e notas de entrega e aprovação
create table public.demanda_conversa (
  id         uuid primary key default gen_random_uuid(),
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  autor_id   uuid not null references public.pessoas(id),
  tipo       text not null check (tipo in ('entrega','duvida','resposta','ajuste','aprovacao')),
  texto      text not null check (length(texto) <= 1000),
  criado_em  timestamptz not null default now()
);
create index demanda_conversa_por_demanda on public.demanda_conversa (demanda_id, criado_em);

-- ---------- regras ----------
-- x pode aprovar entregas deste projeto? (demanda restrita: só a Presidência)
create or replace function privado.pode_ser_aprovador(x uuid, p_projeto uuid, p_restrita boolean default false) returns boolean
language sql stable security definer set search_path = public as $$
  select x is not null and exists (
    select 1 from public.pessoas p
      join public.projetos pr on pr.id = p_projeto
      join public.nucleos n on n.id = pr.nucleo_id
     where p.id = x and p.ativo
       and (privado.eh_presidencia(x)
            or (not pr.restrito and not coalesce(p_restrita, false)
                and (privado.dirige(x, n.area_id) or privado.lidera(x, n.id)))))
$$;

-- x pode ser informado (I)? Presidência (Presidente, Vice, Assessoria) e diretorias; restrita: só a Presidência
create or replace function privado.pode_ser_informado(x uuid, p_restrita boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select x is not null and exists (select 1 from public.pessoas p where p.id = x and p.ativo)
     and (privado.eh_presidencia(x) or (not coalesce(p_restrita, false) and privado.papel_de(x) = 'diretor'))
$$;

-- aprovador sugerido: diretoria da área (titular, depois cobertura); sem ela, a Presidente
create or replace function privado.aprovador_sugerido(p_projeto uuid, p_restrita boolean default false) returns uuid
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select t.c
       from public.projetos pr
       join public.nucleos n on n.id = pr.nucleo_id
       join public.areas a on a.id = n.area_id
       cross join lateral unnest(array[a.titular, a.cobertura]) with ordinality as t(c, ordem)
      where pr.id = p_projeto and t.c is not null and privado.pode_ser_aprovador(t.c, p_projeto, p_restrita)
      order by t.ordem limit 1),
    (select x.id from public.pessoas x where x.ativo and x.papel = 'presidente' order by x.criado_em limit 1))
$$;

-- p aprova esta demanda agora? O aprovador ativo; sem aprovador ativo, a liderança que gere a demanda.
create or replace function privado.pode_aprovar_demanda(p uuid, p_demanda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and exists (
    select 1 from public.demandas d
      left join public.pessoas a on a.id = d.aprovador_id and a.ativo
     where d.id = p_demanda
       and (a.id = p or (a.id is null and privado.pode_gerir_demanda(p, p_demanda))))
$$;

-- A/R: um só executor, que também é o aprovador
create or replace function privado.eh_ar(p_demanda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.demandas d where d.id = p_demanda and d.aprovador_id is not null
                    and (select count(*) from public.demanda_executores e where e.demanda_id = d.id) = 1
                    and exists (select 1 from public.demanda_executores e where e.demanda_id = d.id and e.pessoa_id = d.aprovador_id))
$$;

-- quem vê a demanda: além de quem já via, quem aprova e quem é informado
create or replace function privado.pode_ver_demanda(p uuid, p_demanda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (
       privado.pode_gerir_demanda(p, p_demanda)
    or exists (select 1 from public.demanda_executores where demanda_id = p_demanda and pessoa_id = p)
    or exists (select 1 from public.demandas where id = p_demanda and aprovador_id = p)
    or exists (select 1 from public.demanda_informados where demanda_id = p_demanda and pessoa_id = p)
    or privado.concessao_ativa(p, p_demanda))
$$;

alter table public.demanda_informados enable row level security;
alter table public.demanda_conversa enable row level security;
create policy ler on public.demanda_informados for select to authenticated using (privado.pode_ver_demanda((select privado.eu()), demanda_id));
create policy ler on public.demanda_conversa   for select to authenticated using (privado.pode_ver_demanda((select privado.eu()), demanda_id));
revoke all on public.demanda_informados, public.demanda_conversa from anon, authenticated;
grant select on public.demanda_informados, public.demanda_conversa to authenticated;

-- ---------- nome da etapa e validação da conclusão ----------
create or replace function privado.nome_status(s public.status_demanda) returns text
language sql immutable as $$
  select case s when 'afazer' then 'A fazer' when 'andamento' then 'Em andamento'
                when 'revisao' then 'Em aprovação' else 'Concluída' end
$$;

-- igual à do 04; agora quem aprova a entrega também valida a conclusão
create or replace function privado.aplicar_status(p_demanda uuid, p_novo public.status_demanda) returns void
language plpgsql security definer set search_path = public as $$
declare d public.demandas%rowtype; c public.config%rowtype; v_hoje date := privado.hoje(); v_ok boolean;
begin
  select * into d from public.demandas where id = p_demanda for update;
  if d.status = p_novo then return; end if;
  if p_novo = 'concluida' and not (privado.pode_gerir_demanda(privado.eu(), p_demanda)
                                   or coalesce(d.aprovador_id = privado.eu(), false)) then
    raise exception 'Só quem aprova a entrega, a liderança do núcleo, a diretoria ou a Presidência validam a conclusão.';
  end if;
  if d.status = 'concluida' and not privado.pode_gerir_demanda(privado.eu(), p_demanda) then
    raise exception 'Só a liderança do núcleo, a diretoria ou a Presidência reabrem uma demanda concluída.';
  end if;
  if d.status = 'concluida' then
    update public.lancamentos
       set desconsiderado_por = privado.eu(), desconsiderado_em = now(), motivo_desconsideracao = 'Demanda reaberta.'
     where demanda_id = p_demanda and desconsiderado_em is null;
  end if;
  update public.demandas
     set status = p_novo, concluida_em = case when p_novo = 'concluida' then v_hoje end, atualizado_em = now()
   where id = p_demanda;
  if p_novo = 'concluida' then
    select * into c from public.config;
    v_ok := v_hoje <= d.prazo;
    insert into public.lancamentos (pessoa_id, tipo, descricao, data, valor, demanda_id, criado_por)
    select e.pessoa_id, 'demanda', case when v_ok then 'Entrega no prazo' else 'Entrega com atraso' end,
           v_hoje, case when v_ok then c.entrega_no_prazo else c.entrega_atrasada end, p_demanda, privado.eu()
      from public.demanda_executores e where e.demanda_id = p_demanda;
  end if;
end $$;

-- ---------- o sino ganha o tipo "raci" (passagens da demanda) ----------
alter table public.notificacoes
  drop constraint if exists notificacoes_tipo_check,
  drop constraint if exists notificacoes_referencia_check;
alter table public.notificacoes
  add constraint notificacoes_tipo_check check (tipo in ('atribuicao','recado','sugestao','raci')),
  add constraint notificacoes_referencia_check check (
       (tipo in ('atribuicao','raci') and demanda_id is not null)
    or (tipo = 'recado' and recado_id is not null)
    or (tipo = 'sugestao' and sugestao_id is not null));

-- tira do sino os avisos de passagens anteriores ainda não lidos (a demanda mudou de caixa)
create or replace function privado.limpar_avisos_raci(p_demanda uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.notificacoes where demanda_id = p_demanda and tipo = 'raci' and lida_em is null
$$;

-- avisa cada pessoa ativa da lista, menos quem fez a ação
create or replace function privado.notificar_raci(p_demanda uuid, p_pessoas uuid[], p_detalhe text) returns void
language sql security definer set search_path = public as $$
  insert into public.notificacoes (pessoa_id, tipo, demanda_id, detalhe)
  select distinct x.id, 'raci', p_demanda, p_detalhe
    from public.pessoas x
   where x.id = any(coalesce(p_pessoas, '{}')) and x.ativo and x.id is distinct from privado.eu()
$$;

create or replace function privado.executores_de(p_demanda uuid) returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(pessoa_id), '{}') from public.demanda_executores where demanda_id = p_demanda
$$;

-- qualquer mudança de etapa (pelos botões da RACI, pelo quadro ou pela edição) passa a demanda de caixa
create or replace function privado.raci_ao_mudar_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if new.status in ('revisao','concluida') then new.duvida_aberta := false; end if;
  perform privado.limpar_avisos_raci(new.id);
  if new.status = 'revisao' and new.aprovador_id is not null then
    perform privado.notificar_raci(new.id, array[new.aprovador_id], 'Entrega aguardando sua aprovação');
  elsif new.status = 'concluida' then
    perform privado.notificar_raci(new.id, privado.executores_de(new.id), 'Entrega aprovada');
    if new.alcance = 'geral' then
      perform privado.notificar_raci(new.id,
        array(select i.pessoa_id from public.demanda_informados i where i.demanda_id = new.id),
        'Entrega concluída · impacta a Fácil como um todo');
    end if;
  end if;
  return new;
end $$;

create trigger sgi_raci_status before update of status on public.demandas
  for each row execute function privado.raci_ao_mudar_status();

-- ---------- definir R, A e I ----------
create or replace function privado.aplicar_raci(p_demanda uuid, p_aprovador uuid, p_alcance text, p_informados uuid[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  d public.demandas%rowtype;
  v_restrita boolean;
  v_informados uuid[];
begin
  select * into d from public.demandas where id = p_demanda for update;
  v_restrita := d.restrito or (select pr.restrito from public.projetos pr where pr.id = d.projeto_id);
  if p_aprovador is null then raise exception 'Escolha quem aprova a entrega.'; end if;
  if p_aprovador is distinct from d.aprovador_id and not privado.pode_ser_aprovador(p_aprovador, d.projeto_id, v_restrita) then
    raise exception 'Quem aprova precisa ser da liderança do projeto: gerência ou assessoria do núcleo, diretoria da área ou Presidência.';
  end if;
  if p_alcance is null or p_alcance not in ('parte','geral') then raise exception 'Escolha o alcance da entrega.'; end if;
  v_informados := case when p_alcance = 'geral' then coalesce(p_informados, '{}') else '{}' end;
  if exists (select 1 from unnest(v_informados) i
              where i = p_aprovador or exists (select 1 from public.demanda_executores e where e.demanda_id = p_demanda and e.pessoa_id = i)) then
    raise exception 'Quem executa ou aprova não entra como informado.';
  end if;
  if exists (select 1 from unnest(v_informados) i where not privado.pode_ser_informado(i, v_restrita)) then
    if v_restrita then raise exception 'Demanda restrita: só a Presidência pode ser informada.'; end if;
    raise exception 'Só a Presidência e as diretorias podem ser informadas.';
  end if;

  update public.demandas set aprovador_id = p_aprovador, alcance = p_alcance, atualizado_em = now() where id = p_demanda;
  delete from public.demanda_informados where demanda_id = p_demanda;
  insert into public.demanda_informados (demanda_id, pessoa_id)
  select distinct p_demanda, i from unnest(v_informados) i;
  -- alcance geral: a Presidente é informada sem precisar escolher (a não ser que já execute ou aprove)
  if p_alcance = 'geral' then
    insert into public.demanda_informados (demanda_id, pessoa_id)
    select p_demanda, x.id from public.pessoas x
     where x.ativo and x.papel = 'presidente' and x.id <> p_aprovador
       and not exists (select 1 from public.demanda_executores e where e.demanda_id = p_demanda and e.pessoa_id = x.id)
    on conflict do nothing;
  end if;

  -- trocou o aprovador com a demanda na caixa dele: o aviso vai para quem aprova agora
  if p_aprovador is distinct from d.aprovador_id and d.status <> 'concluida' and (d.status = 'revisao' or d.duvida_aberta) then
    perform privado.limpar_avisos_raci(p_demanda);
    perform privado.notificar_raci(p_demanda, array[p_aprovador],
      case when d.duvida_aberta then 'Dúvida aguardando sua resposta' else 'Entrega aguardando sua aprovação' end);
  end if;
end $$;

-- criar demanda já com a RACI (mesmas checagens do criar_demanda, mais as da RACI)
create or replace function public.criar_demanda_raci(p_projeto uuid, p_titulo text, p_descricao text, p_prazo date,
  p_prioridade public.prioridade, p_executores uuid[], p_aprovador uuid, p_alcance text, p_informados uuid[] default '{}',
  p_restrito boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  v_id := public.criar_demanda(p_projeto, p_titulo, p_descricao, p_prazo, p_prioridade, p_executores, p_restrito);
  perform privado.aplicar_raci(v_id, p_aprovador, p_alcance, p_informados);
  perform privado.registrar('Definiu RACI', (select codigo from public.demandas where id = v_id)
    || ' · aprova ' || (select nome from public.pessoas where id = p_aprovador)
    || case when p_alcance = 'geral' then ' · impacta a Fácil como um todo' else ' · parte do time' end, p_demanda => v_id);
  return v_id;
end $$;

-- editar demanda e RACI juntas (só quem gere a demanda)
create or replace function public.editar_demanda_raci(p_demanda uuid, p_titulo text, p_descricao text, p_status public.status_demanda,
  p_prioridade public.prioridade, p_prazo date, p_executores uuid[], p_aprovador uuid, p_alcance text,
  p_informados uuid[] default '{}', p_restrito boolean default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.editar_demanda(p_demanda, p_titulo, p_descricao, p_status, p_prioridade, p_prazo, p_executores, p_restrito);
  perform privado.aplicar_raci(p_demanda, p_aprovador, p_alcance, p_informados);
end $$;

-- ---------- passagens ----------
create or replace function privado.exigir_executor(p_demanda uuid) returns public.demandas
language plpgsql security definer set search_path = public as $$
declare d public.demandas%rowtype;
begin
  select * into d from public.demandas where id = p_demanda for update;
  if not found or not exists (select 1 from public.demanda_executores e where e.demanda_id = p_demanda and e.pessoa_id = privado.eu()) then
    raise exception 'Só quem executa a demanda pode fazer isso.';
  end if;
  return d;
end $$;

create or replace function privado.exigir_aprovador(p_demanda uuid) returns public.demandas
language plpgsql security definer set search_path = public as $$
declare d public.demandas%rowtype;
begin
  select * into d from public.demandas where id = p_demanda for update;
  if not found or not privado.pode_aprovar_demanda(privado.eu(), p_demanda) then
    raise exception 'Só quem aprova esta entrega pode fazer isso.';
  end if;
  return d;
end $$;

create or replace function privado.texto_da_conversa(p_texto text, p_obrigatorio text) returns text
language plpgsql immutable as $$
declare v text := nullif(trim(coalesce(p_texto, '')), '');
begin
  if v is null and p_obrigatorio is not null then raise exception '%', p_obrigatorio; end if;
  if length(coalesce(v, '')) > 1000 then raise exception 'O texto tem no máximo 1000 caracteres.'; end if;
  return v;
end $$;

-- R entrega: vai para a caixa de quem aprova; em A/R, conclui direto. Devolve a etapa nova.
create or replace function public.entregar_demanda(p_demanda uuid, p_nota text default null) returns public.status_demanda
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); d public.demandas%rowtype; v_nota text; v_ar boolean;
begin
  d := privado.exigir_executor(p_demanda);
  if d.status not in ('afazer','andamento') then raise exception 'Esta demanda não está com quem executa.'; end if;
  if d.duvida_aberta then raise exception 'Há uma dúvida aberta com quem aprova. Aguarde a resposta antes de enviar.'; end if;
  v_nota := privado.texto_da_conversa(p_nota, null);
  v_ar := privado.eh_ar(p_demanda);
  if v_nota is not null then
    insert into public.demanda_conversa (demanda_id, autor_id, tipo, texto) values (p_demanda, v_eu, 'entrega', v_nota);
  end if;
  if v_ar then
    perform privado.aplicar_status(p_demanda, 'concluida');
    perform privado.registrar('Concluiu entrega (A/R)', d.codigo, p_demanda => p_demanda);
    return 'concluida';
  end if;
  perform privado.aplicar_status(p_demanda, 'revisao');
  perform privado.registrar('Enviou para aprovação', d.codigo, p_demanda => p_demanda);
  return 'revisao';
end $$;

-- R pergunta: a demanda vai para o topo da caixa de quem aprova até a resposta
create or replace function public.sinalizar_duvida(p_demanda uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); d public.demandas%rowtype; v_texto text;
begin
  d := privado.exigir_executor(p_demanda);
  if d.status not in ('afazer','andamento') then raise exception 'Esta demanda não está com quem executa.'; end if;
  if d.duvida_aberta then raise exception 'Já há uma dúvida aberta nesta demanda. Aguarde a resposta.'; end if;
  if d.aprovador_id is null or not exists (select 1 from public.pessoas a where a.id = d.aprovador_id and a.ativo) then
    raise exception 'Esta demanda não tem quem aprova definido. Fale com a liderança do núcleo.';
  end if;
  if privado.eh_ar(p_demanda) then raise exception 'Em A/R, quem executa também aprova: não há a quem enviar a dúvida.'; end if;
  v_texto := privado.texto_da_conversa(p_texto, 'Escreva a dúvida.');
  insert into public.demanda_conversa (demanda_id, autor_id, tipo, texto) values (p_demanda, v_eu, 'duvida', v_texto);
  update public.demandas
     set duvida_aberta = true, status = case when status = 'afazer' then 'andamento'::public.status_demanda else status end,
         atualizado_em = now()
   where id = p_demanda;
  perform privado.limpar_avisos_raci(p_demanda);
  perform privado.notificar_raci(p_demanda, array[d.aprovador_id], 'Dúvida de ' || (select nome from public.pessoas where id = v_eu));
  perform privado.registrar('Sinalizou dúvida', d.codigo, p_demanda => p_demanda);
end $$;

-- A responde: a demanda volta para a caixa de quem executa
create or replace function public.responder_duvida(p_demanda uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); d public.demandas%rowtype; v_texto text;
begin
  d := privado.exigir_aprovador(p_demanda);
  if not d.duvida_aberta then raise exception 'Não há dúvida aberta nesta demanda.'; end if;
  v_texto := privado.texto_da_conversa(p_texto, 'Escreva a resposta.');
  insert into public.demanda_conversa (demanda_id, autor_id, tipo, texto) values (p_demanda, v_eu, 'resposta', v_texto);
  update public.demandas set duvida_aberta = false, atualizado_em = now() where id = p_demanda;
  perform privado.limpar_avisos_raci(p_demanda);
  perform privado.notificar_raci(p_demanda, privado.executores_de(p_demanda),
    'Dúvida respondida por ' || (select nome from public.pessoas where id = v_eu));
  perform privado.registrar('Respondeu dúvida', d.codigo, p_demanda => p_demanda);
end $$;

-- A devolve com o que precisa mudar
create or replace function public.solicitar_ajuste(p_demanda uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); d public.demandas%rowtype; v_texto text;
begin
  d := privado.exigir_aprovador(p_demanda);
  if d.status <> 'revisao' then raise exception 'Esta entrega não está aguardando aprovação.'; end if;
  v_texto := privado.texto_da_conversa(p_texto, 'Explique o ajuste que precisa ser feito.');
  insert into public.demanda_conversa (demanda_id, autor_id, tipo, texto) values (p_demanda, v_eu, 'ajuste', v_texto);
  perform privado.aplicar_status(p_demanda, 'andamento');
  perform privado.notificar_raci(p_demanda, privado.executores_de(p_demanda),
    'Ajuste pedido por ' || (select nome from public.pessoas where id = v_eu));
  perform privado.registrar('Solicitou ajuste', d.codigo, p_demanda => p_demanda);
end $$;

-- A aprova: conclui, lança os pontos e, com alcance geral, avisa os informados
create or replace function public.aprovar_entrega(p_demanda uuid, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); d public.demandas%rowtype; v_nota text;
begin
  d := privado.exigir_aprovador(p_demanda);
  if d.status <> 'revisao' then raise exception 'Esta entrega não está aguardando aprovação.'; end if;
  v_nota := privado.texto_da_conversa(p_nota, null);
  if v_nota is not null then
    insert into public.demanda_conversa (demanda_id, autor_id, tipo, texto) values (p_demanda, v_eu, 'aprovacao', v_nota);
  end if;
  perform privado.aplicar_status(p_demanda, 'concluida');
  perform privado.registrar('Aprovou entrega', d.codigo, p_demanda => p_demanda);
end $$;

revoke all on function
  public.criar_demanda_raci(uuid, text, text, date, public.prioridade, uuid[], uuid, text, uuid[], boolean),
  public.editar_demanda_raci(uuid, text, text, public.status_demanda, public.prioridade, date, uuid[], uuid, text, uuid[], boolean),
  public.entregar_demanda(uuid, text), public.sinalizar_duvida(uuid, text), public.responder_duvida(uuid, text),
  public.solicitar_ajuste(uuid, text), public.aprovar_entrega(uuid, text)
  from public, anon;
grant execute on function
  public.criar_demanda_raci(uuid, text, text, date, public.prioridade, uuid[], uuid, text, uuid[], boolean),
  public.editar_demanda_raci(uuid, text, text, public.status_demanda, public.prioridade, date, uuid[], uuid, text, uuid[], boolean),
  public.entregar_demanda(uuid, text), public.sinalizar_duvida(uuid, text), public.responder_duvida(uuid, text),
  public.solicitar_ajuste(uuid, text), public.aprovar_entrega(uuid, text)
  to authenticated;
revoke all on function privado.aplicar_raci(uuid, uuid, text, uuid[]), privado.limpar_avisos_raci(uuid),
  privado.notificar_raci(uuid, uuid[], text), privado.exigir_executor(uuid), privado.exigir_aprovador(uuid),
  privado.raci_ao_mudar_status() from public;

-- ---------- demandas que já existem ----------
update public.demandas d
   set aprovador_id = privado.aprovador_sugerido(d.projeto_id, d.restrito)
 where d.aprovador_id is null;

-- ---------- visões ----------
-- demandas: mesmas colunas do 04 (motivo_acesso ganha "aprovador" e "informado"); as novas ficam no fim:
--   aprovador_id, alcance, duvida_aberta, informados   a RACI da demanda
--   eh_ar                  um só executor, que também aprova
--   com_quem               'executores', 'aprovador' ou 'ninguem' (concluída): de quem é a caixa agora
--   pode_entregar          quem consulta envia para aprovação (ou conclui, em A/R)
--   pode_sinalizar_duvida  quem consulta manda uma dúvida a quem aprova
--   pode_responder_duvida  quem consulta responde a dúvida aberta
--   pode_avaliar           quem consulta aprova ou pede ajuste
--   na_minha_caixa         a demanda espera uma ação de quem consulta
create or replace view public.demandas_visiveis with (security_invoker = true) as
select d.id, d.codigo, d.projeto_id, d.titulo, d.descricao, d.status, d.prioridade, d.prazo,
       d.concluida_em, d.criado_por, d.criado_em, d.atualizado_em,
       pr.nome as projeto_nome, pr.cliente as projeto_cliente,
       n.id as nucleo_id, n.area_id,
       (d.restrito or pr.restrito) as restrita,
       array(select e.pessoa_id from public.demanda_executores e where e.demanda_id = d.id) as executores,
       f.gere as pode_gerir,
       (f.gere or (d.status <> 'concluida' and f.executa)) as pode_mudar_status,
       case
         when privado.eh_presidencia(v.eu) then 'presidencia'
         when not (d.restrito or pr.restrito) and privado.dirige(v.eu, n.area_id) then 'diretoria'
         when not (d.restrito or pr.restrito) and privado.lidera(v.eu, n.id) then 'nucleo'
         when f.executa then 'executor'
         when d.aprovador_id = v.eu then 'aprovador'
         when exists (select 1 from public.demanda_informados i where i.demanda_id = d.id and i.pessoa_id = v.eu) then 'informado'
         else 'excecao'
       end as motivo_acesso,
       n.nome as nucleo_nome,
       (select max(s.valido_ate) from public.solicitacoes s
         where s.beneficiario = v.eu and s.status = 'aprovada' and s.valido_ate >= privado.hoje()
           and (s.demanda_id = d.id or s.projeto_id = d.projeto_id)) as excecao_ate,
       d.aprovador_id, d.alcance, d.duvida_aberta,
       array(select i.pessoa_id from public.demanda_informados i where i.demanda_id = d.id) as informados,
       f.ar as eh_ar,
       c.com_quem,
       (f.executa and d.status in ('afazer','andamento') and not d.duvida_aberta) as pode_entregar,
       (f.executa and d.status in ('afazer','andamento') and not d.duvida_aberta and d.aprovador_id is not null and not f.ar) as pode_sinalizar_duvida,
       (d.duvida_aberta and d.status <> 'concluida' and f.aprova) as pode_responder_duvida,
       (d.status = 'revisao' and f.aprova) as pode_avaliar,
       ((c.com_quem = 'executores' and f.executa) or (c.com_quem = 'aprovador' and f.aprova)) as na_minha_caixa
  from public.demandas d
  join public.projetos pr on pr.id = d.projeto_id
  join public.nucleos n on n.id = pr.nucleo_id
  cross join lateral (select privado.eu() as eu) v
  cross join lateral (select privado.pode_gerir_demanda(v.eu, d.id) as gere,
                             exists (select 1 from public.demanda_executores e where e.demanda_id = d.id and e.pessoa_id = v.eu) as executa,
                             privado.pode_aprovar_demanda(v.eu, d.id) as aprova,
                             privado.eh_ar(d.id) as ar) f
  cross join lateral (select case when d.status = 'concluida' then 'ninguem'
                                  when d.duvida_aberta or d.status = 'revisao' then 'aprovador'
                                  else 'executores' end as com_quem) c;

-- quem pode aprovar as entregas de cada projeto em que quem consulta cria ou edita demandas, com a sugestão
-- (diretoria da área). da_presidencia: só essas valem numa demanda restrita.
create or replace view public.aprovadores_possiveis with (security_invoker = true) as
select pr.id as projeto_id, x.id as pessoa_id, x.nome, x.papel,
       privado.eh_presidencia(x.id) as da_presidencia,
       (x.id = s.sugerido) as sugerido
  from public.projetos pr
  cross join lateral (select privado.aprovador_sugerido(pr.id, false) as sugerido) s
  join public.pessoas x on x.ativo
 where coalesce(privado.papel_de(privado.eu()) <> 'membro', false)
   and privado.escopo_projeto(privado.eu(), pr.id)
   and privado.pode_ser_aprovador(x.id, pr.id, false);

-- quem pode ser informado (I) numa entrega que impacta a Fácil como um todo.
-- automatico: a Presidente, que entra sem precisar escolher. da_presidencia: só essas valem numa demanda restrita.
create or replace view public.pessoas_informaveis with (security_invoker = true) as
select x.id, x.nome, x.papel, x.area_id,
       (x.papel = 'presidente') as automatico,
       privado.eh_presidencia(x.id) as da_presidencia
  from public.pessoas x
 where x.ativo and (privado.eh_presidencia(x.id) or x.papel = 'diretor')
   and coalesce(privado.papel_de(privado.eu()) <> 'membro', false);

create or replace view public.demanda_conversa_painel with (security_invoker = true) as
select c.id, c.demanda_id, c.autor_id, p.nome as autor_nome, c.tipo, c.texto, c.criado_em
  from public.demanda_conversa c
  join public.pessoas p on p.id = c.autor_id;

-- o sino: as mesmas linhas do 20, mais as passagens da RACI
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
 where n.pessoa_id = privado.eu() and n.lida_em is null and n.tipo = 'raci';

revoke all on public.aprovadores_possiveis, public.pessoas_informaveis, public.demanda_conversa_painel from anon;
revoke insert, update, delete, truncate on public.demandas_visiveis, public.aprovadores_possiveis, public.pessoas_informaveis,
  public.demanda_conversa_painel, public.minhas_notificacoes from authenticated;
grant select on public.aprovadores_possiveis, public.pessoas_informaveis, public.demanda_conversa_painel to authenticated;
