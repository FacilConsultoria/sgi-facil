-- =====================================================================
-- SGI Fácil Consultoria · AMBIENTE DE DESENVOLVIMENTO · dados fictícios
-- Usar SÓ no projeto de desenvolvimento (sgi-facil-dev), no lugar do 02_dados_iniciais.sql,
-- depois dos scripts 01 e 03 a 19. Nunca na produção: o script se recusa a rodar num banco que
-- já tenha pessoas cadastradas.
--
-- ANTES DE RODAR:
--   1. Em Authentication → Users → Add user → Create new user, crie a sua conta de teste
--      (um e-mail que você controle e uma senha nova; marque "Auto Confirm User").
--   2. Troque o PREENCHER abaixo por esse mesmo e-mail.
--
-- O que o script faz:
--   - mesma estrutura de áreas e núcleos da produção;
--   - a sua conta de teste vira a Presidente (todas as permissões: vê tudo, cadastra, ajusta
--     pontos, edita regras, autoriza recados e pedidos de acesso), já com dados pessoais
--     fictícios e senha marcada como definida (entra direto com e-mail e senha);
--   - pessoas fictícias em cada cargo (e-mails @example.com, que não recebem nada);
--   - projetos, demandas (uma atrasada), uma reunião, um lançamento de pontos e um recado,
--     criados pelas próprias funções do sistema, como se a sua conta tivesse feito.
-- =====================================================================

do $$
declare
  -- ▼▼▼ preencha aqui ▼▼▼
  v_email_dev text := 'PREENCHER';   -- e-mail da conta de teste criada em Authentication → Users
  -- ▲▲▲ preencha aqui ▲▲▲
  v_login uuid; v_dev uuid; v_vice uuid; v_diretor uuid;
  v_ger_cli uuid; v_membro_a uuid; v_membro_b uuid; v_membro_mkt uuid;
  v_proj_cli uuid; v_proj_mkt uuid;
  v_demanda uuid;
begin
  if v_email_dev = 'PREENCHER' then
    raise exception 'Preencha o e-mail da conta de teste no início do script antes de rodar.';
  end if;
  if exists (select 1 from public.pessoas) then
    raise exception 'Este script é só para um banco novo de desenvolvimento: já existem pessoas cadastradas aqui.';
  end if;
  select id into v_login from auth.users where lower(email) = lower(trim(v_email_dev));
  if v_login is null then
    raise exception 'Crie antes a conta % em Authentication → Users (com senha e "Auto Confirm User").', lower(trim(v_email_dev));
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

  -- a conta de teste é a Presidente; as demais pessoas são fictícias
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id, auth_user_id)
    values (lower(trim(v_email_dev)), 'Dev', 'presidente', 'pres', null, v_login) returning id into v_dev;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values ('vice.teste@example.com', 'Vice Teste', 'vice', 'pres', null) returning id into v_vice;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values ('diretor.teste@example.com', 'Diretor Teste', 'diretor', 'com', null) returning id into v_diretor;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values ('gerente.entregas@example.com', 'Gerente Entregas', 'gerente', 'proj', 'proj-cli') returning id into v_ger_cli;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id) values
    ('gerente.captacao@example.com',  'Gerente Captação',  'gerente',  'com',  'com-cap'),
    ('gerente.marketing@example.com', 'Gerente Marketing', 'gerente',  'com',  'com-mkt'),
    ('assessoria.teste@example.com',  'Assessoria Teste',  'assessor', 'pres', 'pres-ass');
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values ('membro.a@example.com', 'Membro A', 'membro', 'proj', 'proj-cli') returning id into v_membro_a;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values ('membro.b@example.com', 'Membro B', 'membro', 'proj', 'proj-cli') returning id into v_membro_b;
  insert into public.pessoas (email, nome, papel, area_id, nucleo_id)
    values ('membro.mkt@example.com', 'Membro Marketing', 'membro', 'com', 'com-mkt') returning id into v_membro_mkt;

  update public.areas set titular = v_dev                          where id = 'pres';
  update public.areas set titular = v_diretor                      where id = 'com';
  update public.areas set titular = null, cobertura = v_diretor    where id = 'proj';
  update public.areas set titular = null, cobertura = v_dev        where id = 'adm';
  update public.areas set titular = v_vice                         where id = 'fin';

  -- a partir daqui, as funções do sistema rodam como se a conta de teste estivesse logada
  perform set_config('request.jwt.claim.sub', v_login::text, true);

  perform public.salvar_meus_dados('Pessoa Desenvolvedora Teste', 'DEV000000001', '52998224725', date '2000-01-01', 'nao_informar');
  update auth.users set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('senha_definida', true)
   where id = v_login;

  v_proj_cli := public.criar_projeto('Projeto de exemplo', 'Cliente fictício', 'proj-cli');
  v_proj_mkt := public.criar_projeto('Instagram de exemplo', 'Conteúdo', 'com-mkt');

  perform public.criar_demanda(v_proj_cli, 'Levantar requisitos (atrasada)', 'Demanda de exemplo com prazo vencido.',
    privado.hoje() - 3, 'alta', array[v_membro_a]);
  v_demanda := public.criar_demanda(v_proj_cli, 'Desenhar fluxo do processo', 'Demanda de exemplo em revisão.',
    privado.hoje() + 5, 'media', array[v_membro_a, v_membro_b]);
  perform public.mudar_status(v_demanda, 'revisao');
  perform public.criar_demanda(v_proj_mkt, 'Carrossel de apresentação', 'Demanda de exemplo da conta de teste.',
    privado.hoje() + 2, 'media', array[v_dev, v_membro_mkt]);

  perform public.criar_reuniao('Reunião geral de exemplo', privado.hoje() + 7, time '19:00', 'geral', null, 'Pauta de exemplo.');
  perform public.lancar_pontos(v_membro_a, 'evento', 3, privado.hoje(), 'Participação em evento de exemplo');
  perform public.publicar_recado('Ambiente de desenvolvimento',
    'Tudo aqui é fictício. Pode testar à vontade: nada afeta a produção.', 'todos');

  perform set_config('request.jwt.claim.sub', '', true);
end $$;
