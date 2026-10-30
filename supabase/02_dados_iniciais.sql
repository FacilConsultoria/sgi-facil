-- =====================================================================
-- SGI Fácil Consultoria · 02 · Dados iniciais (estrutura 2027)
-- Rodar depois do 01_estrutura_e_regras.sql.
--
-- ANTES DE RODAR: troque os sete "PREENCHER" abaixo pelos e-mails Google
-- reais de cada pessoa. Quem entrar no SGI com um e-mail que não está
-- cadastrado não vê nada.
-- Não versione este arquivo com e-mails preenchidos: preencha só na hora
-- de colar no SQL Editor do Supabase.
-- As demais pessoas (membros dos times) são cadastradas depois pelo
-- próprio sistema, pela Presidência ou pela Gente e Gestão.
-- =====================================================================

do $$
declare
  -- ▼▼▼ preencha aqui ▼▼▼
  v_email_mel    text := 'PREENCHER';   -- Presidente
  v_email_luis   text := 'PREENCHER';   -- Vice-Presidente e Diretor Financeiro
  v_email_joao   text := 'PREENCHER';   -- Diretor Comercial (cobre a Diretoria de Projetos)
  v_email_victor text := 'PREENCHER';   -- Gerente de Entregas aos clientes (Projetos)
  v_email_emilli text := 'PREENCHER';   -- Gerente de Captação e clientes (Comercial)
  v_email_duda   text := 'PREENCHER';   -- Gerente de Marketing
  v_email_maju   text := 'PREENCHER';   -- Assessora de Presidência
  -- ▲▲▲ preencha aqui ▲▲▲
  v_mel uuid; v_luis uuid; v_joao uuid;
begin
  if 'PREENCHER' in (v_email_mel, v_email_luis, v_email_joao, v_email_victor, v_email_emilli, v_email_duda, v_email_maju) then
    raise exception 'Preencha os sete e-mails no início do script antes de rodar.';
  end if;

  insert into public.config default values on conflict (id) do nothing;

  insert into public.areas (id, titulo, sigla, nota) values
    ('pres', 'Presidência',              'PRE', 'Representa a Fácil, define estratégia e metas, coordena as diretorias e lidera ENEJ e EDL.'),
    ('com',  'Diretoria Comercial',      'COM', 'Prospecção, relacionamento com clientes, Instagram Comercial e portfólio de serviços.'),
    ('proj', 'Diretoria de Projetos',    'PRJ', 'Vaga. A Diretoria Comercial assume entregas, cronograma e qualidade.'),
    ('adm',  'Diretoria Administrativa', 'ADM', 'Vaga. A Presidência responde por processos internos, documentação, conformidade com o MEJ e Gente e Gestão.'),
    ('fin',  'Diretoria Financeira',     'FIN', 'Conduzida pela Vice-Presidência: caixa, gastos, prestação de contas e orçamento.');

  insert into public.nucleos (id, area_id, nome, vaga, nota) values
    ('pres-ass', 'pres', 'Assessoria de Presidência',   false, 'Agenda, atas e comunicação institucional.'),
    ('pres-gab', 'pres', 'Gabinete da Presidência',     false, null),
    ('com-cap',  'com',  'Captação e clientes',         false, 'Prospecção e relacionamento com clientes.'),
    ('com-mkt',  'com',  'Marketing',                   false, 'Instagram Comercial, peças visuais e métricas.'),
    ('proj-cli', 'proj', 'Entregas aos clientes',       false, 'Execução dos projetos, cronograma e qualidade.'),
    ('adm-proc', 'adm',  'Processos internos',          false, null),
    ('adm-gg',   'adm',  'Gente e Gestão',              true,  'Liderança em aberto: PS, integração, desempenho e capacitações.'),
    ('fin-cx',   'fin',  'Caixa e prestação de contas', false, null);

  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values (lower(trim(v_email_mel)), 'Mel', 'presidente', 'pres', null) returning id into v_mel;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values (lower(trim(v_email_luis)), 'Luis', 'vice', 'pres', null) returning id into v_luis;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values (lower(trim(v_email_joao)), 'João', 'diretor', 'com', null) returning id into v_joao;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id) values
    (lower(trim(v_email_victor)), 'Victor', 'gerente',  'proj', 'proj-cli'),
    (lower(trim(v_email_emilli)), 'Emilli', 'gerente',  'com',  'com-cap'),
    (lower(trim(v_email_duda)),   'Duda',   'gerente',  'com',  'com-mkt'),
    (lower(trim(v_email_maju)),   'Maju',   'assessor', 'pres', 'pres-ass');

  -- titulares e coberturas de vacância
  update public.areas set titular = v_mel                       where id = 'pres';
  update public.areas set titular = v_joao                      where id = 'com';
  update public.areas set titular = null, cobertura = v_joao    where id = 'proj';
  update public.areas set titular = null, cobertura = v_mel     where id = 'adm';
  update public.areas set titular = v_luis                      where id = 'fin';

  -- quem já tiver feito login antes deste script fica vinculado agora
  update public.pessoas p set auth_user_id = u.id
    from auth.users u where lower(u.email) = p.email and p.auth_user_id is null;
end $$;
