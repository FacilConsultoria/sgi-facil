-- =====================================================================
-- SGI Fácil Consultoria · 16 · Tratamento (gênero nos textos)
-- Rodar depois do 15.
--
-- O gênero informado no formulário de dados pessoais continua privado (só a própria
-- pessoa e a Presidente leem). Para o sistema escrever "a Presidente" ou "o Vice-Presidente"
-- corretamente, a função salvar_meus_dados também guarda a forma de tratamento em
-- pessoas.tratamento: 'feminino', 'masculino' ou 'neutro' (outro e prefiro não informar
-- viram neutro). Essa coluna todas as pessoas leem; o gênero em si, não. Enquanto a pessoa
-- não preenche, o tratamento é neutro e os textos usam o nome do cargo.
-- Também troca duas mensagens de pedido de aval que tinham gênero fixo.
-- =====================================================================

alter table public.pessoas
  add column tratamento text not null default 'neutro' check (tratamento in ('feminino', 'masculino', 'neutro'));

grant select (tratamento) on public.pessoas to authenticated;

-- quem já preencheu os dados antes desta migração
update public.pessoas p
   set tratamento = case d.genero when 'feminino' then 'feminino' when 'masculino' then 'masculino' else 'neutro' end
  from public.dados_pessoais d
 where d.pessoa_id = p.id;

-- ---------- salvar_meus_dados: igual ao 15, com o tratamento ----------
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
  update public.pessoas set tratamento = case p_genero when 'feminino' then 'feminino' when 'masculino' then 'masculino' else 'neutro' end where id = v_eu;
  perform privado.registrar('Atualizou dados pessoais', (select nome from public.pessoas where id = v_eu), p_membro => v_eu);
end $$;

-- ---------- solicitar_aval: igual ao 07, com as mensagens sem gênero fixo ----------
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
    if privado.eh_presex(v_eu) then raise exception 'A Presidência e a Vice-Presidência justificam a falta diretamente.'; end if;
    v_reuniao := (p_payload ->> 'reuniao')::uuid; v_pessoa := (p_payload ->> 'pessoa')::uuid;
    select * into r from public.reunioes where id = v_reuniao;
    if not found or not privado.pode_gerir_reuniao(v_eu, v_reuniao) then raise exception 'Você não pode pedir aval para esta reunião.'; end if;
    if r.encerrada then raise exception 'A reunião já foi encerrada.'; end if;
    if not exists (select 1 from public.reuniao_convocados rc join public.pessoas x on x.id = rc.pessoa_id
                    where rc.reuniao_id = v_reuniao and rc.pessoa_id = v_pessoa and x.papel = 'diretor' and rc.presenca = 'falta') then
      raise exception 'O aval vale para a falta de diretoria já registrada nesta reunião.';
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
