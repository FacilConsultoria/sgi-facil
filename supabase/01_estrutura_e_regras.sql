-- =====================================================================
-- SGI Fácil Consultoria · 01 · Estrutura, regras de acesso e operações
-- Rodar uma vez no SQL Editor do Supabase, antes do 02_dados_iniciais.sql
--
-- Princípios
--   * Leitura: Row-Level Security (RLS). Cada pessoa só recebe do banco o
--     que a matriz hierárquica permite, não importa o que o site peça.
--   * Escrita: só por funções (RPC) que checam permissão e registram
--     auditoria. Não existe insert/update/delete direto para usuários.
--   * Regras auxiliares ficam no schema "privado", fora da API pública.
-- =====================================================================

create schema if not exists privado;

-- ---------- tipos ----------
create type public.papel as enum ('presidente','vice','diretor','gerente','assessor','membro');
create type public.status_demanda as enum ('afazer','andamento','revisao','concluida');
create type public.prioridade as enum ('alta','media','baixa');
create type public.escopo_reuniao as enum ('geral','presidencia','area','nucleo');
create type public.presenca as enum ('presente','justificada','falta');
create type public.tipo_lancamento as enum ('demanda','evento','falta','ajuste');
create type public.origem_registro as enum ('manual','meet');
create type public.status_solicitacao as enum ('pendente','aprovada','negada','revogada');
create type public.alvo_solicitacao as enum ('projeto','demanda');

-- ---------- estrutura ----------
-- "áreas" = Presidência e diretorias. Titular e cobertura de vacância.
create table public.areas (
  id        text primary key,
  titulo    text not null,
  sigla     text not null unique,
  titular   uuid,
  cobertura uuid,
  nota      text
);

create table public.nucleos (
  id      text primary key,
  area_id text not null references public.areas(id),
  nome    text not null,
  vaga    boolean not null default false,
  nota    text
);

create table public.pessoas (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email        text not null unique check (email = lower(email)),
  nome         text not null,
  papel        public.papel not null,
  area_id      text not null references public.areas(id),
  nucleo_id    text references public.nucleos(id),
  curso        text,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now(),
  check (papel in ('presidente','vice','diretor') or nucleo_id is not null)
);

alter table public.areas
  add foreign key (titular)   references public.pessoas(id),
  add foreign key (cobertura) references public.pessoas(id);

-- Configuração única (uma linha só)
create table public.config (
  id                    boolean primary key default true check (id),
  pontos_iniciais       int  not null default 10,
  entrega_no_prazo      int  not null default 2,
  entrega_atrasada      int  not null default 1,
  falta                 int  not null default -2,
  falta_justificada     int  not null default 0,
  ranking_publico       boolean not null default true,
  area_presidencia      text not null default 'pres',
  area_gestao_pessoas   text not null default 'adm',
  nucleo_gestao_pessoas text not null default 'adm-gg',
  fuso                  text not null default 'America/Sao_Paulo'
);

-- ---------- trabalho ----------
create table public.projetos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  cliente   text not null default '',
  nucleo_id text not null references public.nucleos(id),
  restrito  boolean not null default false,
  ativo     boolean not null default true,
  criado_por uuid references public.pessoas(id),
  criado_em timestamptz not null default now()
);

create table public.contadores (
  prefixo text primary key,
  ultimo  int not null default 0
);

