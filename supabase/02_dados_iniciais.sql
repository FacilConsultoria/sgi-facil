-- =====================================================================
-- SGI Fácil Consultoria · 02 · Dados iniciais (estrutura Fácil 27)
-- Rodar depois do 01_estrutura_e_regras.sql.
--
-- ANTES DE RODAR: troque os quatro e-mails "PREENCHER" abaixo pelos
-- e-mails Google reais de cada pessoa. Quem entrar no SGI com um e-mail
-- que não está cadastrado não vê nada.
-- As demais pessoas (times, vagas preenchidas pelo PS) são cadastradas
-- depois pelo próprio sistema, pela Presidência ou pela Gente e Gestão.
-- =====================================================================

do $$
declare
  -- ▼▼▼ preencha aqui ▼▼▼
  v_email_presidencia text := 'PREENCHER';
  v_nome_presidencia  text := 'Presidente';        -- troque pelo nome do titular
  v_email_victor      text := 'PREENCHER';
  v_email_emilli      text := 'PREENCHER';
  v_email_duda        text := 'PREENCHER';
  -- ▲▲▲ preencha aqui ▲▲▲
  v_pres uuid; v_victor uuid; v_emilli uuid; v_duda uuid;
begin
  if 'PREENCHER' in (v_email_presidencia, v_email_victor, v_email_emilli, v_email_duda) then
    raise exception 'Preencha os quatro e-mails no início do script antes de rodar.';
  end if;

  insert into public.config default values on conflict (id) do nothing;

  insert into public.areas (id, titulo, sigla, nota) values
    ('pres', 'Presidência',              'PRE', 'Representa a Fácil, define estratégia e metas, coordena Comercial e Administrativa, lidera ENEJ e EDL.'),
    ('com',  'Diretoria Comercial',      'COM', 'Prospecção, relacionamento com clientes, Instagram Comercial e portfólio de serviços.'),
    ('proj', 'Diretoria de Projetos',    'PRJ', 'Vaga. A Diretoria Comercial assume entregas, cronograma e qualidade.'),
    ('adm',  'Diretoria Administrativa', 'ADM', 'Processos internos, documentação, conformidade com o MEJ e Gente e Gestão.'),
    ('fin',  'Diretoria Financeira',     'FIN', 'Vaga. A Presidência assume caixa, gastos, prestação de contas e orçamento.');

  insert into public.nucleos (id, area_id, nome, vaga, nota) values
    ('pres-ass', 'pres', 'Assessoria de Presidência',  true,  'Agenda, atas e comunicação institucional. PS em andamento.'),
    ('pres-gab', 'pres', 'Gabinete da Presidência',    false, null),
    ('com-cap',  'com',  'Captação e clientes',        false, null),
    ('com-mkt',  'com',  'Marketing',                  false, 'Instagram Comercial, peças visuais e métricas.'),
    ('proj-cli', 'proj', 'Entregas aos clientes',      false, null),
    ('adm-proc', 'adm',  'Processos internos',         false, null),
    ('adm-gg',   'adm',  'Gente e Gestão',             true,  'Liderança em aberto: PS, integração, desempenho e capacitações.'),
    ('fin-cx',   'fin',  'Caixa e prestação de contas', false, null);

  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values (lower(trim(v_email_presidencia)), v_nome_presidencia, 'presidente', 'pres', null) returning id into v_pres;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values (lower(trim(v_email_victor)), 'Victor', 'diretor', 'com', null) returning id into v_victor;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values (lower(trim(v_email_emilli)), 'Emilli', 'diretor', 'adm', null) returning id into v_emilli;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values (lower(trim(v_email_duda)), 'Duda', 'gerente', 'com', 'com-mkt') returning id into v_duda;

  -- titulares e coberturas de vacância
  update public.areas set titular = v_pres                  where id = 'pres';
  update public.areas set titular = v_victor                where id = 'com';
  update public.areas set titular = null, cobertura = v_victor where id = 'proj';
  update public.areas set titular = v_emilli                where id = 'adm';
  update public.areas set titular = null, cobertura = v_pres   where id = 'fin';

  -- quem já tiver feito login antes deste script fica vinculado agora
  update public.pessoas p set auth_user_id = u.id
    from auth.users u where lower(u.email) = p.email and p.auth_user_id is null;
end $$;
