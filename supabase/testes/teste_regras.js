// Testes de integração das regras do banco do SGI.
// Roda os scripts 01, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13 e 02 num Postgres real (PGlite, no navegador) com as partes do
// Supabase simuladas (auth.uid(), papéis anon/authenticated/service_role e storage)
// e confere, perfil a perfil, o que cada pessoa pode ver e fazer.
// Execução: powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1
// O runner injeta window.SQL01 a window.SQL17 antes deste módulo. O 06 roda sozinho, antes do 07.
// Os e-mails usados aqui são fictícios (domínio facil.test).
import { PGlite } from 'https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.2.17/dist/index.js';

const linhas = [];
const saida = document.createElement('pre'); saida.id = 'out'; document.body.appendChild(saida);
const log = texto => { linhas.push(texto); saida.textContent = linhas.join('\n'); };
let falhas = 0, total = 0;
const confere = (rotulo, obtido, esperado) => {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  log(`${ok ? 'OK   ' : 'FALHA'} ${rotulo}${ok ? '' : ` | esperado ${JSON.stringify(esperado)}, obtido ${JSON.stringify(obtido)}`}`);
};

const SIMULACAO_SUPABASE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon, service_role;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant usage on schema public to authenticated, anon, service_role;
grant select on all tables in schema public to service_role;
`;

const EMAILS = { mel: 'Mel@facil.test', luis: 'luis@facil.test', joao: 'joao@facil.test', victor: 'victor@facil.test', emilli: 'emilli@facil.test', duda: 'duda@facil.test', maju: 'maju@facil.test' };

(async () => {
  try {
    const db = new PGlite();
    await db.exec(SIMULACAO_SUPABASE);
    await db.exec(`insert into auth.users(email) values ('mel@facil.test'),('joao@facil.test')`);
    await db.exec(window.SQL01);
    await db.exec(window.SQL03);
    await db.exec(window.SQL04);
    await db.exec(window.SQL05);
    await db.exec(window.SQL06);
    await db.exec(window.SQL07);
    await db.exec(window.SQL08);
    await db.exec(window.SQL09);
    await db.exec(window.SQL10);
    await db.exec(window.SQL11);
    await db.exec(window.SQL12);
    await db.exec(window.SQL13);
    await db.exec(window.SQL14);
    await db.exec(window.SQL15);
    await db.exec(window.SQL16);
    await db.exec(window.SQL17);
    await db.exec(window.SQL18);
    await db.exec(window.SQL19);
    await db.exec(window.SQL20);
    await db.exec(window.SQL21);
    await db.exec(window.SQL22);
    await db.exec(window.SQL23);
    await db.exec(window.SQL24);
    await db.exec(window.SQL25);
    await db.exec(window.SQL26);

    let erro02 = null;
    try { await db.exec(window.SQL02); } catch (e) { erro02 = e.message; }
    confere('02 recusa rodar sem os e-mails preenchidos', erro02, 'Preencha os sete e-mails no início do script antes de rodar.');
    let seed = window.SQL02;
    for (const [nome, email] of Object.entries(EMAILS)) seed = seed.replace(new RegExp(`(v_email_${nome}\\s+text := )'PREENCHER'`), `$1'${email}'`);
    await db.exec(seed);
    await db.exec(`insert into auth.users(email) values ('luis@facil.test'),('VICTOR@facil.test'),('emilli@facil.test'),('duda@facil.test'),('maju@facil.test')`);

    // executa como uma pessoa logada (email), visitante (null) ou integração ('servico')
    const idLogin = async email => (await db.query(`select id from auth.users where lower(email) = lower($1)`, [email])).rows[0]?.id ?? '';
    const como = async (email, sql, params = []) => {
      const sub = email && email !== 'servico' ? await idLogin(email) : '';
      return db.transaction(async tx => {
        await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub]);
        await tx.exec(email === 'servico' ? 'set local role service_role' : email === null ? 'set local role anon' : 'set local role authenticated');
        return (await tx.query(sql, params)).rows;
      });
    };
    const valor = async (email, sql, params) => Object.values((await como(email, sql, params))[0])[0];
    const tenta = async (email, sql, params) => { try { await como(email, sql, params); return 'permitido'; } catch (e) { return e.message; } };
    const permite = async (rotulo, email, sql, params) => confere(rotulo, await tenta(email, sql, params), 'permitido');
    const bloqueia = async (rotulo, email, sql, params, mensagem) => confere(rotulo, await tenta(email, sql, params), mensagem);

    confere('Logins existentes e novos vinculados ao cadastro',
      (await db.query(`select bool_and(auth_user_id is not null) as todos from pessoas`)).rows[0].todos, true);

    const MEL = 'mel@facil.test', LUIS = 'luis@facil.test', JOAO = 'joao@facil.test', VICTOR = 'victor@facil.test';
    const EMILLI = 'emilli@facil.test', DUDA = 'duda@facil.test', MAJU = 'maju@facil.test';
    const ANA = 'ana@facil.test', CAMILA = 'camila@facil.test', PEDRO = 'pedro@facil.test';
    for (const [email, nome, papel, area, nucleo] of [
      [ANA, 'Ana', 'membro', 'proj', 'proj-cli'], ['lucas@facil.test', 'Lucas', 'membro', 'proj', 'proj-cli'],
      [CAMILA, 'Camila', 'membro', 'com', 'com-mkt'], [PEDRO, 'Pedro', 'membro', 'adm', 'adm-gg']]) {
      await como(MEL, `select cadastrar_pessoa($1,$2,$3::papel,$4,$5)`, [email, nome, papel, area, nucleo]);
      await db.query(`insert into auth.users(email) values ($1)`, [email]);
    }
    const id = async nome => (await db.query(`select id from pessoas where nome = $1`, [nome])).rows[0].id;
    const [iAna, iLucas, iCamila, iPedro, iLuis, iJoao, iMel, iVictor] = await Promise.all(['Ana', 'Lucas', 'Camila', 'Pedro', 'Luis', 'João', 'Mel', 'Victor'].map(id));

    // cadastro
    await bloqueia('Gerência não cadastra pessoas', DUDA, `select cadastrar_pessoa('x@facil.test','X','membro','com','com-mkt')`, [], 'Só a Presidência e a Gente e Gestão cadastram pessoas.');
    await bloqueia('Diretoria fora de G&G não cadastra', JOAO, `select cadastrar_pessoa('y@facil.test','Y','membro','com','com-mkt')`, [], 'Só a Presidência e a Gente e Gestão cadastram pessoas.');
    await bloqueia('Núcleo precisa ser da área', MEL, `select cadastrar_pessoa('z@facil.test','Z','membro','com','adm-gg')`, [], 'O núcleo escolhido não pertence a essa área.');
    await permite('Vice-Presidência cadastra pessoas', LUIS, `select cadastrar_pessoa('w@facil.test','W','membro','com','com-mkt')`);
    await db.query(`update pessoas set ativo = false where email = 'w@facil.test'`);

    // projetos e demandas
    const pCli = await valor(MEL, `select criar_projeto('Mapeamento de processos','Padaria Trigo Bom','proj-cli')`);
    const pMkt = await valor(DUDA, `select criar_projeto('Instagram Comercial','Conteúdo','com-mkt')`);
    const pFin = await valor(LUIS, `select criar_projeto('Caixa e orçamento','Interno','fin-cx')`);
    const pEst = await valor(MEL, `select criar_projeto('Planejamento 2027','Interno','pres-gab', true)`);
    await bloqueia('Gerência não cria projeto em outra área', DUDA, `select criar_projeto('x','x','proj-cli')`, [], 'Você não pode criar projetos neste núcleo.');
    const dCli = await valor(JOAO, `select criar_demanda($1,'Desenhar fluxo AS-IS','',privado.hoje() + 5,'alta',array[$2,$3]::uuid[])`, [pCli, iAna, iLucas]);
    await bloqueia('Diretoria não atribui pessoa de outra área', JOAO, `select criar_demanda($1,'x','',privado.hoje(),'media',array[$2]::uuid[])`, [pCli, iPedro], 'Há executores fora do seu escopo.');
    await permite('Gerência cria demanda no próprio núcleo', VICTOR, `select criar_demanda($1,'Levantar indicadores','',privado.hoje() + 9,'media',array[$2]::uuid[])`, [pCli, iAna]);
    await valor(DUDA, `select criar_demanda($1,'Carrossel EJ','',privado.hoje() + 3,'media',array[$2]::uuid[])`, [pMkt, iCamila]);
    await bloqueia('Gerência não cria demanda em outra área', DUDA, `select criar_demanda($1,'x','',privado.hoje(),'media',array[$2]::uuid[])`, [pCli, iCamila], 'Você não pode criar demandas neste projeto.');
    await bloqueia('Membro não cria demanda', ANA, `select criar_demanda($1,'x','',privado.hoje(),'media',array[$2]::uuid[])`, [pCli, iAna], 'Você não pode criar demandas neste projeto.');
    await valor(MEL, `select criar_demanda($1,'Metas 2027','',privado.hoje() + 10,'alta',array[$2]::uuid[])`, [pEst, iMel]);
    await valor(LUIS, `select criar_demanda($1,'Orçamento 2027','',privado.hoje() + 15,'alta',array[$2,$3]::uuid[])`, [pFin, iLuis, iMel]);
    confere('Códigos por área', (await db.query(`select codigo from demandas order by codigo`)).rows.map(r => r.codigo), ['COM-001', 'FIN-001', 'PRE-001', 'PRJ-001', 'PRJ-002']);

    const visiveis = {};
    for (const n of ['mel', 'luis', 'joao', 'victor', 'emilli', 'duda', 'maju', 'ana', 'lucas', 'camila', 'pedro']) visiveis[n] = await valor(`${n}@facil.test`, `select count(*)::int from demandas`);
    confere('Demandas visíveis por perfil', visiveis, { mel: 5, luis: 5, joao: 3, victor: 2, emilli: 0, duda: 1, maju: 5, ana: 2, lucas: 1, camila: 1, pedro: 0 });
    confere('Vice-Presidência vê registro restrito', await valor(LUIS, `select count(*)::int from demandas where projeto_id = $1`, [pEst]), 1);
    confere('Diretoria não vê registro restrito da Presidência', await valor(JOAO, `select count(*)::int from demandas where projeto_id = $1`, [pEst]), 0);
    confere('Membro vê só o projeto em que atua', (await como(ANA, `select nome from projetos`)).map(r => r.nome), ['Mapeamento de processos']);

    // status e pontos
    await bloqueia('Executor não valida a própria entrega', ANA, `select mudar_status($1,'concluida')`, [dCli], 'Só quem aprova a entrega, a liderança do núcleo, a diretoria ou a Presidência validam a conclusão.');
    await permite('Executor move para revisão', ANA, `select mudar_status($1,'revisao')`, [dCli]);
    await permite('Gerência do núcleo valida a conclusão', VICTOR, `select mudar_status($1,'concluida')`, [dCli]);
    confere('Conclusão no prazo lança +2 por executor', await como(MEL, `select nome, pontos from ranking() where nome in ('Ana','Lucas') order by nome`), [{ nome: 'Ana', pontos: 12 }, { nome: 'Lucas', pontos: 12 }]);
    await permite('Gerência reabre', VICTOR, `select mudar_status($1,'revisao')`, [dCli]);
    confere('Reabrir desconsidera os pontos', await valor(MEL, `select pontos from ranking() where nome = 'Ana'`), 10);
    await bloqueia('Pessoa de fora não altera a demanda', CAMILA, `select mudar_status($1,'andamento')`, [dCli], 'Você não pode alterar o status desta demanda.');
    await permite('Diretoria edita e troca executores', JOAO, `select editar_demanda($1,'Fluxo AS-IS v2','','andamento','alta',privado.hoje() + 6,array[$2]::uuid[])`, [dCli, iAna]);
    confere('Executores após edição', await valor(MEL, `select count(*)::int from demanda_executores where demanda_id = $1`, [dCli]), 1);

    // pontuação (Gente e Gestão vaga: só a Presex ajusta)
    await permite('Vice-Presidência lança evento', LUIS, `select lancar_pontos($1,'evento',3,privado.hoje(),'Participação no EDL regional')`, [iAna]);
    await bloqueia('Diretoria fora de G&G não lança ajuste', JOAO, `select lancar_pontos($1,'ajuste',2,privado.hoje(),'Ajuste qualquer de teste aqui')`, [iAna], 'Só a Presidência e a Gente e Gestão lançam ajustes.');
    await bloqueia('Ninguém ajusta a própria pontuação', LUIS, `select lancar_pontos($1,'ajuste',2,privado.hoje(),'Ajuste qualquer de teste aqui')`, [iLuis], 'Ninguém ajusta a própria pontuação.');
    await bloqueia('Valor zero é recusado', LUIS, `select lancar_pontos($1,'ajuste',0,privado.hoje(),'Ajuste qualquer de teste aqui')`, [iAna], 'Informe um valor inteiro entre −20 e 20, diferente de zero.');
    const lancamento = await valor(MEL, `select id from lancamentos where tipo = 'evento' limit 1`);
    await bloqueia('Gerência comum não desconsidera', DUDA, `select desconsiderar_lancamento($1,'motivo de teste longo')`, [lancamento], 'Você não pode desconsiderar este lançamento.');
    await permite('Presidência desconsidera com motivo', MEL, `select desconsiderar_lancamento($1,'Lançado em duplicidade')`, [lancamento]);
    const pontuacoes = {};
    for (const n of ['ana', 'camila', 'duda', 'joao', 'victor']) pontuacoes[n] = await valor(`${n}@facil.test`, `select count(distinct pessoa_id)::int from lancamentos`);
    confere('Pessoas com pontuação detalhada visível', pontuacoes, { ana: 1, camila: 0, duda: 0, joao: 2, victor: 2 });
    confere('Ranking público mostra todos os ativos', (await como(PEDRO, `select * from ranking()`)).length, 11);

    // reuniões
    const r1 = await valor(JOAO, `select criar_reuniao('Status das entregas', privado.hoje(), '18:30', 'area', 'proj', 'Pauta')`);
    confere('Convocados da reunião de Projetos', (await db.query(`select p.nome from reuniao_convocados rc join pessoas p on p.id = rc.pessoa_id where reuniao_id = $1 order by 1`, [r1])).rows.map(r => r.nome), ['Ana', 'João', 'Lucas', 'Victor']);
    await bloqueia('Não encerra sem presença de todos', JOAO, `select encerrar_reuniao($1)`, [r1], 'Marque a presença de todos (4 sem registro).');
    await permite('Organizador salva presença', JOAO, `select salvar_presencas($1, $2::jsonb)`, [r1, JSON.stringify({ [iAna]: 'presente', [iLucas]: 'falta', [iJoao]: 'presente', [iVictor]: 'presente' })]);
    await permite('Organizador encerra', JOAO, `select encerrar_reuniao($1)`, [r1]);
    confere('Falta vira −2', await valor(MEL, `select valor from lancamentos where pessoa_id = $1 and tipo = 'falta'`, [iLucas]), -2);
    confere('Pessoa não convocada não vê a reunião', await valor(CAMILA, `select count(*)::int from reunioes where id = $1`, [r1]), 0);
    await permite('Assessoria agenda reunião geral', MAJU, `select criar_reuniao('Geral de novembro', privado.hoje() + 9, '19:00', 'geral', null, '')`);
    await permite('Assessoria (com acesso de Presidência) agenda reunião de diretoria', MAJU, `select criar_reuniao('Alinhamento da Comercial', privado.hoje() + 12, '19:00', 'area', 'com', '')`);
    await bloqueia('Gerência não agenda reunião geral', DUDA, `select criar_reuniao('x', privado.hoje(), '19:00', 'geral', null, '')`, [], 'Escolha um público da lista.');
    await permite('Gerência agenda reunião do núcleo', DUDA, `select criar_reuniao('Pauta de novembro', privado.hoje() + 2, '17:00', 'nucleo', 'com-mkt', '')`);
    await permite('Organizador salva ata', JOAO, `select salvar_ata($1,'Clientes dentro do prazo.')`, [r1]);
    await bloqueia('Convocado comum não edita ata', ANA, `select salvar_ata($1,'tentativa')`, [r1], 'Você não pode editar esta ata.');

    // anexos (storage)
    await permite('Organizador envia arquivo', JOAO, `insert into storage.objects(bucket_id,name) values ('anexos', $1)`, [r1 + '/apresentacao.pdf']);
    await bloqueia('Pessoa de fora não envia arquivo', CAMILA, `insert into storage.objects(bucket_id,name) values ('anexos', $1)`, [r1 + '/x.pdf'], 'new row violates row-level security policy for table "objects"');
    await permite('Organizador registra anexo', JOAO, `select registrar_anexo($1,'apresentacao.pdf','application/pdf',1000,$2)`, [r1, r1 + '/apresentacao.pdf']);
    confere('Convocado vê anexo e arquivo', [await valor(ANA, `select count(*)::int from anexos`), await valor(ANA, `select count(*)::int from storage.objects`)], [1, 1]);
    confere('Pessoa de fora não vê o arquivo', await valor(CAMILA, `select count(*)::int from storage.objects`), 0);

    // integração de transcrições
    await bloqueia('Usuário logado não chama a integração', JOAO, `select receber_transcricao_externa('x', now(), repeat('texto ',10))`, [], 'permission denied for function receber_transcricao_externa');
    const inicio = await valor(MEL, `select (privado.hoje() + time '18:40')::timestamp at time zone 'America/Sao_Paulo'`);
    await permite('Integração (service_role) envia transcrição', 'servico', `select receber_transcricao_externa('Status das entregas', $1, repeat('fala ',20))`, [inicio]);
    confere('Transcrição vinculada à reunião certa', await valor(MEL, `select count(*)::int from transcricoes where reuniao_id = $1 and origem = 'meet'`, [r1]), 1);
    await permite('Transcrição sem reunião correspondente fica guardada', 'servico', `select receber_transcricao_externa('Avulsa', now() - interval '3 days', repeat('fala ',20))`);
    confere('Sem vínculo: Assessoria vê, diretoria não', [await valor(MAJU, `select count(*)::int from transcricoes where reuniao_id is null`), await valor(JOAO, `select count(*)::int from transcricoes where reuniao_id is null`)], [1, 0]);

    // exceções de acesso
    await permite('Membro pede acesso a projeto de outra área', PEDRO, `select solicitar_acesso($1,'projeto',$2,null,'Vou apoiar a estimativa de custos de pessoal do projeto.',privado.hoje() + 30)`, [iPedro, pCli]);
    const pedido = await valor(MEL, `select id from solicitacoes limit 1`);
    await bloqueia('Pedido duplicado é recusado', PEDRO, `select solicitar_acesso($1,'projeto',$2,null,'Vou apoiar a estimativa de custos de pessoal do projeto.',privado.hoje() + 30)`, [iPedro, pCli], 'Escolha um projeto da lista.');
    await bloqueia('Ninguém aprova o próprio pedido', PEDRO, `select decidir_solicitacao($1,true,'')`, [pedido], 'Você não pode decidir esta solicitação.');
    await bloqueia('Gerência de outra área não aprova', DUDA, `select decidir_solicitacao($1,true,'')`, [pedido], 'Você não pode decidir esta solicitação.');
    confere('Diretoria dona da área vê o pedido', await valor(JOAO, `select count(*)::int from solicitacoes`), 1);
    await permite('Diretoria dona da área aprova', JOAO, `select decidir_solicitacao($1,true,'Só consulta')`, [pedido]);
    confere('Beneficiário passa a ver o projeto', await valor(PEDRO, `select count(*)::int from demandas where projeto_id = $1`, [pCli]), 2);
    await bloqueia('Exceção é só para consulta', PEDRO, `select mudar_status($1,'afazer')`, [dCli], 'Você não pode alterar o status desta demanda.');
    confere('Visão: exceção aparece como motivo e sem ações', await como(PEDRO, `select motivo_acesso, pode_gerir, pode_mudar_status from demandas_visiveis where id = $1`, [dCli]),
      [{ motivo_acesso: 'excecao', pode_gerir: false, pode_mudar_status: false }]);
    confere('Visão 04: exceção mostra até quando vale', await valor(PEDRO, `select excecao_ate = privado.hoje() + 30 from demandas_visiveis where id = $1`, [dCli]), true);
    await permite('Pedido para demanda restrita pode ser feito', CAMILA, `select solicitar_acesso($1,'demanda',null,'PRE-001','Quero ver as metas para planejar posts.',privado.hoje() + 10)`, [iCamila]);
    const pedidoRestrito = await valor(MEL, `select id from solicitacoes where demanda_id is not null`);
    await bloqueia('Diretoria não aprova item restrito', JOAO, `select decidir_solicitacao($1,true,'')`, [pedidoRestrito], 'Você não pode decidir esta solicitação.');
    await bloqueia('Vice-Presidência não aprova item restrito', LUIS, `select decidir_solicitacao($1,true,'')`, [pedidoRestrito], 'Você não pode decidir esta solicitação.');
    confere('Visão: só a Presidente pode aprovar item restrito', [
      await valor(JOAO, `select pode_aprovar from solicitacoes_visiveis where id = $1`, [pedidoRestrito]),
      await valor(LUIS, `select pode_aprovar from solicitacoes_visiveis where id = $1`, [pedidoRestrito]),
      await valor(MEL, `select pode_aprovar from solicitacoes_visiveis where id = $1`, [pedidoRestrito])], [false, false, true]);
    await permite('Quem aprovou pode revogar', JOAO, `select revogar_acesso($1)`, [pedido]);
    confere('Revogação corta o acesso na hora', await valor(PEDRO, `select count(*)::int from demandas where projeto_id = $1`, [pCli]), 0);

    // regras de pontuação (Administrativa vaga: só a Presex altera)
    await bloqueia('Gerência não altera regras', DUDA, `select salvar_config(10,2,1,-2,0,true)`, [], 'Só a Presidência e a Diretoria Administrativa alteram as regras.');
    await bloqueia('Diretoria comum não altera regras', JOAO, `select salvar_config(10,2,1,-2,0,true)`, [], 'Só a Presidência e a Diretoria Administrativa alteram as regras.');
    await permite('Vice-Presidência altera regras', LUIS, `select salvar_config(12,2,1,-2,0,true)`);
    confere('Pontos iniciais novos valem para todos', await valor(MEL, `select pontos from ranking() where nome = 'Ana'`), 12);

    // visões para a interface (03)
    confere('Perfil: diretoria que cobre vacância conduz duas áreas', await como(JOAO, `select areas_que_conduz, pode_ajustar_pontos, pode_editar_regras from meu_perfil`),
      [{ areas_que_conduz: ['com', 'proj'], pode_ajustar_pontos: false, pode_editar_regras: false }]);
    confere('Perfil: Vice conduz a Financeira e tem acesso de Presex', await como(LUIS, `select areas_que_conduz, eh_presidencia, eh_presidente, pode_ajustar_pontos, pode_editar_regras from meu_perfil`),
      [{ areas_que_conduz: ['fin'], eh_presidencia: true, eh_presidente: false, pode_ajustar_pontos: true, pode_editar_regras: true }]);
    confere('Perfil: login sem cadastro não tem perfil', (await como('sem-cadastro@facil.test', `select * from meu_perfil`)).length, 0);
    confere('Visão: executor pode mudar status, não gerir', await como(ANA, `select motivo_acesso, pode_gerir, pode_mudar_status from demandas_visiveis where id = $1`, [dCli]),
      [{ motivo_acesso: 'executor', pode_gerir: false, pode_mudar_status: true }]);
    confere('Visão: diretoria gere as demandas da área', await como(JOAO, `select motivo_acesso, pode_gerir from demandas_visiveis where id = $1`, [dCli]),
      [{ motivo_acesso: 'diretoria', pode_gerir: true }]);
    confere('Visão: gerência gere as demandas do núcleo', await como(VICTOR, `select motivo_acesso, pode_gerir from demandas_visiveis where id = $1`, [dCli]),
      [{ motivo_acesso: 'nucleo', pode_gerir: true }]);
    confere('Visão: demandas visíveis = demandas da RLS', await valor(JOAO, `select count(*)::int from demandas_visiveis`), await valor(JOAO, `select count(*)::int from demandas`));
    confere('Visão: reunião para convocado comum', await como(ANA, `select pode_gerir, convocado, total_anexos, tem_transcricao from reunioes_visiveis where id = $1`, [r1]),
      [{ pode_gerir: false, convocado: true, total_anexos: 1, tem_transcricao: true }]);
    confere('Visão: reunião invisível para quem não foi convocado', (await como(CAMILA, `select id from reunioes_visiveis where id = $1`, [r1])).length, 0);
    confere('Visitante sem login não lê o perfil', (await tenta(null, `select * from meu_perfil`)).startsWith('permission denied'), true);
    confere('Visão não aceita gravação', (await tenta(JOAO, `update reunioes_visiveis set titulo = 'x'`)).startsWith('permission denied'), true);

    // módulo de demandas (04)
    await permite('Gerência valida a conclusão de novo', VICTOR, `select mudar_status($1,'concluida')`, [dCli]);
    confere('Visão 04: executor não muda status de demanda concluída', await como(ANA, `select pode_gerir, pode_mudar_status from demandas_visiveis where id = $1`, [dCli]),
      [{ pode_gerir: false, pode_mudar_status: false }]);
    await bloqueia('Executor não reabre demanda concluída', ANA, `select mudar_status($1,'andamento')`, [dCli], 'Só a liderança do núcleo, a diretoria ou a Presidência reabrem uma demanda concluída.');
    await permite('Gerência reabre demanda concluída', VICTOR, `select mudar_status($1,'andamento')`, [dCli]);
    confere('Visão 04: executor volta a mudar status depois de reaberta', await valor(ANA, `select pode_mudar_status from demandas_visiveis where id = $1`, [dCli]), true);
    confere('Visão 04: núcleo e exceção vazia para executor', await como(ANA, `select nucleo_nome, excecao_ate from demandas_visiveis where id = $1`, [dCli]),
      [{ nucleo_nome: 'Entregas aos clientes', excecao_ate: null }]);
    confere('Visão 04: projetos e quem cria demanda neles', {
      duda: await como(DUDA, `select nome, pode_criar_demanda from projetos_visiveis order by nome`),
      ana: await como(ANA, `select nome, pode_criar_demanda from projetos_visiveis order by nome`),
      joao: await como(JOAO, `select nome, pode_criar_demanda from projetos_visiveis order by nome`),
    }, {
      duda: [{ nome: 'Instagram Comercial', pode_criar_demanda: true }],
      ana: [{ nome: 'Mapeamento de processos', pode_criar_demanda: false }],
      joao: [{ nome: 'Instagram Comercial', pode_criar_demanda: true }, { nome: 'Mapeamento de processos', pode_criar_demanda: true }],
    });
    confere('Visão 04: projetos visíveis = projetos da RLS', await valor(MEL, `select count(*)::int from projetos_visiveis`), await valor(MEL, `select count(*)::int from projetos`));
    confere('Visão 04: núcleos onde cada perfil cria projetos', {
      mel: await valor(MEL, `select count(*)::int from nucleos_visiveis where pode_criar_projeto`),
      joao: (await como(JOAO, `select id from nucleos_visiveis where pode_criar_projeto order by id`)).map(r => r.id),
      duda: (await como(DUDA, `select id from nucleos_visiveis where pode_criar_projeto order by id`)).map(r => r.id),
      ana: await valor(ANA, `select count(*)::int from nucleos_visiveis where pode_criar_projeto`),
    }, { mel: 8, joao: ['com-cap', 'com-mkt', 'proj-cli'], duda: ['com-mkt'], ana: 0 });
    confere('Visão 04: pessoas que cada perfil pode atribuir', {
      mel: await valor(MEL, `select count(*)::int from pessoas_atribuiveis`),
      joao: (await como(JOAO, `select nome from pessoas_atribuiveis order by nome`)).map(r => r.nome),
      duda: (await como(DUDA, `select nome from pessoas_atribuiveis order by nome`)).map(r => r.nome),
      ana: (await como(ANA, `select nome from pessoas_atribuiveis order by nome`)).map(r => r.nome),
    }, { mel: 11, joao: ['Ana', 'Camila', 'Duda', 'Emilli', 'João', 'Lucas', 'Victor'], duda: ['Camila', 'Duda'], ana: ['Ana'] });
    confere('Visão 04: login sem cadastro não vê núcleos nem pessoas', [
      await valor('sem-cadastro@facil.test', `select count(*)::int from nucleos_visiveis`),
      await valor('sem-cadastro@facil.test', `select count(*)::int from pessoas_atribuiveis`)], [0, 0]);
    confere('Visitante sem login não lê as visões 04', (await tenta(null, `select * from projetos_visiveis`)).startsWith('permission denied'), true);
    confere('Visões 04 não aceitam gravação', (await tenta(MEL, `delete from pessoas_atribuiveis`)).startsWith('permission denied'), true);

    // módulo de reuniões (05)
    const publicos = async email => (await como(email, `select escopo || ':' || coalesce(escopo_id, '') as chave from escopos_de_reuniao where pode_criar order by 1`)).map(r => r.chave);
    confere('Visão 05: públicos em que cada perfil agenda reunião', {
      mel: (await publicos(MEL)).length,
      luis: (await publicos(LUIS)).length,
      maju: (await publicos(MAJU)).length,
      joao: await publicos(JOAO),
      duda: await publicos(DUDA),
      ana: await publicos(ANA),
    }, {
      mel: 15, luis: 15, maju: 15,
      joao: ['area:com', 'area:proj', 'geral:', 'nucleo:com-cap', 'nucleo:com-mkt', 'nucleo:proj-cli', 'pessoas:'],
      duda: ['nucleo:com-mkt', 'pessoas:'],
      ana: [],
    });
    confere('Visão 05: a área da Presidência não repete o público Presidência', await valor(MEL, `select count(*)::int from escopos_de_reuniao where escopo = 'area' and escopo_id = 'pres'`), 0);
    confere('Visão 05: quantas pessoas cada público convoca', await como(ANA, `select escopo || ':' || coalesce(escopo_id, '') as chave, total_convocados from escopos_de_reuniao where (escopo, coalesce(escopo_id, '')) in (('geral',''),('presidencia',''),('area','proj'),('nucleo','com-mkt')) order by 1`),
      [{ chave: 'area:proj', total_convocados: 4 }, { chave: 'geral:', total_convocados: 11 }, { chave: 'nucleo:com-mkt', total_convocados: 3 }, { chave: 'presidencia:', total_convocados: 3 }]);
    confere('Visão 05: nome do público para exibir', await valor(ANA, `select titulo from escopos_de_reuniao where escopo = 'nucleo' and escopo_id = 'com-mkt'`), 'Marketing · Diretoria Comercial');
    confere('Visão 05: login sem cadastro não vê públicos', await valor('sem-cadastro@facil.test', `select count(*)::int from escopos_de_reuniao`), 0);
    confere('Visitante sem login não lê os públicos', (await tenta(null, `select * from escopos_de_reuniao`)).startsWith('permission denied'), true);
    confere('Visão 05: reunião encerrada mostra convocados e faltas', await como(JOAO, `select total_convocados, total_faltas, pode_gerir, pode_encerrar from reunioes_visiveis where id = $1`, [r1]),
      [{ total_convocados: 4, total_faltas: 1, pode_gerir: true, pode_encerrar: false }]);
    const rHoje = await valor(JOAO, `select criar_reuniao('Reunião de hoje', privado.hoje(), '10:00', 'area', 'proj', '')`);
    confere('Visão 05: só quem organiza encerra, e só a partir do dia', {
      joao: await valor(JOAO, `select pode_encerrar from reunioes_visiveis where id = $1`, [rHoje]),
      ana: await valor(ANA, `select pode_encerrar from reunioes_visiveis where id = $1`, [rHoje]),
      futura: await valor(DUDA, `select bool_or(pode_encerrar) from reunioes_visiveis where titulo = 'Pauta de novembro'`),
    }, { joao: true, ana: false, futura: false });
    confere('Visões 05 não aceitam gravação', (await tenta(MEL, `update reunioes_visiveis set titulo = 'x'`)).startsWith('permission denied'), true);

    // Assessoria de Presidência, avais, público por pessoas e exclusão (06 e 07)
    const iMaju = await id('Maju');
    confere('Assessoria tem o acesso da Presidência, sem ser a Presidente', await como(MAJU, `select eh_presidencia, eh_presidente, pode_ajustar_pontos from meu_perfil`),
      [{ eh_presidencia: true, eh_presidente: false, pode_ajustar_pontos: true }]);
    await permite('Assessoria cria projeto em qualquer núcleo', MAJU, `select criar_projeto('Rotina da Assessoria','Interno','com-mkt')`);
    await permite('Assessoria vê e gere registro restrito da Presidência', MAJU, `select mudar_status($1,'andamento')`, [(await valor(MEL, `select id from demandas where codigo = 'PRE-001'`))]);
    await bloqueia('Assessoria não ajusta a própria pontuação direto', MAJU, `select lancar_pontos($1,'ajuste',2,privado.hoje(),'Ajuste qualquer de teste aqui')`, [iMaju], 'Ninguém ajusta a própria pontuação.');
    await bloqueia('Assessoria não aprova item restrito direto', MAJU, `select decidir_solicitacao($1,true,'')`, [pedidoRestrito], 'Você não pode decidir esta solicitação.');
    confere('Perfil: só a Presidente e a Vice dão aval', [
      await valor(MEL, `select pode_justificar_diretoria from reunioes_visiveis limit 1`),
      await valor(LUIS, `select pode_justificar_diretoria from reunioes_visiveis limit 1`),
      await valor(JOAO, `select pode_justificar_diretoria from reunioes_visiveis limit 1`),
      await valor(MAJU, `select pode_justificar_diretoria from reunioes_visiveis limit 1`)], [true, true, false, false]);

    // aval: ajuste da própria pontuação
    const ajuste = `jsonb_build_object('tipo','ajuste','valor',2,'data',privado.hoje())`;
    await bloqueia('Só a Assessoria pede aval de ajuste próprio', JOAO, `select solicitar_aval('ajuste_proprio', ${ajuste}, 'Ajuste que não deveria ser permitido a ele')`, [], 'Só a Assessoria de Presidência pede aval para ajustar a própria pontuação.');
    await bloqueia('Aval exige explicação', MAJU, `select solicitar_aval('ajuste_proprio', ${ajuste}, 'curto')`, [], 'Explique o pedido em pelo menos 15 caracteres.');
    await bloqueia('Aval de ajuste valida o valor', MAJU, `select solicitar_aval('ajuste_proprio', jsonb_build_object('tipo','ajuste','valor',0,'data',privado.hoje()), 'Horas extras do evento regional de outubro')`, [], 'Informe o tipo, um valor inteiro entre −20 e 20 (diferente de zero) e uma data até hoje.');
    const avalAjuste = await valor(MAJU, `select solicitar_aval('ajuste_proprio', ${ajuste}, 'Horas extras do evento regional de outubro')`);
    confere('Aval pendente: Assessoria vê o próprio, a Presidente decide, João não vê', {
      maju: await como(MAJU, `select status, pode_decidir from avais_visiveis where id = $1`, [avalAjuste]),
      mel: await como(MEL, `select status, pode_decidir from avais_visiveis where id = $1`, [avalAjuste]),
      joao: (await como(JOAO, `select id from avais_visiveis`)).length,
    }, { maju: [{ status: 'pendente', pode_decidir: false }], mel: [{ status: 'pendente', pode_decidir: true }], joao: 0 });
    await bloqueia('A Assessoria não decide o próprio aval', MAJU, `select decidir_aval($1,true,'')`, [avalAjuste], 'Você não pode decidir este aval.');
    await bloqueia('Diretoria não decide aval', JOAO, `select decidir_aval($1,true,'')`, [avalAjuste], 'Você não pode decidir este aval.');
    await permite('Presidente aprova o aval', MEL, `select decidir_aval($1,true,'Autorizado')`, [avalAjuste]);
    confere('Aprovar executa o ajuste para a Assessoria', await como(MEL, `select tipo, valor, criado_por = $2 as por_presidente from lancamentos where pessoa_id = $1 and tipo = 'ajuste'`, [iMaju, iMel]),
      [{ tipo: 'ajuste', valor: 2, por_presidente: true }]);
    await bloqueia('Aval decidido não decide de novo', LUIS, `select decidir_aval($1,true,'')`, [avalAjuste], 'Você não pode decidir este aval.');
    const avalNegado = await valor(MAJU, `select solicitar_aval('ajuste_proprio', ${ajuste}, 'Segundo ajuste solicitado para o mesmo evento')`);
    await permite('Vice nega o aval', LUIS, `select decidir_aval($1,false,'Já compensado no ajuste anterior')`, [avalNegado]);
    confere('Negar não executa nada', [await valor(MEL, `select count(*)::int from lancamentos where pessoa_id = $1 and tipo = 'ajuste'`, [iMaju]), await valor(MAJU, `select status from avais_visiveis where id = $1`, [avalNegado])], [1, 'negado']);

    // aval: aprovar acesso por exceção
    await permite('Pedido de acesso para o aval', PEDRO, `select solicitar_acesso($1,'projeto',$2,null,'Vou apoiar a estimativa de custos de pessoal do projeto.',privado.hoje() + 30)`, [iPedro, pCli]);
    const pedido2 = await valor(MEL, `select id from solicitacoes where beneficiario = $1 and status = 'pendente'`, [iPedro]);
    await bloqueia('Gerência não pede aval de acesso', DUDA, `select solicitar_aval('decidir_solicitacao', jsonb_build_object('solicitacao',$1::text,'aprovar',true), 'Aprovação que não é da gerência dela')`, [pedido2], 'Só a Assessoria de Presidência pede aval para decidir acessos por exceção.');
    const avalAcesso = await valor(MAJU, `select solicitar_aval('decidir_solicitacao', jsonb_build_object('solicitacao',$1::text,'aprovar',true,'nota','Só consulta'), 'Apoio ao orçamento, aprovado pela assessoria')`, [pedido2]);
    await bloqueia('Aval duplicado para a mesma solicitação', MAJU, `select solicitar_aval('decidir_solicitacao', jsonb_build_object('solicitacao',$1::text,'aprovar',true), 'Mesmo pedido enviado uma segunda vez')`, [pedido2], 'Já existe um pedido de aval pendente para esta solicitação.');
    confere('Sem o aval, o acesso ainda não existe', await valor(PEDRO, `select count(*)::int from demandas where projeto_id = $1`, [pCli]), 0);
    await permite('Presidente aprova o aval e o acesso é concedido', MEL, `select decidir_aval($1,true,'')`, [avalAcesso]);
    confere('Acesso por exceção vale depois do aval', await valor(PEDRO, `select count(*)::int from demandas where projeto_id = $1`, [pCli]), 2);
    const avalRestrito = await valor(MAJU, `select solicitar_aval('decidir_solicitacao', jsonb_build_object('solicitacao',$1::text,'aprovar',true), 'Planejamento de posts sobre as metas 2027')`, [pedidoRestrito]);
    await bloqueia('Vice não executa aprovação de item restrito', LUIS, `select decidir_aval($1,true,'')`, [avalRestrito], 'Você não pode decidir esta solicitação.');
    confere('Aval segue pendente depois do erro', await valor(MEL, `select status from avais_visiveis where id = $1`, [avalRestrito]), 'pendente');
    await permite('Presidente aprova item restrito pelo aval', MEL, `select decidir_aval($1,true,'')`, [avalRestrito]);
    confere('Camila passa a ver a demanda restrita', await valor(CAMILA, `select count(*)::int from demandas where codigo = 'PRE-001'`), 1);

    // público por pessoas escolhidas
    confere('Quem cada perfil pode escolher pessoalmente', {
      mel: await valor(MEL, `select count(*)::int from pessoas_convocaveis`),
      joao: await valor(JOAO, `select count(*)::int from pessoas_convocaveis`),
      duda: (await como(DUDA, `select nome from pessoas_convocaveis order by nome`)).map(r => r.nome),
      ana: await valor(ANA, `select count(*)::int from pessoas_convocaveis`),
    }, { mel: 11, joao: 11, duda: ['Camila', 'Duda'], ana: 0 });
    const rPessoas = await valor(JOAO, `select criar_reuniao('Alinhamento Comercial e Projetos', privado.hoje() + 4, '15:00', 'pessoas', null, '', array[$1,$2]::uuid[])`, [iAna, iCamila]);
    confere('Convocados: os escolhidos mais quem agendou', (await db.query(`select p.nome from reuniao_convocados rc join pessoas p on p.id = rc.pessoa_id where reuniao_id = $1 order by 1`, [rPessoas])).rows.map(r => r.nome), ['Ana', 'Camila', 'João']);
    confere('Quem foi escolhido vê a reunião; quem não foi, não', [await valor(CAMILA, `select count(*)::int from reunioes_visiveis where id = $1`, [rPessoas]), await valor('lucas@facil.test', `select count(*)::int from reunioes_visiveis where id = $1`, [rPessoas])], [1, 0]);
    confere('Só quem agendou (e a Presidência) organiza', [await valor(JOAO, `select pode_gerir from reunioes_visiveis where id = $1`, [rPessoas]), await valor(DUDA, `select count(*)::int from reunioes_visiveis where id = $1`, [rPessoas]), await valor(MEL, `select pode_gerir from reunioes_visiveis where id = $1`, [rPessoas])], [true, 0, true]);
    await permite('Gerência escolhe gente do próprio núcleo', DUDA, `select criar_reuniao('Pauta de posts', privado.hoje() + 6, '16:00', 'pessoas', null, '', array[$1]::uuid[])`, [iCamila]);
    await bloqueia('Gerência não escolhe gente de outro núcleo', DUDA, `select criar_reuniao('x', privado.hoje() + 6, '16:00', 'pessoas', null, '', array[$1]::uuid[])`, [iPedro], 'Há pessoas fora do seu escopo.');
    await bloqueia('Escolher ao menos uma pessoa', JOAO, `select criar_reuniao('x', privado.hoje() + 6, '16:00', 'pessoas', null, '', array[]::uuid[])`, [], 'Escolha pelo menos uma pessoa para convocar.');
    await bloqueia('Membro não agenda', ANA, `select criar_reuniao('x', privado.hoje() + 6, '16:00', 'pessoas', null, '', array[$1]::uuid[])`, [iAna], 'Escolha um público da lista.');
    await permite('Diretoria agenda reunião com todos', JOAO, `select criar_reuniao('Assembleia comercial', privado.hoje() + 20, '19:00', 'geral', null, '')`);
    confere('Reunião com todos convoca todos os ativos', await valor(JOAO, `select total_convocados from reunioes_visiveis where titulo = 'Assembleia comercial'`), 11);

    // falta de diretoria: só justificada com aval
    await permite('Organizador marca as presenças', JOAO, `select salvar_presencas($1, $2::jsonb)`, [rHoje, JSON.stringify({ [iAna]: 'presente', [iJoao]: 'falta', [iLucas]: 'presente', [iVictor]: 'presente' })]);
    await bloqueia('Diretoria não se justifica sozinha', JOAO, `select salvar_presencas($1, $2::jsonb)`, [rHoje, JSON.stringify({ [iAna]: 'presente', [iJoao]: 'justificada', [iLucas]: 'presente', [iVictor]: 'presente' })], 'A falta de diretoria só é justificada com aval da Presidência ou da Vice-Presidência. Peça o aval pelo sistema.');
    await permite('Falta de quem não é diretoria é justificada normalmente', JOAO, `select salvar_presencas($1, $2::jsonb)`, [rHoje, JSON.stringify({ [iAna]: 'presente', [iJoao]: 'falta', [iLucas]: 'justificada', [iVictor]: 'presente' })]);
    await bloqueia('Quem não organiza não pede aval', ANA, `select solicitar_aval('justificar_falta', jsonb_build_object('reuniao',$1::text,'pessoa',$2::text), 'Viagem a trabalho autorizada pela Presidência')`, [rHoje, iJoao], 'Você não pode pedir aval para esta reunião.');
    await bloqueia('Aval só para falta de diretor', JOAO, `select solicitar_aval('justificar_falta', jsonb_build_object('reuniao',$1::text,'pessoa',$2::text), 'Pedido que não cabe para um membro')`, [rHoje, iLucas], 'O aval vale para a falta de diretoria já registrada nesta reunião.');
    await bloqueia('Presidente justifica direto, sem aval', MEL, `select solicitar_aval('justificar_falta', jsonb_build_object('reuniao',$1::text,'pessoa',$2::text), 'Tentativa de pedir aval sendo a Presidente')`, [rHoje, iJoao], 'A Presidência e a Vice-Presidência justificam a falta diretamente.');
    const avalFalta = await valor(JOAO, `select solicitar_aval('justificar_falta', jsonb_build_object('reuniao',$1::text,'pessoa',$2::text), 'Viagem a trabalho autorizada pela Presidência')`, [rHoje, iJoao]);
    await bloqueia('Não encerra com aval pendente', JOAO, `select encerrar_reuniao($1)`, [rHoje], 'Há pedido de aval pendente nesta reunião. Aguarde a decisão antes de encerrar.');
    await permite('Vice aprova a justificativa', LUIS, `select decidir_aval($1,true,'')`, [avalFalta]);
    confere('Presença do diretor passa a justificada', await valor(MEL, `select presenca from reuniao_convocados where reuniao_id = $1 and pessoa_id = $2`, [rHoje, iJoao]), 'justificada');
    await permite('Organizador salva de novo mantendo a justificativa aprovada', JOAO, `select salvar_presencas($1, $2::jsonb)`, [rHoje, JSON.stringify({ [iAna]: 'presente', [iJoao]: 'justificada', [iLucas]: 'justificada', [iVictor]: 'presente' })]);
    await permite('Sem aval pendente, encerra', JOAO, `select encerrar_reuniao($1)`, [rHoje]);
    confere('Falta justificada vira lançamento sem pontos', await como(MEL, `select valor from lancamentos where reuniao_id = $1 and pessoa_id = $2`, [rHoje, iJoao]), [{ valor: 0 }]);

    // excluir reuniões
    const rFutura = await valor(DUDA, `select criar_reuniao('Reunião para excluir', privado.hoje() + 8, '10:00', 'nucleo', 'com-mkt', '')`);
    confere('Indicador de exclusão por situação', {
      dudaFutura: await valor(DUDA, `select pode_excluir from reunioes_visiveis where id = $1`, [rFutura]),
      anaEncerrada: await valor(ANA, `select pode_excluir from reunioes_visiveis where id = $1`, [r1]),
      victorEncerrada: await valor(VICTOR, `select pode_excluir from reunioes_visiveis where id = $1`, [r1]),
      joaoEncerrada: await valor(JOAO, `select pode_excluir from reunioes_visiveis where id = $1`, [r1]),
      majuEncerrada: await valor(MAJU, `select pode_excluir from reunioes_visiveis where id = $1`, [r1]),
    }, { dudaFutura: true, anaEncerrada: false, victorEncerrada: false, joaoEncerrada: true, majuEncerrada: true });
    await bloqueia('Quem não organiza não exclui', ANA, `select excluir_reuniao($1)`, [rFutura], 'Você não pode excluir esta reunião.');
    await bloqueia('Convocado comum não exclui', VICTOR, `select excluir_reuniao($1)`, [r1], 'Você não pode excluir esta reunião.');
    await permite('Quem organiza exclui reunião ainda aberta', DUDA, `select excluir_reuniao($1)`, [rFutura]);
    confere('Reunião aberta some com os convocados', [await valor(MEL, `select count(*)::int from reunioes where id = $1`, [rFutura]), await valor(MEL, `select count(*)::int from reuniao_convocados where reuniao_id = $1`, [rFutura])], [0, 0]);
    await bloqueia('Reunião encerrada exige motivo', JOAO, `select excluir_reuniao($1)`, [r1], 'Escreva o motivo da exclusão (mínimo 10 caracteres).');
    confere('Antes de excluir: a falta de Lucas conta e o arquivo existe', [await valor(MEL, `select count(*)::int from lancamentos where reuniao_id = $1 and tipo = 'falta' and desconsiderado_em is null`, [r1]), await valor(MEL, `select count(*)::int from anexos where reuniao_id = $1`, [r1])], [1, 1]);
    confere('Arquivo de reunião existente não é apagado por quem é de fora', (await como(CAMILA, `delete from storage.objects where name = $1 returning name`, [r1 + '/apresentacao.pdf'])).length, 0);
    const caminhos = await valor(JOAO, `select excluir_reuniao($1, 'Reunião lançada por engano na data errada')`, [r1]);
    confere('Exclusão devolve os arquivos para o site apagar', caminhos, [r1 + '/apresentacao.pdf']);
    confere('Faltas da reunião excluída são desconsideradas com o motivo', await como(MEL, `select desconsiderado_em is not null as riscado, reuniao_id is null as sem_reuniao, motivo_desconsideracao from lancamentos where pessoa_id = $1 and tipo = 'falta' and descricao like 'Falta em: Status das entregas%'`, [iLucas]),
      [{ riscado: true, sem_reuniao: true, motivo_desconsideracao: 'Reunião excluída: Reunião lançada por engano na data errada' }]);
    confere('Reunião, anexo e transcrição saem junto', [await valor(MEL, `select count(*)::int from reunioes where id = $1`, [r1]), await valor(MEL, `select count(*)::int from anexos where reuniao_id = $1`, [r1]), await valor(MEL, `select count(*)::int from transcricoes where reuniao_id = $1`, [r1])], [0, 0, 0]);
    confere('Com a reunião excluída, o arquivo órfão pode ser apagado', (await como(JOAO, `delete from storage.objects where name = $1 returning name`, [r1 + '/apresentacao.pdf'])).length, 1);
    confere('A exclusão fica no histórico da Presidência', await valor(MEL, `select count(*)::int from auditoria where acao = 'Excluiu reunião' and reuniao_id = $1`, [r1]), 1);
    await permite('Presidente exclui reunião aberta de outra pessoa', MEL, `select excluir_reuniao($1)`, [rPessoas]);
    confere('Avais: visitante sem login e sem cadastro', [(await tenta(null, `select * from avais_visiveis`)).startsWith('permission denied'), await valor('sem-cadastro@facil.test', `select count(*)::int from avais_visiveis`)], [true, 0]);
    confere('Avais não aceitam gravação direta', (await tenta(MEL, `update avais set status = 'aprovado'`)).startsWith('permission denied'), true);

    // pedidos de acesso por exceção (08)
    const nomesDe = async (email, sql, params) => (await como(email, sql, params)).map(r => r.nome);
    confere('Para quem cada perfil pode pedir acesso', {
      joao: await nomesDe(JOAO, `select nome from beneficiarios_de_acesso order by nome`),
      duda: await nomesDe(DUDA, `select nome from beneficiarios_de_acesso order by nome`),
      ana: await nomesDe(ANA, `select nome from beneficiarios_de_acesso order by nome`),
      mel: (await como(MEL, `select 1 from beneficiarios_de_acesso`)).length,
      maju: (await como(MAJU, `select 1 from beneficiarios_de_acesso`)).length,
    }, { joao: ['Ana', 'Camila', 'Duda', 'Emilli', 'João', 'Lucas', 'Victor'], duda: ['Camila', 'Duda'], ana: ['Ana'], mel: 0, maju: 0 });
    confere('Projetos que podem ser pedidos para Pedro (sem restritos, sem os que ele já tem)', await nomesDe(PEDRO, `select nome from projetos_solicitaveis($1)`, [iPedro]),
      ['Caixa e orçamento', 'Instagram Comercial', 'Rotina da Assessoria']);
    confere('Quem não pode pedir para a pessoa recebe lista vazia', [(await como(DUDA, `select nome from projetos_solicitaveis($1)`, [iPedro])).length, (await como(MEL, `select nome from projetos_solicitaveis($1)`, [iPedro])).length], [0, 0]);
    confere('Gerência recebe a lista da própria equipe', (await nomesDe(DUDA, `select nome from projetos_solicitaveis($1)`, [iCamila])).includes('Mapeamento de processos'), true);
    await permite('Pedido de acesso ao projeto de marketing', PEDRO, `select solicitar_acesso($1,'projeto',$2,null,'Vou apoiar o calendário de posts do Instagram Comercial.',privado.hoje() + 10)`, [iPedro, pMkt]);
    const pedido3 = await valor(MEL, `select id from solicitacoes where beneficiario = $1 and projeto_id = $2 and status = 'pendente'`, [iPedro, pMkt]);
    const acoesNoPedido = email => como(email, `select pode_aprovar, pode_pedir_aval from solicitacoes_visiveis where id = $1`, [pedido3]);
    confere('Pedido: nome do alvo e quem pode agir', {
      alvo: await valor(JOAO, `select alvo_nome from solicitacoes_visiveis where id = $1`, [pedido3]),
      mel: await acoesNoPedido(MEL), maju: await acoesNoPedido(MAJU), joao: await acoesNoPedido(JOAO), pedro: await acoesNoPedido(PEDRO),
    }, {
      alvo: 'Instagram Comercial · Conteúdo',
      mel: [{ pode_aprovar: true, pode_pedir_aval: false }], maju: [{ pode_aprovar: false, pode_pedir_aval: true }],
      joao: [{ pode_aprovar: true, pode_pedir_aval: false }], pedro: [{ pode_aprovar: false, pode_pedir_aval: false }],
    });
    confere('Pedido de demanda mostra código e título', await valor(MEL, `select alvo_nome from solicitacoes_visiveis where id = $1`, [pedidoRestrito]), 'PRE-001 · Metas 2027');
    await bloqueia('Assessoria não pede acesso: ela decide', MAJU, `select solicitar_acesso($1,'projeto',$2,null,'Tentativa de pedido que a Assessoria não faz',privado.hoje() + 10)`, [iMaju, pCli], 'Você não pode pedir acesso para essa pessoa.');
    await bloqueia('Gerência não pede para quem é de outro núcleo', DUDA, `select solicitar_acesso($1,'projeto',$2,null,'Pedido de uma gerência para quem não é do núcleo dela',privado.hoje() + 10)`, [iPedro, pCli], 'Você não pode pedir acesso para essa pessoa.');
    const avalPedido3 = await valor(MAJU, `select solicitar_aval('decidir_solicitacao', jsonb_build_object('solicitacao',$1::text,'aprovar',false,'nota','Sem necessidade agora'), 'Posts já cobertos pela equipe de marketing')`, [pedido3]);
    confere('Depois de pedir o aval, a Assessoria não pede de novo', await valor(MAJU, `select pode_pedir_aval from solicitacoes_visiveis where id = $1`, [pedido3]), false);
    await permite('Presidente aprova o aval de negar o pedido', MEL, `select decidir_aval($1,true,'Ok')`, [avalPedido3]);
    confere('Pedido fica negado pelo aval', await valor(MEL, `select status from solicitacoes where id = $1`, [pedido3]), 'negada');
    confere('Visões e função de acesso fechadas ao visitante', [(await tenta(null, `select * from beneficiarios_de_acesso`)).startsWith('permission denied'), (await tenta(null, `select * from projetos_solicitaveis($1)`, [iPedro])).startsWith('permission denied')], [true, true]);

    // pontuação e ranking (09)
    confere('Pontuação detalhada: quem aparece para cada perfil', {
      ana: await nomesDe(ANA, `select nome from pontuacao_pessoas order by nome`),
      camila: await nomesDe(CAMILA, `select nome from pontuacao_pessoas order by nome`),
      pedro: await nomesDe(PEDRO, `select nome from pontuacao_pessoas order by nome`),
      mel: (await como(MEL, `select 1 from pontuacao_pessoas`)).length,
      maju: (await como(MAJU, `select 1 from pontuacao_pessoas`)).length,
    }, { ana: ['Ana'], camila: ['Camila'], pedro: ['Pedro'], mel: 11, maju: 11 });
    const mesmaListaDaRegra = {};
    for (const email of [MEL, JOAO, DUDA, VICTOR, ANA, MAJU]) {
      mesmaListaDaRegra[email] = await valor(email, `select (select array_agg(id order by id) from pontuacao_pessoas) is not distinct from
        (select array_agg(id order by id) from pessoas where ativo and privado.pode_ver_pontuacao(privado.eu(), id))`);
    }
    confere('A lista da tela segue a regra do banco (pode_ver_pontuacao)', Object.values(mesmaListaDaRegra).every(Boolean), true);
    confere('Saldo, entregas e faltas da tela batem com o ranking',
      await como(MEL, `select nome, pontos, entregas, faltas from pontuacao_pessoas order by nome`),
      await como(MEL, `select nome, pontos, entregas, faltas from ranking() order by nome`));
    const indicadores = (email, nome) => como(email, `select pode_ajustar, pode_pedir_aval from pontuacao_pessoas where nome = $1`, [nome]);
    confere('Quem pode ajustar a pontuação de quem, e quem pode pedir aval', {
      melAna: await indicadores(MEL, 'Ana'), melMel: await indicadores(MEL, 'Mel'), luisMel: await indicadores(LUIS, 'Mel'),
      majuAna: await indicadores(MAJU, 'Ana'), majuMaju: await indicadores(MAJU, 'Maju'),
      joaoAna: await indicadores(JOAO, 'Ana'), anaAna: await indicadores(ANA, 'Ana'),
    }, {
      melAna: [{ pode_ajustar: true, pode_pedir_aval: false }], melMel: [{ pode_ajustar: false, pode_pedir_aval: false }],
      luisMel: [{ pode_ajustar: true, pode_pedir_aval: false }],
      majuAna: [{ pode_ajustar: true, pode_pedir_aval: false }], majuMaju: [{ pode_ajustar: false, pode_pedir_aval: true }],
      joaoAna: [{ pode_ajustar: false, pode_pedir_aval: false }], anaAna: [{ pode_ajustar: false, pode_pedir_aval: false }],
    });
    // Ana passa a atuar também no marketing: Victor (gerência de Projetos) vê o nome só do projeto que enxerga
    await permite('Diretoria cria demanda com executores de duas áreas', JOAO, `select criar_demanda($1,'Calendário compartilhado','',privado.hoje() + 7,'media',array[$2,$3]::uuid[])`, [pMkt, iAna, iCamila]);
    const projetosDaAna = email => como(email, `select projetos_ativos, projetos_ocultos from pontuacao_pessoas where nome = 'Ana'`);
    confere('Projetos ativos: só os nomes que quem consulta pode ver, e quantos ficam ocultos', {
      joao: await projetosDaAna(JOAO), victor: await projetosDaAna(VICTOR), ana: await projetosDaAna(ANA),
    }, {
      joao: [{ projetos_ativos: ['Instagram Comercial', 'Mapeamento de processos'], projetos_ocultos: 0 }],
      victor: [{ projetos_ativos: ['Mapeamento de processos'], projetos_ocultos: 1 }],
      ana: [{ projetos_ativos: ['Instagram Comercial', 'Mapeamento de processos'], projetos_ocultos: 0 }],
    });
    const eventoDesconsiderado = await como(MEL, `select desconsiderado_em is not null as desconsiderado, pode_desconsiderar from lancamentos_visiveis where id = $1`, [lancamento]);
    confere('Lançamento já desconsiderado não oferece desconsiderar', eventoDesconsiderado, [{ desconsiderado: true, pode_desconsiderar: false }]);
    const doMel = (await como(MEL, `select count(*) filter (where desconsiderado_em is null and pessoa_id <> $1 and not pode_desconsiderar)::int as sem, count(*) filter (where pode_desconsiderar)::int as com from lancamentos_visiveis`, [iMel]))[0];
    confere('Linha do tempo: Presidência desconsidera o dos outros; diretoria e membro não', {
      mel: [doMel.sem, doMel.com > 0],
      joao: await valor(JOAO, `select count(*) filter (where pode_desconsiderar)::int from lancamentos_visiveis`),
      ana: await valor(ANA, `select count(*) filter (where pode_desconsiderar or pessoa_id <> $1)::int from lancamentos_visiveis`, [iAna]),
    }, { mel: [0, true], joao: 0, ana: 0 });
    confere('Linha do tempo: o nome da demanda só aparece para quem pode ver a demanda', {
      lucas: await como('lucas@facil.test',`select demanda_id is not null as tem_demanda, demanda_codigo from lancamentos_visiveis where demanda_id = $1 and pessoa_id = $2 limit 1`, [dCli, iLucas]),
      joao: await como(JOAO, `select demanda_codigo from lancamentos_visiveis where demanda_id = $1 and pessoa_id = $2 limit 1`, [dCli, iLucas]),
    }, { lucas: [{ tem_demanda: true, demanda_codigo: null }], joao: [{ demanda_codigo: 'PRJ-001' }] });
    confere('Ajuste aprovado por aval aparece na linha do tempo da Assessoria', await valor(MAJU, `select count(*)::int from lancamentos_visiveis where pessoa_id = $1 and tipo = 'ajuste'`, [iMaju]) >= 1, true);
    confere('Visões de pontuação fechadas ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from pontuacao_pessoas`)).startsWith('permission denied'),
      (await tenta(null, `select * from lancamentos_visiveis`)).startsWith('permission denied'),
      await valor('sem-cadastro@facil.test', `select count(*)::int from pontuacao_pessoas`),
      await valor('sem-cadastro@facil.test', `select count(*)::int from lancamentos_visiveis`),
    ], [true, true, 0, 0]);
    // as duas visões têm agregação ou junção, então o Postgres já recusa por não serem atualizáveis; sem permissão também seria recusado
    const recusada = /^(permission denied|cannot (update|delete from) view)/;
    confere('Visões de pontuação não aceitam gravação direta', [
      recusada.test(await tenta(MEL, `update pontuacao_pessoas set pontos = 99`)),
      recusada.test(await tenta(MEL, `delete from lancamentos_visiveis`)),
    ], [true, true]);

    // presenças (10)
    const frequencia = email => como(email, `select nome, convocacoes, presencas, justificadas, faltas from frequencia() order by nome`);
    const linhaDe = (linhas, nome) => linhas.find(l => l.nome === nome);
    const antes = await frequencia(MEL);
    await valor(JOAO, `select criar_reuniao('Alinhamento ainda aberto', privado.hoje(), '09:00', 'area', 'proj', 'Pauta')`);
    confere('Reunião ainda aberta não entra na frequência', await frequencia(MEL), antes);
    const rFrequencia = await valor(JOAO, `select criar_reuniao('Frequência do trimestre', privado.hoje(), '10:00', 'area', 'proj', 'Pauta')`);
    await permite('Presenças da reunião de frequência', JOAO, `select salvar_presencas($1, $2::jsonb)`, [rFrequencia, JSON.stringify({ [iAna]: 'presente', [iLucas]: 'justificada', [iJoao]: 'falta', [iVictor]: 'presente' })]);
    await permite('Encerra a reunião de frequência', JOAO, `select encerrar_reuniao($1)`, [rFrequencia]);
    const depois = await frequencia(MEL);
    const variacao = nome => { const a = linhaDe(antes, nome), d = linhaDe(depois, nome); return [d.convocacoes - a.convocacoes, d.presencas - a.presencas, d.justificadas - a.justificadas, d.faltas - a.faltas]; };
    confere('Reunião encerrada soma convocação, presença, justificada e falta', {
      ana: variacao('Ana'), lucas: variacao('Lucas'), joao: variacao('João'), victor: variacao('Victor'), camila: variacao('Camila'),
    }, { ana: [1, 1, 0, 0], lucas: [1, 0, 1, 0], joao: [1, 0, 0, 1], victor: [1, 1, 0, 0], camila: [0, 0, 0, 0] });
    confere('Frequência: quem aparece para cada perfil', {
      ana: await nomesDe(ANA, `select nome from frequencia() order by nome`),
      camila: await nomesDe(CAMILA, `select nome from frequencia() order by nome`),
      pedro: await nomesDe(PEDRO, `select nome from frequencia() order by nome`),
      mel: (await frequencia(MEL)).length, maju: (await frequencia(MAJU)).length,
    }, { ana: ['Ana'], camila: ['Camila'], pedro: ['Pedro'], mel: 11, maju: 11 });
    confere('Diretoria vê a área que conduz; gerência, só o núcleo', {
      joaoVeCamila: (await nomesDe(JOAO, `select nome from frequencia()`)).includes('Camila'),
      victorVeCamila: (await nomesDe(VICTOR, `select nome from frequencia()`)).includes('Camila'),
      victorVeAna: (await nomesDe(VICTOR, `select nome from frequencia()`)).includes('Ana'),
    }, { joaoVeCamila: true, victorVeCamila: false, victorVeAna: true });
    const mesmaListaDaPontuacao = [];
    for (const email of [MEL, LUIS, MAJU, JOAO, DUDA, VICTOR, ANA, PEDRO]) {
      mesmaListaDaPontuacao.push(await valor(email, `select (select array_agg(pessoa_id order by pessoa_id) from frequencia()) is not distinct from (select array_agg(id order by id) from pontuacao_pessoas)`));
    }
    confere('A lista de frequência é a mesma da pontuação detalhada', mesmaListaDaPontuacao.every(Boolean), true);
    confere('Frequência fechada ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from frequencia()`)).startsWith('permission denied'),
      (await como('sem-cadastro@facil.test', `select * from frequencia()`)).length,
    ], [true, 0]);

    // estrutura e equipe (11)
    const GINA = 'gina@facil.test';
    await como(MEL, `select cadastrar_pessoa($1,'Gina','gerente','adm','adm-gg')`, [GINA]);
    await db.query(`insert into auth.users(email) values ($1)`, [GINA]);
    const iGina = await id('Gina');
    confere('Gerente de Gente e Gestão passa a cadastrar pessoas', await valor(GINA, `select pode_cadastrar_pessoas from meu_perfil`), true);
    await permite('Gente e Gestão cadastra membro de outra área', GINA, `select cadastrar_pessoa('novo1@facil.test','Novo Um','membro','com','com-cap','Administração')`);
    await permite('Assessoria cadastra membro (tem acesso de Presidência)', MAJU, `select cadastrar_pessoa('novo2@facil.test','Novo Dois','membro','proj','proj-cli')`);
    const msgPresidencia = 'Só a Presidência cadastra pessoas da Presidência e das diretorias.';
    await bloqueia('Gente e Gestão não cadastra diretoria', GINA, `select cadastrar_pessoa('d1@facil.test','Diretor Novo','diretor','com')`, [], msgPresidencia);
    await bloqueia('Gente e Gestão não cria "assessora" na área da Presidência', GINA, `select cadastrar_pessoa('falsa@facil.test','Falsa','assessor','pres','pres-ass')`, [], msgPresidencia);
    await bloqueia('Gente e Gestão não move membro para a área da Presidência', GINA, `select atualizar_pessoa($1,'Ana','membro','pres','pres-gab',null,true)`, [iAna], 'Só a Presidência altera cadastros da Presidência e das diretorias.');
    await bloqueia('Gente e Gestão não altera o cadastro da diretoria', GINA, `select atualizar_pessoa($1,'João','diretor','com',null,null,true)`, [iJoao], 'Só a Presidência altera cadastros da Presidência e das diretorias.');
    await bloqueia('E-mail inválido', MEL, `select cadastrar_pessoa('sem-arroba','X','membro','com','com-mkt')`, [], 'Informe um e-mail válido.');
    await bloqueia('Nome em branco', MEL, `select cadastrar_pessoa('b1@facil.test','  ','membro','com','com-mkt')`, [], 'Informe o nome.');
    await bloqueia('Membro precisa de núcleo', MEL, `select cadastrar_pessoa('b2@facil.test','B','membro','com')`, [], 'Escolha o núcleo.');
    await bloqueia('Vice-Presidente só na Presidência', MEL, `select cadastrar_pessoa('b3@facil.test','B','vice','com')`, [], 'Presidente e Vice-Presidente pertencem à Presidência.');
    await bloqueia('Área inexistente', MEL, `select cadastrar_pessoa('b4@facil.test','B','diretor','nao-existe')`, [], 'Área não encontrada.');
    await bloqueia('E-mail já cadastrado', MEL, `select cadastrar_pessoa('ana@facil.test','Outra Ana','membro','proj','proj-cli')`, [], 'Já existe uma pessoa cadastrada com o e-mail ana@facil.test.');
    await bloqueia('Ninguém altera o próprio cadastro', MEL, `select atualizar_pessoa($1,'Mel','presidente','pres',null,null,true)`, [iMel], 'Ninguém altera o próprio cadastro.');
    await bloqueia('Gerência comum não altera cadastros', DUDA, `select atualizar_pessoa($1,'Lucas','membro','proj','proj-cli',null,true)`, [iLucas], 'Só a Presidência e a Gente e Gestão alteram cadastros.');
    await permite('Gente e Gestão altera o curso de um membro', GINA, `select atualizar_pessoa($1,'Lucas Prado','membro','proj','proj-cli','Engenharia',true)`, [iLucas]);
    confere('Curso gravado e vazio vira nulo', [await valor(MEL, `select curso from pessoas where id = $1`, [iLucas]),
      await valor(GINA, `select atualizar_pessoa($1,'Lucas Prado','membro','proj','proj-cli','  ',true)`, [iLucas]).then(() => valor(MEL, `select curso from pessoas where id = $1`, [iLucas]))], ['Engenharia', null]);
    await bloqueia('Quem conduz uma área não é desativado', MEL, `select atualizar_pessoa($1,'João','diretor','com',null,null,false)`, [iJoao],
      'Esta pessoa conduz a área Diretoria Comercial. Troque o titular ou a cobertura antes de desativá-la ou mudar o cargo.');
    await bloqueia('Quem conduz uma área não vira gerência', MEL, `select atualizar_pessoa($1,'João','gerente','com','com-cap',null,true)`, [iJoao],
      'Esta pessoa conduz a área Diretoria Comercial. Troque o titular ou a cobertura antes de desativá-la ou mudar o cargo.');
    await permite('Gente e Gestão desativa um membro', GINA, `select atualizar_pessoa($1,'Novo Um','membro','com','com-cap','Administração',false)`, [await id('Novo Um')]);

    const emails = email => como(email, `select count(*) filter (where email is not null)::int as com_email, count(*)::int as total, count(*) filter (where not ativo)::int as inativas from equipe_pessoas`);
    const totalDePessoas = await valor(MEL, `select count(*)::int from pessoas`);
    confere('Equipe: e-mail de todas e pessoas desativadas só para quem cadastra (as demais veem só o próprio e-mail)', {
      mel: await emails(MEL), gina: await emails(GINA), ana: await emails(ANA), duda: await emails(DUDA),
    }, {
      mel: [{ com_email: totalDePessoas, total: totalDePessoas, inativas: 2 }],
      gina: [{ com_email: totalDePessoas, total: totalDePessoas, inativas: 2 }],
      ana: [{ com_email: 1, total: totalDePessoas - 2, inativas: 0 }],
      duda: [{ com_email: 1, total: totalDePessoas - 2, inativas: 0 }],
    });
    const edita = (email, nome) => como(email, `select pode_editar from equipe_pessoas where nome = $1`, [nome]);
    confere('Quem pode editar quem', {
      melAna: await edita(MEL, 'Ana'), melMel: await edita(MEL, 'Mel'), melJoao: await edita(MEL, 'João'), majuAna: await edita(MAJU, 'Ana'),
      ginaLucas: await edita(GINA, 'Lucas Prado'), ginaJoao: await edita(GINA, 'João'), ginaMaju: await edita(GINA, 'Maju'), anaLucas: await edita(ANA, 'Lucas Prado'),
    }, {
      melAna: [{ pode_editar: true }], melMel: [{ pode_editar: false }], melJoao: [{ pode_editar: true }], majuAna: [{ pode_editar: true }],
      ginaLucas: [{ pode_editar: true }], ginaJoao: [{ pode_editar: false }], ginaMaju: [{ pode_editar: false }], anaLucas: [{ pode_editar: false }],
    });
    const lista = async (email, sql) => (await como(email, sql)).map(r => Object.values(r)[0]).sort();
    confere('Cargos e áreas que cada perfil pode usar no cadastro', {
      melPapeis: await lista(MEL, `select papel from papeis_cadastraveis`), ginaPapeis: await lista(GINA, `select papel from papeis_cadastraveis`), anaPapeis: await lista(ANA, `select papel from papeis_cadastraveis`),
      melAreas: await lista(MEL, `select id from areas_cadastraveis`), ginaAreas: await lista(GINA, `select id from areas_cadastraveis`), anaAreas: await lista(ANA, `select id from areas_cadastraveis`),
    }, {
      melPapeis: ['assessor', 'diretor', 'gerente', 'membro', 'presidente', 'trainee', 'vice'], ginaPapeis: ['assessor', 'gerente', 'membro', 'trainee'], anaPapeis: [],
      melAreas: ['adm', 'com', 'fin', 'pres', 'proj'], ginaAreas: ['adm', 'com', 'fin', 'proj'], anaAreas: [],
    });
    confere('Áreas da estrutura: todos veem, só a Presidência define', {
      ana: await como(ANA, `select count(*)::int as n, bool_or(pode_definir_lideranca) as pode from areas_da_estrutura`),
      maju: await como(MAJU, `select bool_and(pode_definir_lideranca) as pode from areas_da_estrutura`),
      joao: await como(JOAO, `select bool_or(pode_definir_lideranca) as pode from areas_da_estrutura`),
      titulares: await como(ANA, `select id, titular is not null as tem_titular, cobertura is not null as tem_cobertura from areas_da_estrutura where id in ('proj','adm') order by id`),
    }, {
      ana: [{ n: 5, pode: false }], maju: [{ pode: true }], joao: [{ pode: false }],
      titulares: [{ id: 'adm', tem_titular: false, tem_cobertura: true }, { id: 'proj', tem_titular: false, tem_cobertura: true }],
    });
    confere('Candidatos a titular ou cobertura: só para a Presidência', {
      mel: await lista(MEL, `select nome from candidatos_a_lideranca`), joao: await lista(JOAO, `select nome from candidatos_a_lideranca`),
    }, { mel: ['João', 'Luis', 'Mel'], joao: [] });
    await bloqueia('Diretoria não define liderança', JOAO, `select definir_lideranca_area('adm', null, $1)`, [iJoao], 'Só a Presidência define titulares e coberturas.');
    await bloqueia('Titular precisa ser Presidência ou diretoria', MEL, `select definir_lideranca_area('adm', $1, null)`, [iVictor], 'Titular e cobertura precisam ser Presidente, Vice-Presidente ou diretoria ativa.');
    await bloqueia('Pessoa desativada não conduz área', MEL, `select definir_lideranca_area('adm', null, $1)`, [await id('Novo Um')], 'Titular e cobertura precisam ser Presidente, Vice-Presidente ou diretoria ativa.');
    await bloqueia('Titular e cobertura diferentes', MEL, `select definir_lideranca_area('adm', $1, $1)`, [iJoao], 'Titular e cobertura devem ser pessoas diferentes.');
    await bloqueia('Área inexistente na liderança', MEL, `select definir_lideranca_area('nao-existe', null, $1)`, [iMel], 'Área não encontrada.');
    await permite('Presidente define a cobertura da Administrativa', MEL, `select definir_lideranca_area('adm', null, $1)`, [iMel]);
    await permite('Assessoria define a cobertura de Projetos', MAJU, `select definir_lideranca_area('proj', null, $1)`, [iJoao]);
    confere('Estrutura equipe: visões fechadas ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from equipe_pessoas`)).startsWith('permission denied'),
      (await tenta(null, `select * from areas_da_estrutura`)).startsWith('permission denied'),
      await valor('sem-cadastro@facil.test', `select count(*)::int from equipe_pessoas`),
      await valor('sem-cadastro@facil.test', `select count(*)::int from papeis_cadastraveis`),
    ], [true, true, 0, 0]);

    // histórico completo (12)
    const mesmosRegistros = {};
    for (const email of [MEL, LUIS, MAJU, JOAO, VICTOR, DUDA, GINA, ANA, CAMILA, PEDRO]) {
      mesmosRegistros[email] = await valor(email, `select (select array_agg(id order by id) from historico_visivel) is not distinct from (select array_agg(id order by id) from auditoria)`);
    }
    confere('O histórico mostra exatamente os registros que a regra da auditoria deixa ver', Object.values(mesmosRegistros).every(Boolean), true);
    const totalDeRegistros = (await db.query(`select count(*)::int as n from auditoria`)).rows[0].n;
    const registros = {};
    for (const n of ['mel', 'maju', 'joao', 'camila']) registros[n] = await valor(`${n}@facil.test`, `select count(*)::int from historico_visivel`);
    confere('Presidência e Assessoria veem tudo; os demais, só o seu escopo', [registros.mel === totalDeRegistros, registros.maju === totalDeRegistros, registros.joao < totalDeRegistros, registros.camila > 0 && registros.camila < registros.joao], [true, true, true, true]);
    confere('Cada registro traz o nome de quem fez', [
      await valor(MEL, `select ator_nome from historico_visivel where acao = 'Cadastrou pessoa' and detalhe like 'Gina%'`),
      await valor(MEL, `select count(*)::int from historico_visivel where ator is not null and ator_nome is null`),
    ], ['Mel', 0]);
    confere('Histórico fechado ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from historico_visivel`)).startsWith('permission denied'),
      await valor('sem-cadastro@facil.test', `select count(*)::int from historico_visivel`),
    ], [true, 0]);
    confere('Histórico não aceita gravação direta', [
      recusada.test(await tenta(MEL, `delete from historico_visivel`)),
      recusada.test(await tenta(MEL, `update historico_visivel set acao = 'x'`)),
    ], [true, true]);

    // regras (13)
    const ativasNoFim = (await db.query(`select count(*)::int as n from pessoas where ativo`)).rows[0].n;
    confere('Simulação de visibilidade: só a Presidência recebe linhas', {
      mel: (await como(MEL, `select 1 from simulacao_de_visibilidade()`)).length,
      luis: (await como(LUIS, `select 1 from simulacao_de_visibilidade()`)).length,
      maju: (await como(MAJU, `select 1 from simulacao_de_visibilidade()`)).length,
      joao: (await como(JOAO, `select 1 from simulacao_de_visibilidade()`)).length,
      gina: (await como(GINA, `select 1 from simulacao_de_visibilidade()`)).length,
      ana: (await como(ANA, `select 1 from simulacao_de_visibilidade()`)).length,
    }, { mel: ativasNoFim, luis: ativasNoFim, maju: ativasNoFim, joao: 0, gina: 0, ana: 0 });
    // uma liberação por exceção ativa: Camila passa a ver a demanda do projeto financeiro, só por exceção
    await permite('Diretoria pede acesso por exceção para Camila', JOAO, `select solicitar_acesso($1,'projeto',$2,null,'Vai apoiar o orçamento do projeto financeiro neste mês.',privado.hoje() + 10)`, [iCamila, pFin]);
    const pedidoDaSimulacao = await valor(MEL, `select id from solicitacoes where beneficiario = $1 and projeto_id = $2 and status = 'pendente'`, [iCamila, pFin]);
    await permite('Presidente aprova a exceção', MEL, `select decidir_solicitacao($1,true,'')`, [pedidoDaSimulacao]);
    const simulacao = await como(MEL, `select pessoa_id, nome, demandas_visiveis, por_excecao, pontuacoes_visiveis, total_demandas from simulacao_de_visibilidade()`);
    const dePessoa = nome => simulacao.find(l => l.nome === nome);
    const totalDeDemandas = await valor(MEL, `select count(*)::int from demandas`);
    confere('Simulação: Presidente vê todas as demandas e nenhuma por exceção; o total confere', [dePessoa('Mel').demandas_visiveis, dePessoa('Mel').por_excecao, simulacao.every(l => l.total_demandas === totalDeDemandas)], [totalDeDemandas, 0, true]);
    confere('Simulação: as demandas liberadas a Camila por exceção (e que ela não executa) são contadas à parte', dePessoa('Camila').por_excecao, await valor(MEL,
      `select count(*)::int from demandas d where not exists (select 1 from demanda_executores e where e.demanda_id = d.id and e.pessoa_id = $1)
          and exists (select 1 from solicitacoes s where s.beneficiario = $1 and s.status = 'aprovada' and s.valido_ate >= privado.hoje() and (s.demanda_id = d.id or s.projeto_id = d.projeto_id))`, [iCamila]));
    confere('Simulação: a exceção de Camila inclui o projeto financeiro', (await como(CAMILA, `select count(*)::int as n from demandas where projeto_id = $1`, [pFin]))[0].n >= 1, true);
    const confrontos = {};
    for (const [nome, email] of [['Mel', MEL], ['Luis', LUIS], ['Maju', MAJU], ['João', JOAO], ['Victor', VICTOR], ['Duda', DUDA], ['Gina', GINA], ['Ana', ANA], ['Camila', CAMILA], ['Pedro', PEDRO]]) {
      const linha = dePessoa(nome);
      confrontos[nome] = [linha.demandas_visiveis === await valor(email, `select count(*)::int from demandas`), linha.pontuacoes_visiveis === await valor(email, `select count(*)::int from pontuacao_pessoas`)];
    }
    confere('A simulação bate com o que cada pessoa realmente enxerga (demandas e pontuações)', Object.values(confrontos).every(par => par[0] && par[1]), true);
    confere('Simulação fechada ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from simulacao_de_visibilidade()`)).startsWith('permission denied'),
      (await como('sem-cadastro@facil.test', `select * from simulacao_de_visibilidade()`)).length,
    ], [true, 0]);
    confere('Valores de pontuação são lidos por qualquer pessoa com cadastro', (await como(ANA, `select pontos_iniciais, ranking_publico from config`)).length, 1);
    await permite('Assessoria salva as regras de pontuação (acesso de Presidência)', MAJU, `select salvar_config(12,2,1,-2,0,true)`);
    await bloqueia('Valor fora de −50 a 50 é recusado', MEL, `select salvar_config(12,60,1,-2,0,true)`, [], 'Use números inteiros entre −50 e 50.');
    await bloqueia('Gerência de outra área não salva regras', DUDA, `select salvar_config(12,2,1,-2,0,true)`, [], 'Só a Presidência e a Diretoria Administrativa alteram as regras.');
    confere('Salvar as regras fica no histórico', await valor(MEL, `select count(*)::int from historico_visivel where acao = 'Alterou regras de pontuação'`) >= 1, true);

    // projetos (14)
    const pessoasDoTeste = [['Mel', MEL], ['Luis', LUIS], ['Maju', MAJU], ['João', JOAO], ['Victor', VICTOR], ['Duda', DUDA], ['Gina', GINA], ['Ana', ANA], ['Camila', CAMILA], ['Pedro', PEDRO]];
    const totalDeProjetos = await valor(MEL, `select count(*)::int from projetos`);
    const painelDeMel = await como(MEL, `select nome, acesso, restrito, total_demandas from projetos_painel`);
    confere('Projetos: Presidente vê todos, com acesso integral', [painelDeMel.length, painelDeMel.every(p => p.acesso === 'integral'), painelDeMel.find(p => p.nome === 'Planejamento 2027').restrito], [totalDeProjetos, true, true]);
    confere('Projetos: quem não conduz a área não vê o projeto restrito da Presidência', (await como(JOAO, `select 1 from projetos_painel where nome = 'Planejamento 2027'`)).length, 0);
    const projetosConferidos = {};
    for (const [nome, email] of pessoasDoTeste) {
      const linhas = await como(email, `select id, total_demandas, concluidas, atrasadas from projetos_painel`);
      const visiveis = await como(email, `select projeto_id, status, prazo from demandas`);
      const hoje = await valor(email, `select privado.hoje()::text`);
      projetosConferidos[nome] = linhas.every(l => {
        const dele = visiveis.filter(d => d.projeto_id === l.id);
        return l.total_demandas === dele.length
          && l.concluidas === dele.filter(d => d.status === 'concluida').length
          && l.atrasadas === dele.filter(d => d.status !== 'concluida' && String(d.prazo).slice(0, 10) < hoje).length;
      }) && linhas.reduce((soma, l) => soma + l.total_demandas, 0) === visiveis.length;
    }
    confere('Projetos: os números de cada projeto batem com as demandas que a pessoa enxerga (10 pessoas)', Object.values(projetosConferidos).every(Boolean), true);
    confere('Projetos: membro tem acesso parcial; a exceção do projeto inteiro aparece só para quem a recebeu', {
      ana: (await como(ANA, `select distinct acesso from projetos_painel`)).map(l => l.acesso),
      camilaNoFinanceiro: await valor(CAMILA, `select acesso from projetos_painel where id = $1`, [pFin]),
      joaoNoFinanceiro: (await como(JOAO, `select acesso from projetos_painel where id = $1`, [pFin])).map(l => l.acesso),
    }, { ana: ['parcial'], camilaNoFinanceiro: 'excecao', joaoNoFinanceiro: [] });
    confere('Projetos: Diretoria e Gerência têm acesso integral aos projetos da sua área', {
      joao: await valor(JOAO, `select acesso from projetos_painel where id = $1`, [pMkt]),
      duda: await valor(DUDA, `select acesso from projetos_painel where id = $1`, [pMkt]),
    }, { joao: 'integral', duda: 'integral' });
    // atraso: com o prazo no passado e a demanda aberta, ela entra em "atrasadas"; concluída, deixa de entrar
    await db.query(`update demandas set prazo = privado.hoje() - 3 where codigo = 'FIN-001'`);
    const atrasoDoFinanceiro = await como(MEL, `select total_demandas, concluidas, atrasadas from projetos_painel where id = $1`, [pFin]);
    confere('Projetos: demanda aberta com prazo vencido conta como atrasada', [atrasoDoFinanceiro[0].atrasadas, atrasoDoFinanceiro[0].concluidas], [1, 0]);
    await db.query(`update demandas set prazo = privado.hoje() + 15 where codigo = 'FIN-001'`);
    confere('Projetos fechados ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from projetos_painel`)).startsWith('permission denied'),
      (await como('sem-cadastro@facil.test', `select * from projetos_painel`)).length,
    ], [true, 0]);
    confere('Projetos não aceita gravação direta', [
      recusada.test(await tenta(MEL, `delete from projetos_painel`)),
      recusada.test(await tenta(MEL, `update projetos_painel set nome = 'x'`)),
    ], [true, true]);

    // dados pessoais (15)
    const pessoasNoBanco = (await db.query(`select count(*)::int as n from pessoas`)).rows[0].n;
    confere('E-mail: a leitura direta de pessoas não inclui o e-mail nem o vínculo de login', [
      (await tenta(ANA, `select email from pessoas`)).startsWith('permission denied'),
      (await tenta(ANA, `select * from pessoas`)).startsWith('permission denied'),
      (await tenta(ANA, `select auth_user_id from pessoas`)).startsWith('permission denied'),
      (await como(ANA, `select id, nome, papel from pessoas`)).length,
    ], [true, true, true, pessoasNoBanco]);
    confere('E-mail: cada pessoa vê o próprio; só quem cadastra pessoas vê o de todas', {
      ana: await valor(ANA, `select email from meu_perfil`),
      anaNaEquipe: (await como(ANA, `select count(email)::int as n from equipe_pessoas`))[0].n,
      camilaNaEquipe: (await como(CAMILA, `select count(email)::int as n from equipe_pessoas`))[0].n,
      mel: (await como(MEL, `select count(email)::int as n, count(*)::int as total from equipe_pessoas`))[0],
    }, { ana: ANA, anaNaEquipe: 1, camilaNaEquipe: 1, mel: { n: pessoasNoBanco, total: pessoasNoBanco } });
    const cpfValido = async cpf => (await db.query(`select privado.cpf_valido($1) as v`, [cpf])).rows[0].v;
    confere('CPF: valida os dígitos verificadores', [await cpfValido('52998224725'), await cpfValido('11144477735'), await cpfValido('52998224726'), await cpfValido('11111111111'), await cpfValido('123')], [true, true, false, false, false]);
    confere('Dados pendentes até a pessoa preencher', [await valor(ANA, `select dados_pendentes from meu_perfil`), await valor(MEL, `select dados_pendentes from meu_perfil`)], [true, true]);
    const gravar = (email, nome, rga, cpf, nascimento, genero) => como(email, `select salvar_meus_dados($1,$2,$3,$4::date,$5)`, [nome, rga, cpf, nascimento, genero]);
    await bloqueia('Nome sem sobrenome é recusado', ANA, `select salvar_meus_dados($1,$2,$3,$4::date,$5)`, ['Ana', 'AB1234567890', '52998224725', '2003-04-09', 'feminino'], 'Informe o nome completo, com nome e sobrenome.');
    await bloqueia('RGA com tamanho errado é recusado', ANA, `select salvar_meus_dados($1,$2,$3,$4::date,$5)`, ['Ana Ferraz', 'AB123', '52998224725', '2003-04-09', 'feminino'], 'O RGA tem 12 caracteres (letras e números).');
    await bloqueia('CPF inválido é recusado', ANA, `select salvar_meus_dados($1,$2,$3,$4::date,$5)`, ['Ana Ferraz', 'AB1234567890', '52998224726', '2003-04-09', 'feminino'], 'CPF inválido. Confira os 11 números.');
    await bloqueia('Data no futuro é recusada', ANA, `select salvar_meus_dados($1,$2,$3,$4::date,$5)`, ['Ana Ferraz', 'AB1234567890', '52998224725', '2999-01-01', 'feminino'], 'Informe uma data de nascimento válida.');
    await bloqueia('Gênero fora da lista é recusado', ANA, `select salvar_meus_dados($1,$2,$3,$4::date,$5)`, ['Ana Ferraz', 'AB1234567890', '52998224725', '2003-04-09', 'x'], 'Escolha uma opção de gênero.');
    await bloqueia('Login sem cadastro não grava dados', 'sem-cadastro@facil.test', `select salvar_meus_dados($1,$2,$3,$4::date,$5)`, ['Ana Ferraz', 'AB1234567890', '52998224725', '2003-04-09', 'feminino'], 'Seu e-mail não tem cadastro ativo no SGI.');
    await bloqueia('Visitante sem login não grava dados', null, `select salvar_meus_dados($1,$2,$3,$4::date,$5)`, ['Ana Ferraz', 'AB1234567890', '52998224725', '2003-04-09', 'feminino'], 'permission denied for function salvar_meus_dados');
    await gravar(ANA, 'Ana  Ferraz de Souza', 'ab12.34 56789-0', '529.982.247-25', '2003-04-09', 'feminino');
    await gravar(MEL, 'Melissa Santos Lima', '123456789012', '11144477735', '1999-12-31', 'feminino');
    confere('Dados gravados já normalizados (nome sem espaços extras, RGA em maiúsculas, CPF só com números)',
      (await db.query(`select nome_completo, rga, cpf, to_char(nascimento, 'YYYY-MM-DD') as nasc, genero from dados_pessoais where pessoa_id = $1`, [iAna])).rows[0],
      { nome_completo: 'Ana Ferraz de Souza', rga: 'AB1234567890', cpf: '52998224725', nasc: '2003-04-09', genero: 'feminino' });
    confere('Pendência some só para quem preencheu', [await valor(ANA, `select dados_pendentes from meu_perfil`), await valor(MEL, `select dados_pendentes from meu_perfil`), await valor(CAMILA, `select dados_pendentes from meu_perfil`)], [false, false, true]);
    const leituras = {};
    for (const [nome, email] of [['mel', MEL], ['ana', ANA], ['maju', MAJU], ['luis', LUIS], ['joao', JOAO], ['gina', GINA], ['camila', CAMILA]]) {
      leituras[nome] = await valor(email, `select count(*)::int from dados_pessoais`);
    }
    confere('Lê os dados a dona ou o dono, a Presidente, a Assessoria e a diretoria da área (João cobre Projetos, onde está a Ana); Vice de outra área, gerência e membros não', leituras, { mel: 2, ana: 1, maju: 2, luis: 0, joao: 1, gina: 0, camila: 0 });
    confere('A diretoria lê os dados do time, mas não os da Presidente (22)', [
      await valor(JOAO, `select cpf from dados_pessoais where pessoa_id = $1`, [iAna]),
      (await como(JOAO, `select 1 from dados_pessoais where pessoa_id = $1`, [iMel])).length,
      (await tenta(JOAO, `update dados_pessoais set cpf = '11144477735' where pessoa_id = $1`, [iAna])).startsWith('permission denied'),
    ], ['52998224725', 0, true]);
    confere('A lista da equipe diz de quem cada um vê os dados e se já preencheram (só para quem vê)', {
      joao: (await como(JOAO, `select nome, dados_preenchidos from equipe_pessoas where pode_ver_dados and id <> $1 order by nome`, [iJoao])).map(l => `${l.nome}:${l.dados_preenchidos}`),
      camilaVeAna: await valor(CAMILA, `select dados_preenchidos from equipe_pessoas where id = $1`, [iAna]),
      maju: await valor(MAJU, `select count(*)::int from equipe_pessoas where pode_ver_dados and ativo`),
    }, {
      joao: ['Ana:true', 'Camila:false', 'Duda:false', 'Emilli:false', 'Lucas Prado:false', 'Novo Dois:false', 'Victor:false'],
      camilaVeAna: null,
      maju: await valor(MEL, `select count(*)::int from pessoas where ativo`),
    });
    confere('O perfil diz quem tem time para ver (aba "Dados do time")', {
      mel: await valor(MEL, `select ve_dados_do_time from meu_perfil`), maju: await valor(MAJU, `select ve_dados_do_time from meu_perfil`),
      joao: await valor(JOAO, `select ve_dados_do_time from meu_perfil`), luis: await valor(LUIS, `select ve_dados_do_time from meu_perfil`),
      duda: await valor(DUDA, `select ve_dados_do_time from meu_perfil`), ana: await valor(ANA, `select ve_dados_do_time from meu_perfil`),
    }, { mel: true, maju: true, joao: true, luis: false, duda: false, ana: false });
    confere('A Presidente e a Assessoria leem os dados de uma pessoa', [
      await valor(MEL, `select cpf from dados_pessoais where pessoa_id = $1`, [iAna]),
      await valor(MAJU, `select cpf from dados_pessoais where pessoa_id = $1`, [iAna]),
    ], ['52998224725', '52998224725']);
    confere('O perfil diz quem vê os dados pessoais dos outros (21)', {
      mel: await valor(MEL, `select pode_ver_dados_pessoais from meu_perfil`), maju: await valor(MAJU, `select pode_ver_dados_pessoais from meu_perfil`),
      luis: await valor(LUIS, `select pode_ver_dados_pessoais from meu_perfil`), joao: await valor(JOAO, `select pode_ver_dados_pessoais from meu_perfil`),
      ana: await valor(ANA, `select pode_ver_dados_pessoais from meu_perfil`),
    }, { mel: true, maju: true, luis: false, joao: false, ana: false });
    confere('A Assessoria lê, mas não altera os dados de outra pessoa', [
      (await tenta(MAJU, `update dados_pessoais set cpf = '11144477735' where pessoa_id = $1`, [iAna])).startsWith('permission denied'),
      (await tenta(MAJU, `delete from dados_pessoais where pessoa_id = $1`, [iAna])).startsWith('permission denied'),
    ], [true, true]);
    confere('Dados pessoais fechados ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from dados_pessoais`)).startsWith('permission denied'),
      await valor('sem-cadastro@facil.test', `select count(*)::int from dados_pessoais`),
    ], [true, 0]);
    confere('Ninguém escreve nos dados pessoais diretamente, nem a Presidente', [
      (await tenta(ANA, `update dados_pessoais set cpf = '11144477735'`)).startsWith('permission denied'),
      (await tenta(MEL, `update dados_pessoais set cpf = '11144477735' where pessoa_id = $1`, [iAna])).startsWith('permission denied'),
      (await tenta(MEL, `delete from dados_pessoais where pessoa_id = $1`, [iAna])).startsWith('permission denied'),
      (await tenta(ANA, `insert into dados_pessoais(pessoa_id, nome_completo, rga, cpf, nascimento, genero) values ($1,'Fulana de Tal','AB1234567890','52998224725','2000-01-01','outro')`, [iAna])).startsWith('permission denied'),
    ], [true, true, true, true]);
    await gravar(ANA, 'Ana Ferraz de Souza', 'AB1234567890', '52998224725', '2003-04-09', 'outro');
    confere('A dona dos dados altera os próprios dados (um único registro) e a Presidente continua com o dela', [
      (await db.query(`select count(*)::int as n from dados_pessoais where pessoa_id = $1`, [iAna])).rows[0].n,
      (await db.query(`select genero from dados_pessoais where pessoa_id = $1`, [iAna])).rows[0].genero,
      (await db.query(`select cpf from dados_pessoais where pessoa_id = (select id from pessoas where nome = 'Mel')`)).rows[0].cpf,
    ], [1, 'outro', '11144477735']);
    confere('A auditoria registra a atualização sem guardar os valores', [
      (await db.query(`select count(*)::int as n from auditoria where acao = 'Atualizou dados pessoais'`)).rows[0].n >= 3,
      (await db.query(`select count(*)::int as n from auditoria where detalhe ~ '(52998224725|11144477735|AB1234567890|2003-04-09)'`)).rows[0].n,
    ], [true, 0]);

    // tratamento (16)
    const tratamentoDe = nome => valor(CAMILA, `select tratamento from pessoas where nome = $1`, [nome]);
    confere('Tratamento: vem do gênero informado e todas as pessoas leem a coluna (feminino, outro e quem não preencheu)', [
      await tratamentoDe('Mel'), await tratamentoDe('Ana'), await tratamentoDe('Luis'),
    ], ['feminino', 'neutro', 'neutro']);
    await gravar(LUIS, 'Luis Fernando Costa', 'ABCDEF123456', '12345678909', '1995-06-15', 'masculino');
    confere('Tratamento: gênero masculino vira masculino', await tratamentoDe('Luis'), 'masculino');
    await gravar(ANA, 'Ana Ferraz de Souza', 'AB1234567890', '52998224725', '2003-04-09', 'nao_informar');
    confere('Tratamento: "prefiro não informar" vira neutro', await tratamentoDe('Ana'), 'neutro');
    confere('O gênero em si continua privado, mesmo com o tratamento aberto', [
      (await como(CAMILA, `select genero from dados_pessoais`)).length,
      (await como(LUIS, `select genero from dados_pessoais`)).map(l => l.genero),
      (await tenta(CAMILA, `select genero from pessoas`)).startsWith('column "genero" does not exist') || (await tenta(CAMILA, `select genero from pessoas`)).includes('does not exist'),
    ], [0, ['masculino'], true]);
    confere('Ninguém altera o tratamento diretamente', [
      (await tenta(ANA, `update pessoas set tratamento = 'feminino'`)).startsWith('permission denied'),
      (await tenta(MEL, `update pessoas set tratamento = 'masculino' where nome = 'Luis'`)).startsWith('permission denied'),
    ], [true, true]);
    confere('O tratamento de uma pessoa só muda quando ela mesma salva os dados', await tratamentoDe('Mel'), 'feminino');

    // disponibilidade (17)
    const slot = (dia, hora) => dia * 24 + hora;
    const literalDeSlots = slots => `{${slots.join(',')}}`;
    const salvarDisp = (email, slots) => como(email, `select salvar_minha_disponibilidade($1::smallint[])`, [literalDeSlots(slots)]);
    const doAna = [slot(5, 11), slot(5, 9), slot(0, 19), slot(5, 10), slot(0, 20), slot(0, 19)];
    await bloqueia('Hora antes das 7h é recusada', ANA, `select salvar_minha_disponibilidade($1::smallint[])`, [literalDeSlots([slot(0, 6)])], 'Horário fora da grade (segunda a domingo, das 7h às 22h).');
    await bloqueia('Hora a partir das 22h é recusada', ANA, `select salvar_minha_disponibilidade($1::smallint[])`, [literalDeSlots([slot(2, 22)])], 'Horário fora da grade (segunda a domingo, das 7h às 22h).');
    await bloqueia('Dia fora da semana é recusado', ANA, `select salvar_minha_disponibilidade($1::smallint[])`, [literalDeSlots([168 + 9])], 'Horário fora da grade (segunda a domingo, das 7h às 22h).');
    await bloqueia('Número negativo é recusado', ANA, `select salvar_minha_disponibilidade($1::smallint[])`, ['{-1}'], 'Horário fora da grade (segunda a domingo, das 7h às 22h).');
    await bloqueia('Login sem cadastro não grava', 'sem-cadastro@facil.test', `select salvar_minha_disponibilidade($1::smallint[])`, [literalDeSlots([slot(0, 8)])], 'Seu e-mail não tem cadastro ativo no SGI.');
    await bloqueia('Visitante sem login não grava', null, `select salvar_minha_disponibilidade($1::smallint[])`, [literalDeSlots([slot(0, 8)])], 'permission denied for function salvar_minha_disponibilidade');
    await salvarDisp(ANA, doAna);
    confere('Disponibilidade gravada sem repetição e em ordem', await valor(ANA, `select slots from disponibilidade_semanal`), [slot(0, 19), slot(0, 20), slot(5, 9), slot(5, 10), slot(5, 11)]);
    await salvarDisp(CAMILA, [slot(5, 10), slot(5, 11)]);
    const veAna = {};
    for (const [nome, email] of [['ana', ANA], ['victor', VICTOR], ['joao', JOAO], ['mel', MEL], ['maju', MAJU], ['camila', CAMILA], ['duda', DUDA], ['pedro', PEDRO]]) {
      veAna[nome] = await valor(email, `select count(*)::int from disponibilidade_semanal where pessoa_id = $1`, [iAna]);
    }
    confere('Quem lê a grade de Ana: ela, a gerência do núcleo, a diretoria da área (e quem cobre) e a Presidência; os demais não', veAna,
      { ana: 1, victor: 1, joao: 1, mel: 1, maju: 1, camila: 0, duda: 0, pedro: 0 });
    confere('A pessoa vê só a própria grade quando não tem ninguém no escopo', await como(CAMILA, `select pessoa_id from disponibilidade_semanal`).then(r => r.map(l => l.pessoa_id === iCamila)), [true]);
    confere('Lista de pessoas: o escopo de cada um e quem já preencheu', {
      camila: (await como(CAMILA, `select nome, preenchida from disponibilidade_pessoas order by nome`)),
      victorVeAna: (await como(VICTOR, `select preenchida from disponibilidade_pessoas where nome = 'Ana'`)),
      victorNaoVeCamila: (await como(VICTOR, `select 1 from disponibilidade_pessoas where nome = 'Camila'`)).length,
    }, { camila: [{ nome: 'Camila', preenchida: true }], victorVeAna: [{ preenchida: true }], victorNaoVeCamila: 0 });
    confere('Quem ainda não preencheu aparece como pendente para quem enxerga', (await como(MEL, `select preenchida from disponibilidade_pessoas where nome = 'Pedro'`)), [{ preenchida: false }]);
    await salvarDisp(ANA, [slot(6, 21)]);
    confere('Salvar de novo substitui a grade inteira', await valor(ANA, `select slots from disponibilidade_semanal`), [slot(6, 21)]);
    await salvarDisp(ANA, []);
    confere('Grade vazia vale como preenchida (a pessoa disse que não tem horário fixo)', [await valor(ANA, `select slots from disponibilidade_semanal`), (await como(MEL, `select preenchida from disponibilidade_pessoas where nome = 'Ana'`))[0].preenchida], [[], true]);
    confere('Ninguém escreve na grade diretamente, nem a Presidente; a grade de outra pessoa não muda', [
      (await tenta(ANA, `update disponibilidade_semanal set slots = '{}'`)).startsWith('permission denied'),
      (await tenta(MEL, `update disponibilidade_semanal set slots = '{9}' where pessoa_id = $1`, [iAna])).startsWith('permission denied'),
      (await tenta(MEL, `delete from disponibilidade_semanal`)).startsWith('permission denied'),
      (await tenta(ANA, `insert into disponibilidade_semanal(pessoa_id, slots) values ($1, '{9}')`, [iAna])).startsWith('permission denied'),
      await valor(CAMILA, `select slots from disponibilidade_semanal where pessoa_id = $1`, [iCamila]),
    ], [true, true, true, true, [slot(5, 10), slot(5, 11)]]);
    confere('Fechada ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from disponibilidade_semanal`)).startsWith('permission denied'),
      (await tenta(null, `select * from disponibilidade_pessoas`)).startsWith('permission denied'),
      await valor('sem-cadastro@facil.test', `select count(*)::int from disponibilidade_semanal`),
      await valor('sem-cadastro@facil.test', `select count(*)::int from disponibilidade_pessoas`),
    ], [true, true, 0, 0]);

    // recados e notificações (18)
    const tiposDe = (email, codigo) => como(email, `select tipo from minhas_notificacoes where codigo = $1 order by tipo`, [codigo]).then(r => r.map(l => l.tipo));
    const dAtrasada = await valor(DUDA, `select criar_demanda($1,'Roteiro do vídeo','',privado.hoje() - 2,'alta',array[$2]::uuid[])`, [pMkt, iCamila]);
    const codAtrasada = await valor(MEL, `select codigo from demandas where id = $1`, [dAtrasada]);
    confere('Demanda atribuída com prazo vencido: o sino mostra a atribuição e o atraso', await tiposDe(CAMILA, codAtrasada), ['atraso', 'atribuicao']);
    confere('A notificação é só de quem recebeu a atividade', [await tiposDe(DUDA, codAtrasada), await tiposDe(MEL, codAtrasada), await tiposDe(ANA, codAtrasada)], [[], [], []]);
    const dPropria = await valor(LUIS, `select criar_demanda($1,'Conferir extrato','',privado.hoje() + 4,'media',array[$2]::uuid[])`, [pFin, iLuis]);
    confere('Quem se atribui a si mesma não é avisada', await valor(LUIS, `select count(*)::int from notificacoes where demanda_id = $1`, [dPropria]), 0);
    const dIndic = await valor(MEL, `select id from demandas where titulo = 'Levantar indicadores'`);
    confere('Atribuição já feita gerou um aviso para a executora', await valor(ANA, `select count(*)::int from notificacoes where demanda_id = $1 and tipo = 'atribuicao'`, [dIndic]), 1);
    await permite('Gerência inclui outra executora', VICTOR, `select editar_demanda($1,'Levantar indicadores','','afazer','media',privado.hoje() + 9,array[$2,$3]::uuid[])`, [dIndic, iAna, iLucas]);
    confere('Editar a demanda avisa só quem entrou, sem repetir o aviso de quem já estava', [
      await valor('lucas@facil.test', `select count(*)::int from notificacoes where demanda_id = $1`, [dIndic]),
      await valor(ANA, `select count(*)::int from notificacoes where demanda_id = $1 and tipo = 'atribuicao'`, [dIndic]),
    ], [1, 1]);
    const idAviso = await valor(CAMILA, `select id from minhas_notificacoes where tipo = 'atribuicao' and codigo = $1`, [codAtrasada]);
    await permite('Outra pessoa tenta marcar o aviso de Camila: nada acontece', ANA, `select marcar_notificacoes_lidas(array[$1]::uuid[])`, [idAviso]);
    confere('O aviso de Camila continua não lido', await tiposDe(CAMILA, codAtrasada), ['atraso', 'atribuicao']);
    await permite('Camila marca o aviso como lido', CAMILA, `select marcar_notificacoes_lidas(array[$1]::uuid[])`, [idAviso]);
    confere('Lido sai do sino, mas o atraso continua enquanto não concluir', await tiposDe(CAMILA, codAtrasada), ['atraso']);
    await permite('Gerência conclui a demanda atrasada', DUDA, `select mudar_status($1,'concluida')`, [dAtrasada]);
    confere('Concluir tira o atraso do sino e avisa que a entrega foi aprovada (23)', await tiposDe(CAMILA, codAtrasada), ['raci']);

    const pessoasAtivas = await valor(MEL, `select count(*)::int from pessoas where ativo`);
    const pessoasProj = await valor(MEL, `select count(*)::int from pessoas where ativo and area_id = 'proj'`);
    await bloqueia('Membro não publica recado', ANA, `select publicar_recado('Aviso','Texto','nucleo','proj-cli')`, [], 'Você não pode enviar recados para este público.');
    await bloqueia('Gerência não publica para toda a equipe', DUDA, `select publicar_recado('Aviso','Texto','todos')`, [], 'Você não pode enviar recados para este público.');
    await bloqueia('Gerência não publica para a área inteira', DUDA, `select publicar_recado('Aviso','Texto','area','com')`, [], 'Você não pode enviar recados para este público.');
    await bloqueia('Gerência não publica para o núcleo de outra área', DUDA, `select publicar_recado('Aviso','Texto','nucleo','proj-cli')`, [], 'Você não pode enviar recados para este público.');
    await bloqueia('Diretoria não publica para outra área', JOAO, `select publicar_recado('Aviso','Texto','area','fin')`, [], 'Você não pode enviar recados para este público.');
    await bloqueia('Diretoria não publica para núcleo de outra área', JOAO, `select publicar_recado('Aviso','Texto','nucleo','fin-cx')`, [], 'Você não pode enviar recados para este público.');
    await bloqueia('Público inexistente', MEL, `select publicar_recado('Aviso','Texto','area','nao-existe')`, [], 'Área não encontrada.');
    await bloqueia('Escolha de público inválida', MEL, `select publicar_recado('Aviso','Texto','geral')`, [], 'Escolha para quem é o recado.');
    await bloqueia('Título vazio', MEL, `select publicar_recado('   ','Texto','todos')`, [], 'Dê um título ao recado.');
    await bloqueia('Texto vazio', MEL, `select publicar_recado('Aviso','  ','todos')`, [], 'Escreva o recado.');
    await bloqueia('Título longo demais', MEL, `select publicar_recado($1,'Texto','todos')`, ['x'.repeat(81)], 'O título do recado tem no máximo 80 caracteres.');
    await bloqueia('Texto longo demais', MEL, `select publicar_recado('Aviso',$1,'todos')`, ['x'.repeat(1001)], 'O recado tem no máximo 1000 caracteres.');
    await bloqueia('Visitante sem login não publica', null, `select publicar_recado('Aviso','Texto','todos')`, [], 'permission denied for function publicar_recado');
    const rTodos = await valor(MEL, `select publicar_recado('Reunião geral adiada','Passou para sexta, 19h.','todos')`);
    const rProj = await valor(JOAO, `select publicar_recado('Entrega do cliente','Revisem os fluxos até quarta.','area','proj')`);
    const rCom = await valor(DUDA, `select publicar_recado('Pauta do Instagram','Mandem as ideias no grupo.','nucleo','com-mkt')`);
    const avisadas = async recado => (await db.query(`select count(*)::int as n from notificacoes where recado_id = $1`, [recado])).rows[0].n;
    confere('Recado para toda a equipe avisa todos, menos quem publicou', await avisadas(rTodos), pessoasAtivas - 1);
    confere('Recado para a área avisa só a área (a diretoria que cobre a vaga publica sem ser do público)', await avisadas(rProj), pessoasProj);
    const veRecados = {};
    for (const [nome, email] of [['mel', MEL], ['joao', JOAO], ['ana', ANA], ['victor', VICTOR], ['camila', CAMILA], ['duda', DUDA], ['pedro', PEDRO]]) {
      veRecados[nome] = (await como(email, `select titulo from recados_painel order by titulo`)).map(l => l.titulo);
    }
    confere('Cada pessoa lê os recados do seu público (a Presidência lê todos)', veRecados, {
      mel: ['Entrega do cliente', 'Pauta do Instagram', 'Reunião geral adiada'],
      joao: ['Entrega do cliente', 'Pauta do Instagram', 'Reunião geral adiada'],
      ana: ['Entrega do cliente', 'Reunião geral adiada'],
      victor: ['Entrega do cliente', 'Reunião geral adiada'],
      camila: ['Pauta do Instagram', 'Reunião geral adiada'],
      duda: ['Pauta do Instagram', 'Reunião geral adiada'],
      pedro: ['Reunião geral adiada'],
    });
    confere('A linha do recado traz público e autor', await como(CAMILA, `select publico, autor_nome, pode_retirar from recados_painel where titulo = 'Pauta do Instagram'`), [{ publico: 'Marketing', autor_nome: 'Duda', pode_retirar: false }]);
    confere('O sino de Ana traz os recados que chegaram', (await como(ANA, `select titulo, autor_nome from minhas_notificacoes where tipo = 'recado' order by titulo`)), [{ titulo: 'Entrega do cliente', autor_nome: 'João' }, { titulo: 'Reunião geral adiada', autor_nome: 'Mel' }]);
    confere('Quem publicou não recebe aviso do próprio recado', await valor(JOAO, `select count(*)::int from minhas_notificacoes where recado_id = $1`, [rProj]), 0);
    await permite('Ana abre o recado e ele sai do sino', ANA, `select marcar_notificacoes_lidas(array(select id from minhas_notificacoes where recado_id = $1))`, [rTodos]);
    confere('Só aquele recado saiu do sino de Ana', (await como(ANA, `select titulo from minhas_notificacoes where tipo = 'recado'`)).map(l => l.titulo), ['Entrega do cliente']);
    confere('O recado lido continua na Tela Inicial dela', await valor(ANA, `select count(*)::int from recados_painel where id = $1`, [rTodos]), 1);
    await permite('Marcar tudo como lido (sem lista)', ANA, `select marcar_notificacoes_lidas()`);
    confere('Depois de marcar tudo, o sino de Ana só tem atrasos (nenhum, neste cenário)', await valor(ANA, `select count(*)::int from minhas_notificacoes where tipo <> 'atraso'`), 0);

    const destinos = {};
    for (const [nome, email] of [['mel', MEL], ['luis', LUIS], ['joao', JOAO], ['duda', DUDA], ['ana', ANA]]) destinos[nome] = await valor(email, `select count(*)::int from destinos_de_recado`);
    const totais = { areas: await valor(MEL, `select count(*)::int from areas`), nucleos: await valor(MEL, `select count(*)::int from nucleos`), nucleosDoJoao: await valor(MEL, `select count(*)::int from nucleos where area_id in ('com','proj')`) };
    confere('Destinos de recado: Presidência, diretoria (a sua área e a que cobre), gerência e membro', destinos, {
      mel: 1 + totais.areas + totais.nucleos, luis: 1 + totais.areas + totais.nucleos, joao: 1 + 2 + totais.nucleosDoJoao, duda: 1, ana: 0 });
    confere('A diretoria publica para as áreas que conduz; a gerência, só para o núcleo', [
      (await como(JOAO, `select escopo_id from destinos_de_recado where escopo = 'area' order by escopo_id`)).map(l => l.escopo_id),
      (await como(DUDA, `select escopo, escopo_id from destinos_de_recado`)),
    ], [['com', 'proj'], [{ escopo: 'nucleo', escopo_id: 'com-mkt' }]]);

    await bloqueia('Membro não retira recado de outra pessoa', ANA, `select retirar_recado($1)`, [rProj], 'Só quem publicou o recado ou a Presidência pode retirá-lo.');
    await bloqueia('Gerência não retira recado da diretoria', DUDA, `select retirar_recado($1)`, [rTodos], 'Só quem publicou o recado ou a Presidência pode retirá-lo.');
    await permite('Quem publicou retira o recado', JOAO, `select retirar_recado($1)`, [rProj]);
    confere('Recado retirado some para todos e do sino', [
      await valor(MEL, `select count(*)::int from recados_painel where id = $1`, [rProj]),
      await valor(ANA, `select count(*)::int from minhas_notificacoes where recado_id = $1`, [rProj]),
      await valor(JOAO, `select count(*)::int from recados_painel where id = $1`, [rProj]),
    ], [0, 0, 0]);
    await bloqueia('Retirar de novo: já não existe', JOAO, `select retirar_recado($1)`, [rProj], 'Recado não encontrado.');
    await permite('A Presidência retira o recado de outra pessoa', MEL, `select retirar_recado($1)`, [rCom]);
    confere('O recado retirado fica guardado no banco', (await db.query(`select count(*)::int as n from recados where retirado_em is not null`)).rows[0].n, 2);
    confere('Publicar e retirar ficam na auditoria', (await db.query(`select acao from auditoria where acao in ('Publicou recado','Retirou recado') order by acao, detalhe`)).rows.map(l => l.acao),
      ['Publicou recado', 'Publicou recado', 'Publicou recado', 'Retirou recado', 'Retirou recado']);

    confere('Ninguém lê a notificação de outra pessoa', [
      await valor(CAMILA, `select count(*)::int from notificacoes where pessoa_id <> $1`, [iCamila]),
      await valor(MEL, `select count(*)::int from notificacoes where pessoa_id <> $1`, [iMel]),
    ], [0, 0]);
    confere('Ninguém escreve em recados nem em notificações diretamente', [
      (await tenta(MEL, `insert into recados(autor_id, titulo, texto, escopo) values ($1,'x','y','todos')`, [iMel])).startsWith('permission denied'),
      (await tenta(MEL, `update recados set titulo = 'z'`)).startsWith('permission denied'),
      (await tenta(ANA, `update notificacoes set lida_em = now()`)).startsWith('permission denied'),
      (await tenta(ANA, `delete from notificacoes`)).startsWith('permission denied'),
      (await tenta(MEL, `insert into notificacoes(pessoa_id, tipo, recado_id) values ($1,'recado',$2)`, [iMel, rTodos])).startsWith('permission denied'),
    ], [true, true, true, true, true]);
    confere('Fechado ao visitante e a quem não tem cadastro', [
      (await tenta(null, `select * from recados_painel`)).startsWith('permission denied'),
      (await tenta(null, `select * from minhas_notificacoes`)).startsWith('permission denied'),
      (await tenta(null, `select * from destinos_de_recado`)).startsWith('permission denied'),
      await valor('sem-cadastro@facil.test', `select count(*)::int from recados_painel`),
      await valor('sem-cadastro@facil.test', `select count(*)::int from minhas_notificacoes`),
      await valor('sem-cadastro@facil.test', `select count(*)::int from destinos_de_recado`),
    ], [true, true, true, 0, 0, 0]);

    // recados para toda a equipe com autorização e prazo de exibição (19)
    const precisa = {};
    for (const [nome, email] of [['mel', MEL], ['luis', LUIS], ['maju', MAJU], ['joao', JOAO], ['duda', DUDA], ['ana', ANA]]) {
      precisa[nome] = (await como(email, `select precisa_autorizacao from destinos_de_recado where escopo = 'todos'`)).map(l => l.precisa_autorizacao);
    }
    confere('Toda a equipe: Presidente, Vice e Assessoria publicam direto; diretoria pede autorização; gerência e membros não', precisa,
      { mel: [false], luis: [false], maju: [false], joao: [true], duda: [], ana: [] });
    await bloqueia('Gerência não pede recado para toda a equipe', DUDA, `select publicar_recado('Aviso','Texto','todos')`, [], 'Você não pode enviar recados para este público.');
    const rPedido = await valor(JOAO, `select publicar_recado('Feira de profissões','Precisamos de voluntários no sábado.','todos', null, privado.hoje() + 3)`);
    confere('Pedido da diretoria fica aguardando, com prazo, e ninguém é avisado', [
      (await db.query(`select situacao, visivel_ate = (now() at time zone 'America/Sao_Paulo')::date + 3 as prazo_certo, publicado_em is null as sem_data from recados where id = $1`, [rPedido])).rows[0],
      await avisadas(rPedido),
    ], [{ situacao: 'pendente', prazo_certo: true, sem_data: true }, 0]);
    const vePedido = {};
    for (const [nome, email] of [['joao', JOAO], ['maju', MAJU], ['mel', MEL], ['luis', LUIS], ['ana', ANA], ['duda', DUDA]]) {
      vePedido[nome] = (await como(email, `select situacao, pode_autorizar from recados_painel where id = $1`, [rPedido]));
    }
    confere('O pedido aparece para quem pediu e para quem autoriza; o público ainda não vê', vePedido, {
      joao: [{ situacao: 'pendente', pode_autorizar: false }], maju: [{ situacao: 'pendente', pode_autorizar: true }],
      mel: [{ situacao: 'pendente', pode_autorizar: true }], luis: [{ situacao: 'pendente', pode_autorizar: true }], ana: [], duda: [] });
    confere('O sino de quem autoriza mostra o pedido (e só dele)', [
      (await como(MAJU, `select tipo, titulo, autor_nome from minhas_notificacoes where recado_id = $1`, [rPedido])),
      await valor(JOAO, `select count(*)::int from minhas_notificacoes where recado_id = $1`, [rPedido]),
      await valor(ANA, `select count(*)::int from minhas_notificacoes where recado_id = $1`, [rPedido]),
    ], [[{ tipo: 'autorizacao', titulo: 'Feira de profissões', autor_nome: 'João' }], 0, 0]);
    await bloqueia('Ninguém autoriza o próprio recado', JOAO, `select decidir_recado($1, true)`, [rPedido], 'Ninguém autoriza o próprio recado.');
    await bloqueia('Gerência não autoriza recado', DUDA, `select decidir_recado($1, true)`, [rPedido], 'Só a Presidência, a Vice-Presidência ou a Assessoria autorizam recados para toda a equipe.');
    await bloqueia('Visitante sem login não decide', null, `select decidir_recado($1, true)`, [rPedido], 'permission denied for function decidir_recado');
    await permite('Assessoria autoriza o pedido da diretoria', MAJU, `select decidir_recado($1, true)`, [rPedido]);
    confere('Autorizado: publicado, avisa todos menos quem pediu e sai do sino de quem autoriza', [
      (await db.query(`select situacao, publicado_em is not null as com_data from recados where id = $1`, [rPedido])).rows[0],
      await avisadas(rPedido),
      await valor(ANA, `select count(*)::int from recados_painel where id = $1`, [rPedido]),
      await valor(ANA, `select tipo from minhas_notificacoes where recado_id = $1`, [rPedido]),
      await valor(MEL, `select count(*)::int from minhas_notificacoes where recado_id = $1 and tipo = 'autorizacao'`, [rPedido]),
    ], [{ situacao: 'publicado', com_data: true }, pessoasAtivas - 1, 1, 'recado', 0]);
    await bloqueia('Decidir de novo não vale', MEL, `select decidir_recado($1, false)`, [rPedido], 'Este recado não está aguardando autorização.');

    const rDaMaju = await valor(MAJU, `select publicar_recado('Prestação de contas','Envio na sexta.','todos')`);
    confere('A Assessoria publica direto para toda a equipe e todos menos ela são avisados', [
      (await db.query(`select situacao from recados where id = $1`, [rDaMaju])).rows[0].situacao, await avisadas(rDaMaju),
    ], ['publicado', pessoasAtivas - 1]);
    const rRifa = await valor(JOAO, `select publicar_recado('Rifa de novembro','Comprem rifas.','todos')`);
    await bloqueia('Motivo da recusa tem limite', LUIS, `select decidir_recado($1, false, $2)`, [rRifa, 'x'.repeat(301)], 'O motivo tem no máximo 300 caracteres.');
    await permite('A Vice recusa com motivo', LUIS, `select decidir_recado($1, false, ' Já saiu no grupo. ')`, [rRifa]);
    confere('Recusado: só quem pediu vê, com o motivo; ninguém é avisado', [
      (await como(JOAO, `select situacao, motivo_recusa, pode_autorizar from recados_painel where id = $1`, [rRifa])),
      await valor(MEL, `select count(*)::int from recados_painel where id = $1`, [rRifa]),
      await valor(ANA, `select count(*)::int from recados_painel where id = $1`, [rRifa]),
      await avisadas(rRifa),
      await valor(MEL, `select count(*)::int from minhas_notificacoes where recado_id = $1`, [rRifa]),
    ], [[{ situacao: 'recusado', motivo_recusa: 'Já saiu no grupo.', pode_autorizar: false }], 0, 0, 0, 0]);
    await permite('A Assessoria publica direto para uma área', MAJU, `select publicar_recado('Aviso da área','Texto','area','com')`);
    confere('Para área e núcleo não há autorização', (await db.query(`select situacao from recados where titulo = 'Aviso da área'`)).rows.map(l => l.situacao), ['publicado']);

    await bloqueia('Prazo no passado é recusado', MEL, `select publicar_recado('Aviso','Texto','todos', null, privado.hoje() - 1)`, [], 'A data limite não pode ser anterior a hoje.');
    await bloqueia('Prazo de mais de um ano é recusado', MEL, `select publicar_recado('Aviso','Texto','todos', null, privado.hoje() + 366)`, [], 'A data limite pode ser no máximo um ano à frente.');
    const rSoHoje = await valor(MEL, `select publicar_recado('Só hoje','Sala 3.','todos', null, privado.hoje())`);
    confere('Com prazo até hoje, o recado aparece hoje', [await valor(ANA, `select count(*)::int from recados_painel where id = $1`, [rSoHoje]), await valor(ANA, `select count(*)::int from minhas_notificacoes where recado_id = $1`, [rSoHoje])], [1, 1]);
    await db.query(`update recados set visivel_ate = visivel_ate - 1 where id = $1`, [rSoHoje]);
    confere('Passado o prazo, some da Tela Inicial e do sino de todos, mas fica guardado', [
      await valor(ANA, `select count(*)::int from recados_painel where id = $1`, [rSoHoje]),
      await valor(ANA, `select count(*)::int from minhas_notificacoes where recado_id = $1`, [rSoHoje]),
      await valor(MEL, `select count(*)::int from recados_painel where id = $1`, [rSoHoje]),
      (await db.query(`select count(*)::int as n from recados where id = $1`, [rSoHoje])).rows[0].n,
    ], [0, 0, 0, 1]);
    const rVencido = await valor(JOAO, `select publicar_recado('Pedido que venceu','Texto','todos', null, privado.hoje())`);
    await db.query(`update recados set visivel_ate = visivel_ate - 1 where id = $1`, [rVencido]);
    confere('Pedido vencido sai da lista de quem autoriza', await valor(MEL, `select count(*)::int from minhas_notificacoes where recado_id = $1`, [rVencido]), 0);
    await bloqueia('Pedido vencido não pode ser autorizado', MEL, `select decidir_recado($1, true)`, [rVencido], 'O prazo deste recado já passou. Recuse e peça um novo.');
    confere('Pedir, autorizar e recusar ficam na auditoria', (await db.query(`select acao, count(*)::int as n from auditoria where acao in ('Pediu autorização de recado','Autorizou recado','Recusou recado') group by acao order by acao`)).rows,
      [{ acao: 'Autorizou recado', n: 1 }, { acao: 'Pediu autorização de recado', n: 3 }, { acao: 'Recusou recado', n: 1 }]);

    // sugestões (20)
    const LUCAS = 'lucas@facil.test';
    await bloqueia('Sugestão: tipo inválido', ANA, `select criar_sugestao('x','Título','Texto')`, [], 'Escolha o tipo da sugestão.');
    await bloqueia('Sugestão: título vazio', ANA, `select criar_sugestao('bug','  ','Texto')`, [], 'Dê um título à sugestão.');
    await bloqueia('Sugestão: descrição vazia', ANA, `select criar_sugestao('bug','Título','  ')`, [], 'Descreva a sugestão.');
    await bloqueia('Sugestão: título longo', ANA, `select criar_sugestao('bug',$1,'Texto')`, ['x'.repeat(121)], 'O título tem no máximo 120 caracteres.');
    await bloqueia('Sugestão: descrição longa', ANA, `select criar_sugestao('bug','Título',$1)`, ['x'.repeat(2001)], 'A descrição tem no máximo 2000 caracteres.');
    await bloqueia('Visitante sem login não envia sugestão', null, `select criar_sugestao('bug','Título','Texto')`, [], 'permission denied for function criar_sugestao');
    const sAna = await valor(ANA, `select criar_sugestao('melhoria','  Filtro por prazo nas demandas ',' Seria bom filtrar por semana. ')`);
    confere('Todas as pessoas ativas leem as sugestões; visitante e login sem cadastro, não', [
      await valor(CAMILA, `select count(*)::int from sugestoes_painel`), await valor(PEDRO, `select count(*)::int from sugestoes_painel`),
      await valor('sem-cadastro@facil.test', `select count(*)::int from sugestoes_painel`),
      (await tenta(null, `select * from sugestoes_painel`)).startsWith('permission denied'),
    ], [1, 1, 0, true]);
    confere('A sugestão sai com o texto limpo, aberta e sem apoios', await como(PEDRO, `select tipo, titulo, descricao, situacao, autor_nome, apoios, apoiei, comentarios, resposta from sugestoes_painel`),
      [{ tipo: 'melhoria', titulo: 'Filtro por prazo nas demandas', descricao: 'Seria bom filtrar por semana.', situacao: 'aberta', autor_nome: 'Ana', apoios: 0, apoiei: false, comentarios: 0, resposta: null }]);

    await bloqueia('Quem sugeriu não apoia a própria sugestão', ANA, `select apoiar_sugestao($1)`, [sAna], 'Quem sugeriu não apoia a própria sugestão.');
    confere('Apoiar liga e desliga', [
      await valor(CAMILA, `select apoiar_sugestao($1)`, [sAna]), await valor(CAMILA, `select apoiar_sugestao($1)`, [sAna]), await valor(CAMILA, `select apoiar_sugestao($1)`, [sAna]),
    ], [true, false, true]);
    await como(LUCAS, `select apoiar_sugestao($1)`, [sAna]);
    confere('Contagem de apoios e quem já apoiou', [
      (await como(CAMILA, `select apoios, apoiei from sugestoes_painel`))[0], (await como(ANA, `select apoios, apoiei from sugestoes_painel`))[0],
    ], [{ apoios: 2, apoiei: true }, { apoios: 2, apoiei: false }]);

    await bloqueia('Comentário vazio', CAMILA, `select comentar_sugestao($1,'  ')`, [sAna], 'Escreva o comentário.');
    await bloqueia('Comentário longo', CAMILA, `select comentar_sugestao($1,$2)`, [sAna, 'x'.repeat(1001)], 'O comentário tem no máximo 1000 caracteres.');
    const avisosDaAna = () => como(ANA, `select tipo, titulo, detalhe from minhas_notificacoes where sugestao_id = $1`, [sAna]);
    await como(CAMILA, `select comentar_sugestao($1,'Eu também uso muito isso.')`, [sAna]);
    confere('Comentário de outra pessoa avisa quem sugeriu', await avisosDaAna(), [{ tipo: 'sugestao', titulo: 'Filtro por prazo nas demandas', detalhe: 'Novo comentário de Camila' }]);
    await como(ANA, `select comentar_sugestao($1,'Valeu!')`, [sAna]);
    await como(DUDA, `select comentar_sugestao($1,'Ajudaria no Marketing.')`, [sAna]);
    confere('O próprio comentário não avisa, e o aviso novo substitui o anterior ainda não lido', await avisosDaAna(), [{ tipo: 'sugestao', titulo: 'Filtro por prazo nas demandas', detalhe: 'Novo comentário de Duda' }]);
    confere('Comentários em ordem, com autor', (await como(PEDRO, `select autor_nome, texto from sugestao_comentarios_painel where sugestao_id = $1 order by criado_em`, [sAna])).map(c => `${c.autor_nome}: ${c.texto}`),
      ['Camila: Eu também uso muito isso.', 'Ana: Valeu!', 'Duda: Ajudaria no Marketing.']);

    await bloqueia('Gerência não responde sugestão', DUDA, `select responder_sugestao($1,'planejada','ok')`, [sAna], 'Só a Presidência e o desenvolvimento do SGI respondem às sugestões.');
    await bloqueia('Membro não responde sugestão', ANA, `select responder_sugestao($1,'feita')`, [sAna], 'Só a Presidência e o desenvolvimento do SGI respondem às sugestões.');
    await bloqueia('Situação inválida', MEL, `select responder_sugestao($1,'pronta')`, [sAna], 'Escolha a situação.');
    confere('Só a Presidência vê o botão de responder', [await valor(MEL, `select pode_responder from sugestoes_painel`), await valor(MAJU, `select pode_responder from sugestoes_painel`), await valor(ANA, `select pode_responder from sugestoes_painel`)], [true, true, false]);
    await permite('A Assessoria responde', MAJU, `select responder_sugestao($1,'planejada',' Entra no próximo ciclo. ')`, [sAna]);
    confere('Resposta gravada e quem sugeriu é avisado', [
      (await como(CAMILA, `select situacao, resposta, respondido_por_nome from sugestoes_painel`))[0], await avisosDaAna(),
    ], [{ situacao: 'planejada', resposta: 'Entra no próximo ciclo.', respondido_por_nome: 'Maju' }, [{ tipo: 'sugestao', titulo: 'Filtro por prazo nas demandas', detalhe: 'Situação: Planejada' }]]);
    await permite('Quem sugeriu lê o aviso', ANA, `select marcar_notificacoes_lidas(array(select id from minhas_notificacoes where sugestao_id = $1))`, [sAna]);
    confere('Aviso lido sai do sino', (await avisosDaAna()).length, 0);
    const sMel = await valor(MEL, `select criar_sugestao('bug','Erro ao salvar','Aparece erro.')`);
    await permite('A Presidência responde a própria sugestão sem gerar aviso', MEL, `select responder_sugestao($1,'feita')`, [sMel]);
    confere('Sem aviso para si mesma, e resposta vazia fica nula', [
      await valor(MEL, `select count(*)::int from minhas_notificacoes where sugestao_id = $1`, [sMel]),
      await valor(MEL, `select resposta from sugestoes_painel where id = $1`, [sMel]),
    ], [0, null]);
    confere('Ninguém grava sugestões, apoios ou comentários diretamente', [
      (await tenta(ANA, `insert into sugestoes(autor_id, tipo, titulo, descricao) values ($1,'bug','x','y')`, [iAna])).startsWith('permission denied'),
      (await tenta(MEL, `update sugestoes set situacao = 'feita'`)).startsWith('permission denied'),
      (await tenta(CAMILA, `delete from sugestao_apoios`)).startsWith('permission denied'),
      (await tenta(CAMILA, `insert into sugestao_comentarios(sugestao_id, autor_id, texto) values ($1,$2,'x')`, [sAna, iCamila])).startsWith('permission denied'),
    ], [true, true, true, true]);
    confere('Enviar e responder sugestões ficam na auditoria', (await db.query(`select acao, count(*)::int as n from auditoria where acao in ('Enviou sugestão','Respondeu sugestão') group by acao order by acao`)).rows,
      [{ acao: 'Enviou sugestão', n: 2 }, { acao: 'Respondeu sugestão', n: 2 }]);

    // desenvolvimento do SGI responde às sugestões (24)
    const msgDev = 'Só a Presidente define quem desenvolve o SGI.';
    await bloqueia('Diretoria não se marca como desenvolvimento do SGI', JOAO, `select definir_desenvolvimento_sgi($1, true)`, [iJoao], msgDev);
    await bloqueia('Vice não marca desenvolvimento do SGI', LUIS, `select definir_desenvolvimento_sgi($1, true)`, [iJoao], msgDev);
    await bloqueia('Sem a marca, a diretoria não encerra sugestão', JOAO, `select responder_sugestao($1,'feita')`, [sAna], 'Só a Presidência e o desenvolvimento do SGI respondem às sugestões.');
    const demandasDoJoao = await valor(JOAO, `select count(*)::int from demandas_visiveis`);
    await permite('A Presidente marca quem desenvolve o SGI', MEL, `select definir_desenvolvimento_sgi($1, true)`, [iJoao]);
    confere('Com a marca, o botão de responder aparece para quem desenvolve', [await valor(JOAO, `select pode_responder from sugestoes_painel where id = $1`, [sAna]), await valor(DUDA, `select pode_responder from sugestoes_painel where id = $1`, [sAna])], [true, false]);
    await permite('Quem desenvolve o SGI encerra o chamado', JOAO, `select responder_sugestao($1,'feita',' Entregue na versão de novembro. ')`, [sAna]);
    confere('Encerrado: situação, resposta e autor gravados, e quem sugeriu é avisado', [
      (await como(ANA, `select situacao, resposta, respondido_por_nome from sugestoes_painel where id = $1`, [sAna]))[0], await avisosDaAna(),
    ], [{ situacao: 'feita', resposta: 'Entregue na versão de novembro.', respondido_por_nome: 'João' }, [{ tipo: 'sugestao', titulo: 'Filtro por prazo nas demandas', detalhe: 'Situação: Feita' }]]);
    confere('A marca não dá outros acessos', await valor(JOAO, `select count(*)::int from demandas_visiveis`), demandasDoJoao);
    await bloqueia('Ninguém liga a marca direto na tabela', JOAO, `update pessoas set desenvolve_sgi = true where id = $1`, [iAna], 'permission denied for table pessoas');
    await permite('A Presidente desmarca', MEL, `select definir_desenvolvimento_sgi($1, false)`, [iJoao]);
    await bloqueia('Desmarcado, não responde mais', JOAO, `select responder_sugestao($1,'aberta')`, [sAna], 'Só a Presidência e o desenvolvimento do SGI respondem às sugestões.');
    confere('Marcar e desmarcar ficam na auditoria', (await db.query(`select acao from auditoria where acao like '%desenvolvimento do SGI' order by id`)).rows.map(l => l.acao),
      ['Marcou desenvolvimento do SGI', 'Desmarcou desenvolvimento do SGI']);

    // matriz RACI (23)
    const iDudaR = await id('Duda'), iMajuR = await id('Maju');
    confere('Aprovadores possíveis do projeto, com a diretoria da área sugerida', [
      (await como(JOAO, `select nome from aprovadores_possiveis where projeto_id = $1 order by nome`, [pCli])).map(l => l.nome),
      (await como(JOAO, `select nome from aprovadores_possiveis where projeto_id = $1 and sugerido`, [pCli])).map(l => l.nome),
      (await como(DUDA, `select nome from aprovadores_possiveis where projeto_id = $1 and sugerido`, [pMkt])).map(l => l.nome),
      (await como(LUIS, `select nome from aprovadores_possiveis where projeto_id = $1 and sugerido`, [pFin])).map(l => l.nome),
      await valor(ANA, `select count(*)::int from aprovadores_possiveis`),
    ], [['João', 'Luis', 'Maju', 'Mel', 'Victor'], ['João'], ['João'], ['Luis'], 0]);
    confere('Informáveis: Presidência (a Presidente entra sozinha) e diretorias; membros não consultam', [
      (await como(JOAO, `select nome, automatico from pessoas_informaveis order by nome`)),
      await valor(ANA, `select count(*)::int from pessoas_informaveis`),
    ], [[{ nome: 'João', automatico: false }, { nome: 'Luis', automatico: false }, { nome: 'Maju', automatico: false }, { nome: 'Mel', automatico: true }], 0]);

    const novaRaci = `select criar_demanda_raci($1,'Proposta para a Padaria','',privado.hoje() + 4,'alta',array[$2,$3]::uuid[],$4,$5,$6::uuid[])`;
    const contarDemandas = async () => (await db.query(`select count(*)::int as n from demandas`)).rows[0].n;
    const antesDosErros = await contarDemandas();
    await bloqueia('RACI: sem aprovador', JOAO, novaRaci, [pCli, iAna, iLucas, null, 'parte', []], 'Escolha quem aprova a entrega.');
    await bloqueia('RACI: membro não aprova', JOAO, novaRaci, [pCli, iAna, iLucas, iCamila, 'parte', []], 'Quem aprova precisa ser da liderança do projeto: gerência ou assessoria do núcleo, diretoria da área ou Presidência.');
    await bloqueia('RACI: gerência de outro núcleo não aprova', JOAO, novaRaci, [pCli, iAna, iLucas, iDudaR, 'parte', []], 'Quem aprova precisa ser da liderança do projeto: gerência ou assessoria do núcleo, diretoria da área ou Presidência.');
    await bloqueia('RACI: alcance inválido', JOAO, novaRaci, [pCli, iAna, iLucas, iJoao, 'tudo', []], 'Escolha o alcance da entrega.');
    await bloqueia('RACI: membro não é informado', JOAO, novaRaci, [pCli, iAna, iLucas, iJoao, 'geral', [iCamila]], 'Só a Presidência e as diretorias podem ser informadas.');
    await bloqueia('RACI: quem aprova não é informado também', JOAO, novaRaci, [pCli, iAna, iLucas, iJoao, 'geral', [iJoao]], 'Quem executa ou aprova não entra como informado.');
    await bloqueia('RACI: restrita só tem a Presidência como aprovadora', MEL,
      `select criar_demanda_raci($1,'Metas','',privado.hoje() + 4,'alta',array[$2]::uuid[],$3,'parte')`, [pEst, iMel, iJoao],
      'Quem aprova precisa ser da liderança do projeto: gerência ou assessoria do núcleo, diretoria da área ou Presidência.');
    await bloqueia('RACI: restrita só informa a Presidência', MEL,
      `select criar_demanda_raci($1,'Metas','',privado.hoje() + 4,'alta',array[$2]::uuid[],$3,'geral',array[$4]::uuid[])`, [pEst, iMajuR, iMel, iJoao],
      'Demanda restrita: só a Presidência pode ser informada.');
    confere('Erro na RACI não deixa demanda pela metade', await contarDemandas(), antesDosErros);

    const dRaci = await valor(JOAO, novaRaci, [pCli, iAna, iLucas, iJoao, 'geral', [iLuis]]);
    const raciDe = async demanda => (await db.query(
      `select d.alcance, a.nome as aprovador, array(select p.nome from demanda_informados i join pessoas p on p.id = i.pessoa_id where i.demanda_id = d.id order by p.nome) as informados
         from demandas d join pessoas a on a.id = d.aprovador_id where d.id = $1`, [demanda])).rows[0];
    confere('Alcance geral: quem foi escolhido e a Presidente são informados', await raciDe(dRaci), { alcance: 'geral', aprovador: 'João', informados: ['Luis', 'Mel'] });
    const dParte = await valor(JOAO, novaRaci, [pCli, iAna, iLucas, iJoao, 'parte', [iLuis]]);
    confere('Alcance parte do time: ninguém é informado', await raciDe(dParte), { alcance: 'parte', aprovador: 'João', informados: [] });

    const caixa = (email, demanda) => como(email, `select com_quem, pode_entregar, pode_sinalizar_duvida, pode_responder_duvida, pode_avaliar, na_minha_caixa, eh_ar from demandas_visiveis where id = $1`, [demanda]).then(l => l[0]);
    const sinoRaci = (email, demanda) => como(email, `select detalhe from minhas_notificacoes where demanda_id = $1 and tipo = 'raci'`, [demanda]).then(l => l.map(n => n.detalhe));
    confere('Criada: está na caixa de quem executa', [await caixa(ANA, dRaci), await caixa(JOAO, dRaci)], [
      { com_quem: 'executores', pode_entregar: true, pode_sinalizar_duvida: true, pode_responder_duvida: false, pode_avaliar: false, na_minha_caixa: true, eh_ar: false },
      { com_quem: 'executores', pode_entregar: false, pode_sinalizar_duvida: false, pode_responder_duvida: false, pode_avaliar: false, na_minha_caixa: false, eh_ar: false }]);
    await bloqueia('Quem não executa não entrega', CAMILA, `select entregar_demanda($1)`, [dRaci], 'Só quem executa a demanda pode fazer isso.');
    await bloqueia('Não se aprova o que não foi entregue', JOAO, `select aprovar_entrega($1)`, [dRaci], 'Esta entrega não está aguardando aprovação.');
    await bloqueia('Dúvida precisa de texto', ANA, `select sinalizar_duvida($1,'  ')`, [dRaci], 'Escreva a dúvida.');
    await permite('Executor sinaliza dúvida ao aprovador', ANA, `select sinalizar_duvida($1,' Qual modelo de fluxograma? ')`, [dRaci]);
    confere('Dúvida: a demanda vai para a caixa de quem aprova, que é avisado', [
      (await db.query(`select status, duvida_aberta from demandas where id = $1`, [dRaci])).rows[0],
      await caixa(JOAO, dRaci), (await caixa(ANA, dRaci)).na_minha_caixa, await sinoRaci(JOAO, dRaci),
    ], [{ status: 'andamento', duvida_aberta: true },
      { com_quem: 'aprovador', pode_entregar: false, pode_sinalizar_duvida: false, pode_responder_duvida: true, pode_avaliar: false, na_minha_caixa: true, eh_ar: false },
      false, ['Dúvida de Ana']]);
    await bloqueia('Uma dúvida por vez', LUCAS, `select sinalizar_duvida($1,'Outra')`, [dRaci], 'Já há uma dúvida aberta nesta demanda. Aguarde a resposta.');
    await bloqueia('Com dúvida aberta não se entrega', ANA, `select entregar_demanda($1)`, [dRaci], 'Há uma dúvida aberta com quem aprova. Aguarde a resposta antes de enviar.');
    await bloqueia('Gerência do núcleo não responde no lugar de quem aprova', VICTOR, `select responder_duvida($1,'x')`, [dRaci], 'Só quem aprova esta entrega pode fazer isso.');
    await permite('Quem aprova responde e devolve', JOAO, `select responder_duvida($1,'Use o modelo B.')`, [dRaci]);
    confere('Respondida: volta para quem executa, que é avisado; o aviso de quem aprova sai', [
      (await caixa(ANA, dRaci)).com_quem, await sinoRaci(ANA, dRaci), await sinoRaci(LUCAS, dRaci), await sinoRaci(JOAO, dRaci),
    ], ['executores', ['Dúvida respondida por João'], ['Dúvida respondida por João'], []]);
    confere('Entregar devolve a nova etapa', await valor(ANA, `select entregar_demanda($1,'Fluxo na pasta do projeto.')`, [dRaci]), 'revisao');
    confere('Em aprovação: caixa de quem aprova; avisos antigos de quem executa saem', [
      await caixa(JOAO, dRaci), await sinoRaci(JOAO, dRaci), await sinoRaci(ANA, dRaci),
    ], [{ com_quem: 'aprovador', pode_entregar: false, pode_sinalizar_duvida: false, pode_responder_duvida: false, pode_avaliar: true, na_minha_caixa: true, eh_ar: false },
      ['Entrega aguardando sua aprovação'], []]);
    await bloqueia('Executor não aprova a própria entrega', ANA, `select aprovar_entrega($1)`, [dRaci], 'Só quem aprova esta entrega pode fazer isso.');
    await bloqueia('Ajuste precisa de explicação', JOAO, `select solicitar_ajuste($1,'')`, [dRaci], 'Explique o ajuste que precisa ser feito.');
    await permite('Quem aprova pede ajuste', JOAO, `select solicitar_ajuste($1,'Faltou a etapa de entrega.')`, [dRaci]);
    confere('Ajuste: volta para quem executa, com aviso', [
      (await db.query(`select status from demandas where id = $1`, [dRaci])).rows[0].status, await sinoRaci(LUCAS, dRaci), await sinoRaci(JOAO, dRaci),
    ], ['andamento', ['Ajuste pedido por João'], []]);
    await como(LUCAS, `select entregar_demanda($1)`, [dRaci]);
    await permite('Quem aprova aprova a entrega', JOAO, `select aprovar_entrega($1)`, [dRaci]);
    confere('Aprovada: concluída, pontos para quem executou e aviso para executores e informados', [
      (await db.query(`select status from demandas where id = $1`, [dRaci])).rows[0].status,
      (await db.query(`select count(*)::int as n from lancamentos where demanda_id = $1 and valor = 2`, [dRaci])).rows[0].n,
      await sinoRaci(ANA, dRaci), await sinoRaci(MEL, dRaci), await sinoRaci(LUIS, dRaci), await sinoRaci(JOAO, dRaci),
      (await caixa(ANA, dRaci)).com_quem,
    ], ['concluida', 2, ['Entrega aprovada'], ['Entrega concluída · impacta a Fácil como um todo'], ['Entrega concluída · impacta a Fácil como um todo'], [], 'ninguem']);
    confere('A conversa fica registrada, e só quem vê a demanda lê', [
      (await como(ANA, `select tipo, autor_nome, texto from demanda_conversa_painel where demanda_id = $1 order by criado_em`, [dRaci])).map(c => `${c.tipo} · ${c.autor_nome}: ${c.texto}`),
      await valor(CAMILA, `select count(*)::int from demanda_conversa_painel where demanda_id = $1`, [dRaci]),
    ], [['duvida · Ana: Qual modelo de fluxograma?', 'resposta · João: Use o modelo B.', 'entrega · Ana: Fluxo na pasta do projeto.', 'ajuste · João: Faltou a etapa de entrega.'], 0]);
    confere('As passagens ficam na auditoria', (await db.query(`select acao, count(*)::int as n from auditoria where demanda_id = $1 and acao <> 'Criou demanda' group by acao order by acao`, [dRaci])).rows, [
      { acao: 'Aprovou entrega', n: 1 }, { acao: 'Definiu RACI', n: 1 }, { acao: 'Enviou para aprovação', n: 2 },
      { acao: 'Respondeu dúvida', n: 1 }, { acao: 'Sinalizou dúvida', n: 1 }, { acao: 'Solicitou ajuste', n: 1 }]);

    // A/R e informado de fora da área
    const dAr = await valor(LUIS, `select criar_demanda_raci($1,'Fechar orçamento','',privado.hoje() + 2,'alta',array[$2]::uuid[],$2,'geral',array[$3]::uuid[])`, [pFin, iLuis, iJoao]);
    confere('A/R: um só executor que também aprova; a diretoria informada passa a ver a demanda', [
      (await caixa(LUIS, dAr)), await valor(JOAO, `select motivo_acesso from demandas_visiveis where id = $1`, [dAr]),
      await valor(DUDA, `select count(*)::int from demandas_visiveis where id = $1`, [dAr]),
    ], [{ com_quem: 'executores', pode_entregar: true, pode_sinalizar_duvida: false, pode_responder_duvida: false, pode_avaliar: false, na_minha_caixa: true, eh_ar: true }, 'informado', 0]);
    await bloqueia('A/R não manda dúvida a si mesmo', LUIS, `select sinalizar_duvida($1,'x')`, [dAr], 'Em A/R, quem executa também aprova: não há a quem enviar a dúvida.');
    confere('A/R: concluir encerra direto e avisa os informados', [
      await valor(LUIS, `select entregar_demanda($1)`, [dAr]), await sinoRaci(JOAO, dAr), await sinoRaci(MEL, dAr), await sinoRaci(LUIS, dAr),
    ], ['concluida', ['Entrega concluída · impacta a Fácil como um todo'], ['Entrega concluída · impacta a Fácil como um todo'], []]);
    await bloqueia('Informado só consulta', JOAO, `select mudar_status($1,'andamento')`, [dAr], 'Você não pode alterar o status desta demanda.');

    // caminho antigo (quadro) e demandas sem aprovador
    await como(ANA, `select mudar_status($1,'revisao')`, [dParte]);
    confere('Mover para "Em aprovação" pelo quadro também avisa quem aprova', await sinoRaci(JOAO, dParte), ['Entrega aguardando sua aprovação']);
    await permite('Diretoria troca quem aprova com a entrega na caixa', JOAO,
      `select editar_demanda_raci($1,'Proposta para a Padaria','','revisao','alta',privado.hoje() + 4,array[$2,$3]::uuid[],$4,'parte')`, [dParte, iAna, iLucas, iVictor]);
    confere('O aviso passa para quem aprova agora', [await sinoRaci(VICTOR, dParte), await sinoRaci(JOAO, dParte), (await caixa(VICTOR, dParte)).pode_avaliar, (await caixa(JOAO, dParte)).pode_avaliar],
      [['Entrega aguardando sua aprovação'], [], true, false]);
    await bloqueia('Edição da RACI segue as mesmas regras', JOAO,
      `select editar_demanda_raci($1,'Proposta para a Padaria','','revisao','alta',privado.hoje() + 4,array[$2,$3]::uuid[],$4,'geral',array[$2]::uuid[])`, [dParte, iAna, iLucas, iVictor],
      'Quem executa ou aprova não entra como informado.');
    await bloqueia('Membro não edita a RACI', ANA,
      `select editar_demanda_raci($1,'x','','revisao','alta',privado.hoje() + 4,array[$2]::uuid[],$2,'parte')`, [dParte, iAna], 'Você não pode editar esta demanda.');
    const dSemA = await valor(VICTOR, `select criar_demanda($1,'Demanda antiga','',privado.hoje() + 5,'media',array[$2]::uuid[])`, [pCli, iAna]);
    await como(ANA, `select mudar_status($1,'revisao')`, [dSemA]);
    confere('Sem aprovador, a liderança que gere a demanda aprova', [(await caixa(VICTOR, dSemA)).pode_avaliar, (await caixa(JOAO, dSemA)).pode_avaliar, (await caixa(ANA, dSemA)).pode_avaliar], [true, true, false]);
    await permite('Gerência aprova demanda sem aprovador', VICTOR, `select aprovar_entrega($1)`, [dSemA]);
    confere('Ninguém grava RACI ou conversa diretamente', [
      (await tenta(JOAO, `insert into demanda_informados(demanda_id, pessoa_id) values ($1,$2)`, [dRaci, iCamila])).startsWith('permission denied'),
      (await tenta(JOAO, `insert into demanda_conversa(demanda_id, autor_id, tipo, texto) values ($1,$2,'resposta','x')`, [dRaci, iJoao])).startsWith('permission denied'),
      (await tenta(JOAO, `update demandas set aprovador_id = $2 where id = $1`, [dRaci, iJoao])).startsWith('permission denied'),
    ], [true, true, true]);

    // proteção da camada de dados
    await bloqueia('Gravação direta em tabela é bloqueada', JOAO, `insert into demandas(codigo,projeto_id,titulo,prazo,criado_por) values ('X-1',$1,'x',privado.hoje(),$2)`, [pCli, iJoao], 'permission denied for table demandas');
    await bloqueia('Alteração direta de pontos é bloqueada', LUIS, `update lancamentos set valor = 99`, [], 'permission denied for table lancamentos');
    await bloqueia('Visitante sem login não lê pessoas', null, `select count(*) from pessoas`, [], 'permission denied for table pessoas');
    await bloqueia('Visitante sem login não vê ranking', null, `select * from ranking()`, [], 'permission denied for function ranking');
    confere('Login sem cadastro não vê ninguém', await valor('sem-cadastro@facil.test', `select count(*)::int from pessoas`), 0);
    const auditoria = {};
    for (const n of ['mel', 'camila', 'pedro']) auditoria[n] = await valor(`${n}@facil.test`, `select count(*)::int from auditoria`);
    confere('Presidência vê toda a auditoria; membros, só o seu escopo', auditoria.mel > auditoria.camila && auditoria.camila > 0 && auditoria.pedro > 0, true);
  } catch (e) {
    falhas++;
    log(`ERRO GERAL ${e.message}`);
  }
  log(`RESULTADO ${total - falhas}/${total} verificações ok${falhas ? `, ${falhas} falha(s)` : ''}`);
  log('FIM');
})();