create table public.demandas (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  projeto_id    uuid not null references public.projetos(id),
  titulo        text not null check (length(trim(titulo)) between 1 and 120),
  descricao     text not null default '',
  status        public.status_demanda not null default 'afazer',
  prioridade    public.prioridade not null default 'media',
  prazo         date not null,
  restrito      boolean not null default false,
  concluida_em  date,
  criado_por    uuid not null references public.pessoas(id),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table public.demanda_executores (
  demanda_id uuid not null references public.demandas(id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas(id),
  primary key (demanda_id, pessoa_id)
);

-- ---------- reuniões ----------
create table public.reunioes (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  data       date not null,
  hora       time not null,
  escopo     public.escopo_reuniao not null,
  escopo_id  text,               -- id da área (escopo 'area') ou do núcleo (escopo 'nucleo')
  pauta      text not null default '',
  encerrada  boolean not null default false,
  ata        text not null default '',
  ata_por    uuid references public.pessoas(id),
  ata_em     timestamptz,
  criado_por uuid not null references public.pessoas(id),
  criado_em  timestamptz not null default now(),
  check ((escopo in ('geral','presidencia')) = (escopo_id is null))
);

create table public.reuniao_convocados (
  reuniao_id uuid not null references public.reunioes(id) on delete cascade,
  pessoa_id  uuid not null references public.pessoas(id),
  presenca   public.presenca,
  primary key (reuniao_id, pessoa_id)
);

-- reuniao_id nulo = transcrição recebida pela integração e ainda não vinculada
create table public.transcricoes (
  id             uuid primary key default gen_random_uuid(),
  reuniao_id     uuid unique references public.reunioes(id) on delete cascade,
  texto          text not null,
  origem         public.origem_registro not null,
  titulo_origem  text,
  inicio_origem  timestamptz,
  registrado_por uuid references public.pessoas(id),
  recebida_em    timestamptz not null default now()
);

create table public.anexos (
  id          uuid primary key default gen_random_uuid(),
  reuniao_id  uuid not null references public.reunioes(id) on delete cascade,
  nome        text not null,
  tipo        text not null,
  tamanho     bigint not null,
  caminho     text not null unique,   -- caminho no bucket "anexos": <reuniao_id>/<arquivo>
  origem      public.origem_registro not null default 'manual',
  enviado_por uuid references public.pessoas(id),
  enviado_em  timestamptz not null default now()
);

-- ---------- pontuação ----------
create table public.lancamentos (
  id                     uuid primary key default gen_random_uuid(),
  pessoa_id              uuid not null references public.pessoas(id),
  tipo                   public.tipo_lancamento not null,
  descricao              text not null,
  data                   date not null,
  valor                  int not null,
  demanda_id             uuid references public.demandas(id) on delete set null,
  reuniao_id             uuid references public.reunioes(id) on delete set null,
  criado_por             uuid references public.pessoas(id),
  criado_em              timestamptz not null default now(),
  desconsiderado_por     uuid references public.pessoas(id),
  desconsiderado_em      timestamptz,
  motivo_desconsideracao text
);

-- ---------- exceções de acesso ----------
create table public.solicitacoes (
  id            uuid primary key default gen_random_uuid(),
  solicitante   uuid not null references public.pessoas(id),
  beneficiario  uuid not null references public.pessoas(id),
  alvo          public.alvo_solicitacao not null,
  projeto_id    uuid references public.projetos(id),
  demanda_id    uuid references public.demandas(id),
  justificativa text not null,
  valido_ate    date not null,
  status        public.status_solicitacao not null default 'pendente',
  decidido_por  uuid references public.pessoas(id),
  decidido_em   timestamptz,
  nota          text,
  revogado_por  uuid references public.pessoas(id),
  revogado_em   timestamptz,
  criado_em     timestamptz not null default now(),
  check ((alvo = 'projeto' and projeto_id is not null and demanda_id is null)
      or (alvo = 'demanda' and demanda_id is not null and projeto_id is null))
);

-- ---------- auditoria ----------
create table public.auditoria (
  id         bigint generated always as identity primary key,
  em         timestamptz not null default now(),
  ator       uuid references public.pessoas(id),   -- nulo = integração automática
  acao       text not null,
  detalhe    text not null,
  demanda_id uuid,
  reuniao_id uuid,
  membro_id  uuid,
  area_id    text,
  envolvidos uuid[] not null default '{}'
);

create index on public.demandas (projeto_id);
create index on public.demanda_executores (pessoa_id);
create index on public.reuniao_convocados (pessoa_id);
create index on public.lancamentos (pessoa_id);
create index on public.solicitacoes (beneficiario);
create index on public.auditoria (em desc);

-- =====================================================================
-- Regras de acesso (schema privado). Todas recebem a pessoa como
-- parâmetro, para servir tanto a quem está logado quanto a checagens
-- sobre outra pessoa (ex.: o beneficiário de um pedido).
-- =====================================================================

create or replace function privado.eu() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.pessoas where auth_user_id = auth.uid() and ativo
$$;

create or replace function privado.hoje() returns date
language sql stable security definer set search_path = public as $$
  select (now() at time zone coalesce((select fuso from public.config), 'America/Sao_Paulo'))::date
$$;

create or replace function privado.papel_de(p uuid) returns public.papel
language sql stable security definer set search_path = public as $$
  select papel from public.pessoas where id = p and ativo
$$;

-- Presex: Presidência e Vice-Presidência, com acesso irrestrito
create or replace function privado.eh_presidencia(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(privado.papel_de(p) in ('presidente','vice'), false)
$$;

-- só a Presidente: aprova pedidos de itens restritos e revoga qualquer acesso
create or replace function privado.eh_presidente(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(privado.papel_de(p) = 'presidente', false)
$$;

-- diretor (ou vice que acumula uma diretoria) titular ou que cobre a vacância da área
create or replace function privado.dirige(p uuid, p_area text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(privado.papel_de(p) in ('diretor','vice'), false)
     and exists (select 1 from public.areas a where a.id = p_area and (a.titular = p or a.cobertura = p))
$$;

create or replace function privado.lidera(p uuid, p_nucleo text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.pessoas
                 where id = p and ativo and papel in ('gerente','assessor') and nucleo_id = p_nucleo)
$$;

create or replace function privado.area_do_nucleo(p_nucleo text) returns text
language sql stable security definer set search_path = public as $$
  select area_id from public.nucleos where id = p_nucleo
$$;

create or replace function privado.eh_gestor_pessoas(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select privado.dirige(p, c.area_gestao_pessoas) or privado.lidera(p, c.nucleo_gestao_pessoas)
                   from public.config c), false)
$$;

-- projeto dentro do escopo hierárquico (sem contar exceções nem atribuição)
create or replace function privado.escopo_projeto(p uuid, p_projeto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.eh_presidencia(p) or exists (
    select 1 from public.projetos pr join public.nucleos n on n.id = pr.nucleo_id
    where pr.id = p_projeto and not pr.restrito
      and (privado.dirige(p, n.area_id) or privado.lidera(p, n.id)))
$$;

create or replace function privado.pode_gerir_demanda(p uuid, p_demanda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.eh_presidencia(p) or exists (
    select 1 from public.demandas d
      join public.projetos pr on pr.id = d.projeto_id
      join public.nucleos n on n.id = pr.nucleo_id
    where d.id = p_demanda and not d.restrito and not pr.restrito
      and (privado.dirige(p, n.area_id) or privado.lidera(p, n.id)))
$$;

create or replace function privado.concessao_ativa(p uuid, p_demanda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.solicitacoes s join public.demandas d on d.id = p_demanda
    where s.beneficiario = p and s.status = 'aprovada' and s.valido_ate >= privado.hoje()
      and (s.demanda_id = d.id or s.projeto_id = d.projeto_id))
$$;

-- executor sempre vê; exceção aprovada dá só leitura
create or replace function privado.pode_ver_demanda(p uuid, p_demanda uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (
       privado.pode_gerir_demanda(p, p_demanda)
    or exists (select 1 from public.demanda_executores where demanda_id = p_demanda and pessoa_id = p)
    or privado.concessao_ativa(p, p_demanda))
$$;

create or replace function privado.pode_ver_projeto(p uuid, p_projeto uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (
       privado.escopo_projeto(p, p_projeto)
    or exists (select 1 from public.demandas d where d.projeto_id = p_projeto and privado.pode_ver_demanda(p, d.id))
    or exists (select 1 from public.solicitacoes s
               where s.beneficiario = p and s.projeto_id = p_projeto
                 and s.status = 'aprovada' and s.valido_ate >= privado.hoje()))
$$;

-- quem pode ser executor de uma demanda criada/editada por p
create or replace function privado.pode_atribuir(p uuid, p_projeto uuid, p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.eh_presidencia(p)
      or exists (select 1 from public.pessoas x
                 where x.id = p_pessoa and x.ativo and (
                      x.id = p
                   or (privado.papel_de(p) = 'diretor' and privado.dirige(p, x.area_id))
                   or (privado.papel_de(p) in ('gerente','assessor')
                       and x.nucleo_id = (select nucleo_id from public.pessoas where id = p))))
$$;

-- pontuação detalhada (linha do tempo de lançamentos)
create or replace function privado.pode_ver_pontuacao(p uuid, p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and (
       p = p_pessoa or privado.eh_presidencia(p) or privado.eh_gestor_pessoas(p)
    or exists (select 1 from public.pessoas x where x.id = p_pessoa and (
             (x.papel not in ('presidente','vice') and privado.dirige(p, x.area_id))
          or (x.nucleo_id is not null and privado.lidera(p, x.nucleo_id)))))
$$;

create or replace function privado.pode_ajustar(p uuid, p_pessoa uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and p <> p_pessoa and (privado.eh_presidencia(p) or privado.eh_gestor_pessoas(p))
$$;

create or replace function privado.pode_gerir_reuniao(p uuid, p_reuniao uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and exists (
    select 1 from public.reunioes r where r.id = p_reuniao and (
         privado.eh_presidencia(p) or r.criado_por = p
      or (privado.papel_de(p) = 'assessor' and r.escopo in ('geral','presidencia'))
      or (r.escopo = 'area'   and privado.dirige(p, r.escopo_id))
      or (r.escopo = 'nucleo' and (privado.dirige(p, privado.area_do_nucleo(r.escopo_id)) or privado.lidera(p, r.escopo_id)))))
$$;

create or replace function privado.pode_ver_reuniao(p uuid, p_reuniao uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select privado.pode_gerir_reuniao(p, p_reuniao)
      or exists (select 1 from public.reuniao_convocados where reuniao_id = p_reuniao and pessoa_id = p)
$$;

create or replace function privado.pode_criar_reuniao(p uuid, p_escopo public.escopo_reuniao, p_id text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when privado.eh_presidencia(p) then true
    when privado.papel_de(p) = 'assessor' then p_escopo in ('geral','presidencia')
    when privado.papel_de(p) = 'diretor' then
         (p_escopo = 'area' and privado.dirige(p, p_id))
      or (p_escopo = 'nucleo' and privado.dirige(p, privado.area_do_nucleo(p_id)))
    when privado.papel_de(p) = 'gerente' then p_escopo = 'nucleo' and privado.lidera(p, p_id)
    else false end
$$;

-- área e restrição do alvo de uma solicitação
create or replace function privado.area_alvo(p_sol uuid) returns text
language sql stable security definer set search_path = public as $$
  select n.area_id from public.solicitacoes s
    left join public.demandas d on d.id = s.demanda_id
    join public.projetos pr on pr.id = coalesce(s.projeto_id, d.projeto_id)
    join public.nucleos n on n.id = pr.nucleo_id
  where s.id = p_sol
$$;

create or replace function privado.alvo_restrito(p_sol uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select pr.restrito or coalesce(d.restrito, false) from public.solicitacoes s
    left join public.demandas d on d.id = s.demanda_id
    join public.projetos pr on pr.id = coalesce(s.projeto_id, d.projeto_id)
  where s.id = p_sol
$$;

create or replace function privado.pode_aprovar(p uuid, p_sol uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and exists (
    select 1 from public.solicitacoes s
    where s.id = p_sol and s.status = 'pendente' and p <> s.beneficiario and p <> s.solicitante
      and (privado.eh_presidente(p)
           or (not privado.alvo_restrito(s.id) and privado.dirige(p, privado.area_alvo(s.id)))))
$$;

create or replace function privado.pode_ver_solicitacao(p uuid, p_sol uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p is not null and exists (
    select 1 from public.solicitacoes s join public.pessoas b on b.id = s.beneficiario
    where s.id = p_sol and (
         privado.eh_presidencia(p) or p = s.solicitante or p = s.beneficiario
      or (privado.papel_de(p) = 'diretor'
          and ((not privado.alvo_restrito(s.id) and privado.dirige(p, privado.area_alvo(s.id))) or privado.dirige(p, b.area_id)))
      or (privado.papel_de(p) in ('gerente','assessor')
          and b.nucleo_id = (select nucleo_id from public.pessoas where id = p))))
$$;

create or replace function privado.uuid_ou_nulo(t text) returns uuid
language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

-- =====================================================================
-- Leitura: RLS
-- Diretório de pessoas (nome, cargo, área) é visível a quem tem cadastro
-- ativo: as reuniões gerais já listam todos. O que é sensível (demandas,
-- pontuação, presença, atas, pedidos) segue a matriz hierárquica.
-- =====================================================================

alter table public.areas              enable row level security;
alter table public.nucleos            enable row level security;
alter table public.pessoas            enable row level security;
alter table public.config             enable row level security;
alter table public.projetos           enable row level security;
alter table public.contadores         enable row level security;
alter table public.demandas           enable row level security;
alter table public.demanda_executores enable row level security;
alter table public.reunioes           enable row level security;
alter table public.reuniao_convocados enable row level security;
alter table public.transcricoes       enable row level security;
alter table public.anexos             enable row level security;
alter table public.lancamentos        enable row level security;
alter table public.solicitacoes       enable row level security;
alter table public.auditoria          enable row level security;

create policy ler on public.areas    for select to authenticated using ((select privado.eu()) is not null);
create policy ler on public.nucleos  for select to authenticated using ((select privado.eu()) is not null);
create policy ler on public.pessoas  for select to authenticated using ((select privado.eu()) is not null);
create policy ler on public.config   for select to authenticated using ((select privado.eu()) is not null);
create policy ler on public.projetos for select to authenticated using (privado.pode_ver_projeto((select privado.eu()), id));
create policy ler on public.demandas for select to authenticated using (privado.pode_ver_demanda((select privado.eu()), id));
create policy ler on public.demanda_executores for select to authenticated using (privado.pode_ver_demanda((select privado.eu()), demanda_id));
create policy ler on public.reunioes for select to authenticated using (privado.pode_ver_reuniao((select privado.eu()), id));
create policy ler on public.reuniao_convocados for select to authenticated using (privado.pode_ver_reuniao((select privado.eu()), reuniao_id));
create policy ler on public.transcricoes for select to authenticated using (
  case when reuniao_id is null
       then privado.eh_presidencia((select privado.eu())) or privado.papel_de((select privado.eu())) = 'assessor'
       else privado.pode_ver_reuniao((select privado.eu()), reuniao_id) end);
create policy ler on public.anexos for select to authenticated using (privado.pode_ver_reuniao((select privado.eu()), reuniao_id));
create policy ler on public.lancamentos for select to authenticated using (privado.pode_ver_pontuacao((select privado.eu()), pessoa_id));
create policy ler on public.solicitacoes for select to authenticated using (privado.pode_ver_solicitacao((select privado.eu()), id));
create policy ler on public.auditoria for select to authenticated using (
     privado.eh_presidencia((select privado.eu()))
  or ator = (select privado.eu())
  or (select privado.eu()) = any(envolvidos)
  or (demanda_id is not null and privado.pode_ver_demanda((select privado.eu()), demanda_id))
  or (reuniao_id is not null and privado.pode_ver_reuniao((select privado.eu()), reuniao_id))
  or (membro_id  is not null and privado.pode_ver_pontuacao((select privado.eu()), membro_id))
  or (area_id    is not null and privado.dirige((select privado.eu()), area_id)));
-- contadores: sem política = ninguém lê diretamente

-- =====================================================================
-- Escrita: operações (RPC). Mensagens de erro já em português para o site.
-- =====================================================================

create or replace function privado.exigir_login() returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v uuid := privado.eu();
begin
  if v is null then raise exception 'Seu e-mail não tem cadastro ativo no SGI. Fale com a Gente e Gestão.'; end if;
  return v;
end $$;

create or replace function privado.registrar(p_acao text, p_detalhe text, p_demanda uuid default null,
  p_reuniao uuid default null, p_membro uuid default null, p_area text default null, p_envolvidos uuid[] default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.auditoria (ator, acao, detalhe, demanda_id, reuniao_id, membro_id, area_id, envolvidos)
  values (privado.eu(), p_acao, p_detalhe, p_demanda, p_reuniao, p_membro, p_area, coalesce(p_envolvidos, '{}'))
$$;

create or replace function privado.nome_status(s public.status_demanda) returns text
language sql immutable as $$
  select case s when 'afazer' then 'A fazer' when 'andamento' then 'Em andamento'
                when 'revisao' then 'Em revisão' else 'Concluída' end
$$;

-- concluir lança pontos para cada executor; reabrir desconsidera os pontos gerados
create or replace function privado.aplicar_status(p_demanda uuid, p_novo public.status_demanda) returns void
language plpgsql security definer set search_path = public as $$
declare d public.demandas%rowtype; c public.config%rowtype; v_hoje date := privado.hoje(); v_ok boolean;
begin
  select * into d from public.demandas where id = p_demanda for update;
  if d.status = p_novo then return; end if;
  if p_novo = 'concluida' and not privado.pode_gerir_demanda(privado.eu(), p_demanda) then
    raise exception 'Só a liderança do núcleo, a diretoria ou a Presidência validam a conclusão.';
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

-- ---------- pessoas e estrutura ----------
create or replace function public.cadastrar_pessoa(p_email text, p_nome text, p_papel public.papel,
  p_area text, p_nucleo text default null, p_curso text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid;
begin
  if not (privado.eh_presidencia(v_eu) or privado.eh_gestor_pessoas(v_eu)) then
    raise exception 'Só a Presidência e a Gente e Gestão cadastram pessoas.';
  end if;
  if p_papel in ('presidente','vice','diretor') and not privado.eh_presidencia(v_eu) then
    raise exception 'Só a Presidência cadastra Presidência, Vice-Presidência e diretorias.';
  end if;
  if p_nucleo is not null and privado.area_do_nucleo(p_nucleo) is distinct from p_area then
    raise exception 'O núcleo escolhido não pertence a essa área.';
  end if;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id, curso, auth_user_id)
  values (lower(trim(p_email)), trim(p_nome), p_papel, p_area, p_nucleo, p_curso,
          (select id from auth.users where lower(email) = lower(trim(p_email))))
  returning id into v_id;
  perform privado.registrar('Cadastrou pessoa', trim(p_nome) || ' (' || p_papel || ')', p_membro => v_id);
  return v_id;
exception when unique_violation then
  raise exception 'Já existe uma pessoa cadastrada com o e-mail %.', lower(trim(p_email));
end $$;

create or replace function public.atualizar_pessoa(p_id uuid, p_nome text, p_papel public.papel,
  p_area text, p_nucleo text, p_curso text, p_ativo boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_antes public.pessoas%rowtype;
begin
  select * into v_antes from public.pessoas where id = p_id;
  if not found then raise exception 'Pessoa não encontrada.'; end if;
  if not (privado.eh_presidencia(v_eu) or privado.eh_gestor_pessoas(v_eu)) then
    raise exception 'Só a Presidência e a Gente e Gestão alteram cadastros.';
  end if;
  if (p_papel in ('presidente','vice','diretor') or v_antes.papel in ('presidente','vice','diretor')) and not privado.eh_presidencia(v_eu) then
    raise exception 'Só a Presidência altera cadastros da Presidência e das diretorias.';
  end if;
  if p_nucleo is not null and privado.area_do_nucleo(p_nucleo) is distinct from p_area then
    raise exception 'O núcleo escolhido não pertence a essa área.';
  end if;
  update public.pessoas set nome = trim(p_nome), papel = p_papel, area_id = p_area, nucleo_id = p_nucleo,
         curso = p_curso, ativo = p_ativo where id = p_id;
  perform privado.registrar('Alterou cadastro', trim(p_nome), p_membro => p_id);
end $$;

create or replace function public.definir_lideranca_area(p_area text, p_titular uuid, p_cobertura uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  if not privado.eh_presidencia(v_eu) then raise exception 'Só a Presidência define titulares e coberturas.'; end if;
  update public.areas set titular = p_titular, cobertura = p_cobertura where id = p_area;
  if not found then raise exception 'Área não encontrada.'; end if;
  perform privado.registrar('Definiu liderança', p_area, p_area => p_area);
end $$;

-- ---------- projetos e demandas ----------
create or replace function public.criar_projeto(p_nome text, p_cliente text, p_nucleo text, p_restrito boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid; v_area text := privado.area_do_nucleo(p_nucleo);
begin
  if v_area is null then raise exception 'Núcleo não encontrado.'; end if;
  if not (privado.eh_presidencia(v_eu) or privado.dirige(v_eu, v_area) or privado.lidera(v_eu, p_nucleo)) then
    raise exception 'Você não pode criar projetos neste núcleo.';
  end if;
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Dê um nome ao projeto.'; end if;
  insert into public.projetos (nome, cliente, nucleo_id, restrito, criado_por)
  values (trim(p_nome), coalesce(trim(p_cliente), ''), p_nucleo, coalesce(p_restrito, false) and privado.eh_presidencia(v_eu), v_eu)
  returning id into v_id;
  perform privado.registrar('Criou projeto', trim(p_nome), p_area => v_area);
  return v_id;
end $$;

create or replace function public.criar_demanda(p_projeto uuid, p_titulo text, p_descricao text, p_prazo date,
  p_prioridade public.prioridade, p_executores uuid[], p_restrito boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_prefixo text; v_n int; v_codigo text; v_id uuid;
begin
  if privado.papel_de(v_eu) = 'membro' or not privado.escopo_projeto(v_eu, p_projeto) then
    raise exception 'Você não pode criar demandas neste projeto.';
  end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Dê um título à demanda.'; end if;
  if p_prazo is null then raise exception 'Informe o prazo.'; end if;
  if coalesce(array_length(p_executores, 1), 0) = 0 then raise exception 'Atribua pelo menos um executor.'; end if;
  if exists (select 1 from unnest(p_executores) e where not privado.pode_atribuir(v_eu, p_projeto, e)) then
    raise exception 'Há executores fora do seu escopo.';
  end if;
  select a.sigla into v_prefixo from public.projetos pr join public.nucleos n on n.id = pr.nucleo_id
    join public.areas a on a.id = n.area_id where pr.id = p_projeto;
  insert into public.contadores (prefixo, ultimo) values (v_prefixo, 1)
    on conflict (prefixo) do update set ultimo = public.contadores.ultimo + 1
    returning ultimo into v_n;
  v_codigo := v_prefixo || '-' || lpad(v_n::text, 3, '0');
  insert into public.demandas (codigo, projeto_id, titulo, descricao, prazo, prioridade, restrito, criado_por)
  values (v_codigo, p_projeto, trim(p_titulo), coalesce(trim(p_descricao), ''), p_prazo, p_prioridade,
          coalesce(p_restrito, false) and privado.eh_presidencia(v_eu), v_eu)
  returning id into v_id;
  insert into public.demanda_executores (demanda_id, pessoa_id)
    select distinct v_id, e from unnest(p_executores) e;
  perform privado.registrar('Criou demanda', v_codigo || ' · ' || trim(p_titulo), p_demanda => v_id, p_envolvidos => p_executores);
  return v_id;
end $$;

create or replace function public.editar_demanda(p_demanda uuid, p_titulo text, p_descricao text, p_status public.status_demanda,
  p_prioridade public.prioridade, p_prazo date, p_executores uuid[], p_restrito boolean default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); d public.demandas%rowtype;
begin
  select * into d from public.demandas where id = p_demanda;
  if not found or not privado.pode_gerir_demanda(v_eu, p_demanda) then raise exception 'Você não pode editar esta demanda.'; end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Dê um título à demanda.'; end if;
  if coalesce(array_length(p_executores, 1), 0) = 0 then raise exception 'Atribua pelo menos um executor.'; end if;
  if exists (select 1 from unnest(p_executores) e
             where not privado.pode_atribuir(v_eu, d.projeto_id, e)
               and not exists (select 1 from public.demanda_executores x where x.demanda_id = p_demanda and x.pessoa_id = e)) then
    raise exception 'Há executores fora do seu escopo.';
  end if;
  update public.demandas
     set titulo = trim(p_titulo), descricao = coalesce(trim(p_descricao), ''), prioridade = p_prioridade, prazo = p_prazo,
         restrito = case when privado.eh_presidencia(v_eu) and p_restrito is not null then p_restrito else restrito end,
         atualizado_em = now()
   where id = p_demanda;
  delete from public.demanda_executores where demanda_id = p_demanda and pessoa_id <> all(p_executores);
  insert into public.demanda_executores (demanda_id, pessoa_id)
    select distinct p_demanda, e from unnest(p_executores) e on conflict do nothing;
  perform privado.aplicar_status(p_demanda, p_status);
  perform privado.registrar('Editou demanda', d.codigo, p_demanda => p_demanda, p_envolvidos => p_executores);
end $$;

create or replace function public.mudar_status(p_demanda uuid, p_status public.status_demanda) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); d public.demandas%rowtype;
begin
  select * into d from public.demandas where id = p_demanda;
  if not found or not (privado.pode_gerir_demanda(v_eu, p_demanda)
      or exists (select 1 from public.demanda_executores where demanda_id = p_demanda and pessoa_id = v_eu)) then
    raise exception 'Você não pode alterar o status desta demanda.';
  end if;
  if d.status = p_status then return; end if;
  perform privado.aplicar_status(p_demanda, p_status);
  perform privado.registrar('Mudou status', d.codigo || ' para ' || privado.nome_status(p_status), p_demanda => p_demanda);
end $$;

-- ---------- pontuação ----------
create or replace function public.lancar_pontos(p_pessoa uuid, p_tipo public.tipo_lancamento, p_valor int,
  p_data date, p_justificativa text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid; v_nome text;
begin
  select nome into v_nome from public.pessoas where id = p_pessoa;
  if v_nome is null then raise exception 'Pessoa não encontrada.'; end if;
  if p_pessoa = v_eu then raise exception 'Ninguém ajusta a própria pontuação.'; end if;
  if not privado.pode_ajustar(v_eu, p_pessoa) then raise exception 'Só a Presidência e a Gente e Gestão lançam ajustes.'; end if;
  if p_tipo not in ('ajuste','evento') then raise exception 'Use o tipo Ajuste ou Evento.'; end if;
  if p_valor is null or p_valor = 0 or abs(p_valor) > 20 then raise exception 'Informe um valor inteiro entre −20 e 20, diferente de zero.'; end if;
  if p_data is null or p_data > privado.hoje() then raise exception 'Informe uma data de referência até hoje.'; end if;
  if length(trim(coalesce(p_justificativa, ''))) < 15 then raise exception 'Explique o ajuste em pelo menos 15 caracteres.'; end if;
  insert into public.lancamentos (pessoa_id, tipo, descricao, data, valor, criado_por)
  values (p_pessoa, p_tipo, trim(p_justificativa), p_data, p_valor, v_eu) returning id into v_id;
  perform privado.registrar(case when p_tipo = 'evento' then 'Lançou evento' else 'Lançou ajuste' end,
          case when p_valor > 0 then '+' else '' end || p_valor || ' para ' || v_nome, p_membro => p_pessoa);
  return v_id;
end $$;

create or replace function public.desconsiderar_lancamento(p_lancamento uuid, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); l public.lancamentos%rowtype;
begin
  select * into l from public.lancamentos where id = p_lancamento;
  if not found or l.desconsiderado_em is not null or not privado.pode_ajustar(v_eu, l.pessoa_id) then
    raise exception 'Você não pode desconsiderar este lançamento.';
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 10 then raise exception 'Escreva o motivo (mínimo 10 caracteres).'; end if;
  update public.lancamentos set desconsiderado_por = v_eu, desconsiderado_em = now(), motivo_desconsideracao = trim(p_motivo)
   where id = p_lancamento;
  perform privado.registrar('Desconsiderou lançamento', l.tipo || ' ' || l.valor || ': ' || trim(p_motivo), p_membro => l.pessoa_id);
end $$;

-- saldo de todos (ou só do escopo, se o ranking estiver restrito)
create or replace function public.ranking() returns table (pessoa_id uuid, nome text, setor text, pontos int, entregas int, faltas int)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome,
         coalesce(n.nome, a.titulo),
         (c.pontos_iniciais + coalesce(sum(l.valor), 0))::int,
         (count(*) filter (where l.tipo = 'demanda' and l.valor > 0))::int,
         (count(*) filter (where l.tipo = 'falta' and l.valor < 0))::int
    from public.pessoas p
    cross join public.config c
    join public.areas a on a.id = p.area_id
    left join public.nucleos n on n.id = p.nucleo_id
    left join public.lancamentos l on l.pessoa_id = p.id and l.desconsiderado_em is null
   where p.ativo and privado.eu() is not null
     and (c.ranking_publico or privado.eh_presidencia(privado.eu()) or privado.eh_gestor_pessoas(privado.eu())
          or privado.pode_ver_pontuacao(privado.eu(), p.id))
   group by p.id, p.nome, n.nome, a.titulo, c.pontos_iniciais
   order by 4 desc, 2
$$;

create or replace function public.salvar_config(p_pontos_iniciais int, p_entrega_no_prazo int, p_entrega_atrasada int,
  p_falta int, p_falta_justificada int, p_ranking_publico boolean) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  if not (privado.eh_presidencia(v_eu) or privado.dirige(v_eu, (select area_gestao_pessoas from public.config))) then
    raise exception 'Só a Presidência e a Diretoria Administrativa alteram as regras.';
  end if;
  if greatest(abs(p_pontos_iniciais), abs(p_entrega_no_prazo), abs(p_entrega_atrasada), abs(p_falta), abs(p_falta_justificada)) > 50 then
    raise exception 'Use números inteiros entre −50 e 50.';
  end if;
  update public.config set pontos_iniciais = p_pontos_iniciais, entrega_no_prazo = p_entrega_no_prazo,
         entrega_atrasada = p_entrega_atrasada, falta = p_falta, falta_justificada = p_falta_justificada,
         ranking_publico = p_ranking_publico;
  perform privado.registrar('Alterou regras de pontuação', 'Valores válidos para novos lançamentos',
          p_area => (select area_gestao_pessoas from public.config));
end $$;

-- ---------- reuniões ----------
create or replace function privado.convocados(p_escopo public.escopo_reuniao, p_id text) returns setof uuid
language sql stable security definer set search_path = public as $$
  select p.id from public.pessoas p cross join public.config c
   where p.ativo and (
        p_escopo = 'geral'
     or (p_escopo = 'presidencia' and p.area_id = c.area_presidencia)
     or (p_escopo = 'area'   and (p.area_id = p_id or privado.dirige(p.id, p_id)))
     or (p_escopo = 'nucleo' and (p.nucleo_id = p_id or privado.dirige(p.id, privado.area_do_nucleo(p_id)))))
$$;

create or replace function public.criar_reuniao(p_titulo text, p_data date, p_hora time,
  p_escopo public.escopo_reuniao, p_escopo_id text, p_pauta text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid;
begin
  if p_escopo = 'area' and not exists (select 1 from public.areas where id = p_escopo_id) then raise exception 'Área não encontrada.'; end if;
  if p_escopo = 'nucleo' and not exists (select 1 from public.nucleos where id = p_escopo_id) then raise exception 'Núcleo não encontrado.'; end if;
  if not privado.pode_criar_reuniao(v_eu, p_escopo, p_escopo_id) then raise exception 'Escolha um público da lista.'; end if;
  if length(trim(coalesce(p_titulo, ''))) = 0 then raise exception 'Dê um título à reunião.'; end if;
  if p_data is null or p_hora is null then raise exception 'Informe data e horário.'; end if;
  insert into public.reunioes (titulo, data, hora, escopo, escopo_id, pauta, criado_por)
  values (trim(p_titulo), p_data, p_hora, p_escopo,
          case when p_escopo in ('geral','presidencia') then null else p_escopo_id end,
          coalesce(trim(p_pauta), ''), v_eu)
  returning id into v_id;
  insert into public.reuniao_convocados (reuniao_id, pessoa_id)
    select v_id, x from privado.convocados(p_escopo, p_escopo_id) x;
  perform privado.registrar('Agendou reunião', trim(p_titulo) || ' em ' || to_char(p_data, 'DD/MM/YYYY'), p_reuniao => v_id);
  return v_id;
end $$;

-- p_presencas: {"<pessoa_id>": "presente" | "justificada" | "falta", ...}
create or replace function public.salvar_presencas(p_reuniao uuid, p_presencas jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  if not privado.pode_gerir_reuniao(v_eu, p_reuniao) then raise exception 'Você não pode registrar presença nesta reunião.'; end if;
  if (select encerrada from public.reunioes where id = p_reuniao) then
    raise exception 'A reunião já foi encerrada. Corrija pelo módulo de pontuações.';
  end if;
  update public.reuniao_convocados
     set presenca = nullif(p_presencas ->> pessoa_id::text, '')::public.presenca
   where reuniao_id = p_reuniao;
end $$;

create or replace function public.encerrar_reuniao(p_reuniao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); r public.reunioes%rowtype; c public.config%rowtype; v_faltando int; v_f int; v_j int;
begin
  select * into r from public.reunioes where id = p_reuniao for update;
  if not found or r.encerrada or not privado.pode_gerir_reuniao(v_eu, p_reuniao) then raise exception 'Você não pode encerrar esta reunião.'; end if;
  if r.data > privado.hoje() then raise exception 'A reunião ainda não aconteceu.'; end if;
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

create or replace function public.salvar_ata(p_reuniao uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  if not privado.pode_gerir_reuniao(v_eu, p_reuniao) then raise exception 'Você não pode editar esta ata.'; end if;
  update public.reunioes set ata = coalesce(trim(p_texto), ''), ata_por = v_eu, ata_em = now() where id = p_reuniao;
  perform privado.registrar('Atualizou ata', (select titulo from public.reunioes where id = p_reuniao), p_reuniao => p_reuniao);
end $$;

create or replace function public.salvar_transcricao(p_reuniao uuid, p_texto text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  if not privado.pode_gerir_reuniao(v_eu, p_reuniao) then raise exception 'Você não pode registrar a transcrição desta reunião.'; end if;
  if length(trim(coalesce(p_texto, ''))) < 30 then raise exception 'Cole a transcrição completa (mínimo 30 caracteres).'; end if;
  insert into public.transcricoes (reuniao_id, texto, origem, registrado_por)
  values (p_reuniao, trim(p_texto), 'manual', v_eu)
  on conflict (reuniao_id) do update set texto = excluded.texto, origem = 'manual',
     registrado_por = excluded.registrado_por, recebida_em = now();
  perform privado.registrar('Registrou transcrição', (select titulo from public.reunioes where id = p_reuniao), p_reuniao => p_reuniao);
end $$;

-- o site envia o arquivo ao bucket "anexos" em <reuniao_id>/<nome> e depois registra aqui
create or replace function public.registrar_anexo(p_reuniao uuid, p_nome text, p_tipo text, p_tamanho bigint, p_caminho text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); v_id uuid;
begin
  if not privado.pode_gerir_reuniao(v_eu, p_reuniao) then raise exception 'Só quem organiza a reunião anexa arquivos.'; end if;
  if p_caminho not like p_reuniao::text || '/%' then raise exception 'Caminho do arquivo inválido.'; end if;
  insert into public.anexos (reuniao_id, nome, tipo, tamanho, caminho, enviado_por)
  values (p_reuniao, p_nome, coalesce(nullif(p_tipo, ''), 'application/octet-stream'), p_tamanho, p_caminho, v_eu)
  returning id into v_id;
  perform privado.registrar('Anexou arquivo', p_nome, p_reuniao => p_reuniao);
  return v_id;
end $$;

-- remove o registro e devolve o caminho para o site apagar o arquivo do bucket
create or replace function public.remover_anexo(p_anexo uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); a public.anexos%rowtype;
begin
  select * into a from public.anexos where id = p_anexo;
  if not found or not privado.pode_gerir_reuniao(v_eu, a.reuniao_id) then raise exception 'Você não pode remover este anexo.'; end if;
  delete from public.anexos where id = p_anexo;
  perform privado.registrar('Removeu anexo', a.nome, p_reuniao => a.reuniao_id);
  return a.caminho;
end $$;

-- ---------- integração (Google Meet) ----------
-- Chamada só pela Edge Function "receber-transcricao", com a chave de serviço.
-- Vincula à reunião agendada do mesmo dia mais próxima do horário (até 2 h);
-- se não achar, guarda sem vínculo para alguém vincular depois.
create or replace function public.receber_transcricao_externa(p_titulo text, p_inicio timestamptz, p_texto text,
  p_origem public.origem_registro default 'meet') returns uuid
language plpgsql security definer set search_path = public as $$
declare v_fuso text := (select fuso from public.config); v_local timestamp; v_reuniao uuid; v_id uuid;
begin
  if length(trim(coalesce(p_texto, ''))) < 30 then raise exception 'Transcrição vazia ou curta demais.'; end if;
  v_local := p_inicio at time zone v_fuso;
  select r.id into v_reuniao from public.reunioes r
   where r.data = v_local::date
     and not exists (select 1 from public.transcricoes t where t.reuniao_id = r.id)
     and abs(extract(epoch from (r.hora - v_local::time))) <= 7200
   order by (lower(r.titulo) = lower(coalesce(p_titulo, ''))) desc, abs(extract(epoch from (r.hora - v_local::time)))
   limit 1;
  insert into public.transcricoes (reuniao_id, texto, origem, titulo_origem, inicio_origem)
  values (v_reuniao, trim(p_texto), p_origem, p_titulo, p_inicio) returning id into v_id;
  perform privado.registrar(case when v_reuniao is null then 'Recebeu transcrição sem reunião correspondente' else 'Recebeu transcrição' end,
          coalesce(p_titulo, 'sem título') || ' · ' || to_char(v_local, 'DD/MM/YYYY HH24:MI'), p_reuniao => v_reuniao);
  return v_id;
end $$;

create or replace function public.vincular_transcricao(p_transcricao uuid, p_reuniao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login();
begin
  if not privado.pode_gerir_reuniao(v_eu, p_reuniao) then raise exception 'Você não pode vincular transcrições a esta reunião.'; end if;
  if exists (select 1 from public.transcricoes where reuniao_id = p_reuniao) then raise exception 'Esta reunião já tem transcrição.'; end if;
  update public.transcricoes set reuniao_id = p_reuniao where id = p_transcricao and reuniao_id is null;
  if not found then raise exception 'Transcrição não encontrada ou já vinculada.'; end if;
  perform privado.registrar('Vinculou transcrição', (select titulo from public.reunioes where id = p_reuniao), p_reuniao => p_reuniao);
end $$;

-- ---------- exceções de acesso ----------
create or replace function public.solicitar_acesso(p_beneficiario uuid, p_alvo public.alvo_solicitacao, p_projeto uuid,
  p_codigo text, p_justificativa text, p_valido_ate date) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); b public.pessoas%rowtype; v_demanda uuid; v_id uuid; v_papel public.papel := privado.papel_de(v_eu);
begin
  select * into b from public.pessoas where id = p_beneficiario and ativo;
  if not found or privado.eh_presidencia(v_eu) or not (
       b.id = v_eu
    or (v_papel = 'diretor' and privado.dirige(v_eu, b.area_id) and b.papel not in ('presidente','vice'))
    or (v_papel in ('gerente','assessor') and b.nucleo_id = (select nucleo_id from public.pessoas where id = v_eu))) then
    raise exception 'Você não pode pedir acesso para essa pessoa.';
  end if;
  if length(trim(coalesce(p_justificativa, ''))) < 20 then raise exception 'Escreva uma justificativa com pelo menos 20 caracteres.'; end if;
  if p_valido_ate is null or p_valido_ate <= privado.hoje() or p_valido_ate > privado.hoje() + 90 then
    raise exception 'Escolha uma validade entre amanhã e 90 dias.';
  end if;
  if p_alvo = 'projeto' then
    if not exists (select 1 from public.projetos where id = p_projeto and not restrito)
       or privado.escopo_projeto(b.id, p_projeto)
       or exists (select 1 from public.solicitacoes s where s.beneficiario = b.id and s.projeto_id = p_projeto
                  and (s.status = 'pendente' or (s.status = 'aprovada' and s.valido_ate >= privado.hoje()))) then
      raise exception 'Escolha um projeto da lista.';
    end if;
  else
    select id into v_demanda from public.demandas where codigo = upper(trim(coalesce(p_codigo, '')));
    if v_demanda is null or privado.pode_ver_demanda(b.id, v_demanda) then
      raise exception 'Não há demanda com esse código que precise de liberação para essa pessoa.';
    end if;
  end if;
  insert into public.solicitacoes (solicitante, beneficiario, alvo, projeto_id, demanda_id, justificativa, valido_ate)
  values (v_eu, b.id, p_alvo, case when p_alvo = 'projeto' then p_projeto end, v_demanda, trim(p_justificativa), p_valido_ate)
  returning id into v_id;
  perform privado.registrar('Solicitou acesso', 'para ' || b.nome, p_area => privado.area_alvo(v_id), p_envolvidos => array[b.id]);
  return v_id;
end $$;

create or replace function public.decidir_solicitacao(p_solicitacao uuid, p_aprovar boolean, p_nota text) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); s public.solicitacoes%rowtype;
begin
  if not privado.pode_aprovar(v_eu, p_solicitacao) then raise exception 'Você não pode decidir esta solicitação.'; end if;
  update public.solicitacoes set status = case when p_aprovar then 'aprovada' else 'negada' end::public.status_solicitacao,
         decidido_por = v_eu, decidido_em = now(), nota = nullif(trim(coalesce(p_nota, '')), '')
   where id = p_solicitacao returning * into s;
  perform privado.registrar(case when p_aprovar then 'Aprovou acesso' else 'Negou acesso' end,
          'para ' || (select nome from public.pessoas where id = s.beneficiario),
          p_area => privado.area_alvo(s.id), p_envolvidos => array[s.solicitante, s.beneficiario]);
end $$;

create or replace function public.revogar_acesso(p_solicitacao uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_eu uuid := privado.exigir_login(); s public.solicitacoes%rowtype;
begin
  select * into s from public.solicitacoes where id = p_solicitacao;
  if not found or s.status <> 'aprovada' or s.valido_ate < privado.hoje()
     or not (privado.eh_presidente(v_eu) or s.decidido_por = v_eu) then
    raise exception 'Você não pode revogar este acesso.';
  end if;
  update public.solicitacoes set status = 'revogada', revogado_por = v_eu, revogado_em = now() where id = p_solicitacao;
  perform privado.registrar('Revogou acesso', 'de ' || (select nome from public.pessoas where id = s.beneficiario),
          p_area => privado.area_alvo(s.id), p_envolvidos => array[s.solicitante, s.beneficiario]);
end $$;

-- ---------- vincular login (Supabase Auth) ao cadastro pelo e-mail ----------
create or replace function privado.vincular_login() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.pessoas set auth_user_id = new.id
   where email = lower(new.email) and auth_user_id is null;
  return new;
end $$;

create trigger sgi_vincular_login after insert on auth.users
  for each row execute function privado.vincular_login();

-- =====================================================================
-- Permissões de execução
-- =====================================================================
grant usage on schema privado to authenticated;
revoke all on all functions in schema privado from public;
grant execute on function
  privado.eu(), privado.hoje(), privado.papel_de(uuid), privado.eh_presidencia(uuid), privado.eh_presidente(uuid), privado.dirige(uuid, text),
  privado.lidera(uuid, text), privado.area_do_nucleo(text), privado.eh_gestor_pessoas(uuid),
  privado.escopo_projeto(uuid, uuid), privado.pode_gerir_demanda(uuid, uuid), privado.concessao_ativa(uuid, uuid),
  privado.pode_ver_demanda(uuid, uuid), privado.pode_ver_projeto(uuid, uuid), privado.pode_ver_pontuacao(uuid, uuid),
  privado.pode_gerir_reuniao(uuid, uuid), privado.pode_ver_reuniao(uuid, uuid), privado.area_alvo(uuid),
  privado.alvo_restrito(uuid), privado.pode_ver_solicitacao(uuid, uuid), privado.uuid_ou_nulo(text)
to authenticated;

do $$
declare f record;
begin
  for f in select p.oid::regprocedure as assinatura, p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace
             and p.proname in ('cadastrar_pessoa','atualizar_pessoa','definir_lideranca_area','criar_projeto','criar_demanda',
                               'editar_demanda','mudar_status','lancar_pontos','desconsiderar_lancamento','ranking',
                               'salvar_config','criar_reuniao','salvar_presencas','encerrar_reuniao','salvar_ata',
                               'salvar_transcricao','registrar_anexo','remover_anexo','vincular_transcricao',
                               'solicitar_acesso','decidir_solicitacao','revogar_acesso','receber_transcricao_externa')
  loop
    execute format('revoke all on function %s from public, anon', f.assinatura);
    if f.proname = 'receber_transcricao_externa' then
      execute format('revoke all on function %s from authenticated', f.assinatura);
      execute format('grant execute on function %s to service_role', f.assinatura);
    else
      execute format('grant execute on function %s to authenticated', f.assinatura);
    end if;
  end loop;
end $$;

-- Tabelas: só leitura para usuários logados (filtrada pela RLS); escrita só via funções acima
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
grant select on all tables in schema public to authenticated;

-- =====================================================================
-- Arquivos: bucket privado "anexos" (pasta = id da reunião)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values ('anexos', 'anexos', false, 52428800)   -- até 50 MB por arquivo
on conflict (id) do nothing;

create policy sgi_anexos_ler on storage.objects for select to authenticated
  using (bucket_id = 'anexos' and privado.pode_ver_reuniao((select privado.eu()), privado.uuid_ou_nulo((storage.foldername(name))[1])));
create policy sgi_anexos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'anexos' and privado.pode_gerir_reuniao((select privado.eu()), privado.uuid_ou_nulo((storage.foldername(name))[1])));
create policy sgi_anexos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'anexos' and privado.pode_gerir_reuniao((select privado.eu()), privado.uuid_ou_nulo((storage.foldername(name))[1])));
