// Testes de integração das regras do banco do SGI.
// Roda os scripts 01, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12 e 02 num Postgres real (PGlite, no navegador) com as partes do
// Supabase simuladas (auth.uid(), papéis anon/authenticated/service_role e storage)
// e confere, perfil a perfil, o que cada pessoa pode ver e fazer.
// Execução: powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1
// O runner injeta window.SQL01 a window.SQL12 antes deste módulo. O 06 roda sozinho, antes do 07.
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
    await bloqueia('Executor não valida a própria entrega', ANA, `select mudar_status($1,'concluida')`, [dCli], 'Só a liderança do núcleo, a diretoria ou a Presidência validam a conclusão.');
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
    await bloqueia('Aval só para falta de diretor', JOAO, `select solicitar_aval('justificar_falta', jsonb_build_object('reuniao',$1::text,'pessoa',$2::text), 'Pedido que não cabe para um membro')`, [rHoje, iLucas], 'O aval vale para a falta de um diretor já registrada nesta reunião.');
    await bloqueia('Presidente justifica direto, sem aval', MEL, `select solicitar_aval('justificar_falta', jsonb_build_object('reuniao',$1::text,'pessoa',$2::text), 'Tentativa de pedir aval sendo a Presidente')`, [rHoje, iJoao], 'A Presidente e a Vice justificam a falta diretamente.');
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
    confere('Equipe: e-mail e pessoas desativadas só para quem cadastra', {
      mel: await emails(MEL), gina: await emails(GINA), ana: await emails(ANA), duda: await emails(DUDA),
    }, {
      mel: [{ com_email: totalDePessoas, total: totalDePessoas, inativas: 2 }],
      gina: [{ com_email: totalDePessoas, total: totalDePessoas, inativas: 2 }],
      ana: [{ com_email: 0, total: totalDePessoas - 2, inativas: 0 }],
      duda: [{ com_email: 0, total: totalDePessoas - 2, inativas: 0 }],
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
      melPapeis: ['assessor', 'diretor', 'gerente', 'membro', 'presidente', 'vice'], ginaPapeis: ['assessor', 'gerente', 'membro'], anaPapeis: [],
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
