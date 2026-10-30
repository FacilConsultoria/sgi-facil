// Testes de integração das regras do banco do SGI.
// Roda os scripts 01 e 02 num Postgres real (PGlite, no navegador) com as partes do
// Supabase simuladas (auth.uid(), papéis anon/authenticated/service_role e storage)
// e confere, perfil a perfil, o que cada pessoa pode ver e fazer.
// Execução: powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1
// O runner injeta window.SQL01, window.SQL02 e window.SQL03 antes deste módulo.
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

(async () => {
  try {
    const db = new PGlite();
    await db.exec(SIMULACAO_SUPABASE);
    await db.exec(`insert into auth.users(email) values ('pres@facil.test'),('victor@facil.test')`);
    await db.exec(window.SQL01);
    await db.exec(window.SQL03);

    let erro02 = null;
    try { await db.exec(window.SQL02); } catch (e) { erro02 = e.message; }
    confere('02 recusa rodar sem os e-mails preenchidos', erro02, 'Preencha os quatro e-mails no início do script antes de rodar.');
    await db.exec(window.SQL02
      .replace("v_email_presidencia text := 'PREENCHER'", "v_email_presidencia text := 'Pres@facil.test'")
      .replace("v_email_victor      text := 'PREENCHER'", "v_email_victor      text := 'victor@facil.test'")
      .replace("v_email_emilli      text := 'PREENCHER'", "v_email_emilli      text := 'emilli@facil.test'")
      .replace("v_email_duda        text := 'PREENCHER'", "v_email_duda        text := 'duda@facil.test'"));
    await db.exec(`insert into auth.users(email) values ('emilli@facil.test'),('DUDA@facil.test')`);

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

    const P = 'pres@facil.test', V = 'victor@facil.test', E = 'emilli@facil.test', D = 'duda@facil.test';
    const ANA = 'ana@facil.test', CAMILA = 'camila@facil.test', PEDRO = 'pedro@facil.test', HEITOR = 'heitor@facil.test';
    for (const [email, nome, papel, area, nucleo] of [
      [HEITOR, 'Heitor', 'assessor', 'pres', 'pres-ass'], [ANA, 'Ana', 'membro', 'proj', 'proj-cli'],
      ['lucas@facil.test', 'Lucas', 'membro', 'proj', 'proj-cli'], [CAMILA, 'Camila', 'membro', 'com', 'com-mkt'],
      [PEDRO, 'Pedro', 'membro', 'adm', 'adm-gg']]) {
      await como(P, `select cadastrar_pessoa($1,$2,$3::papel,$4,$5)`, [email, nome, papel, area, nucleo]);
      await db.query(`insert into auth.users(email) values ($1)`, [email]);
    }
    const id = async nome => (await db.query(`select id from pessoas where nome = $1`, [nome])).rows[0].id;
    const [iAna, iLucas, iCamila, iPedro, iEmilli, iVictor, iPres] = await Promise.all(['Ana', 'Lucas', 'Camila', 'Pedro', 'Emilli', 'Victor', 'Presidente'].map(id));

    // cadastro
    await bloqueia('Gente e Gestão não cadastra diretoria', E, `select cadastrar_pessoa('x@facil.test','X','diretor','com',null)`, [], 'Só a Presidência cadastra Presidência e diretorias.');
    await bloqueia('Diretor fora de G&G não cadastra', V, `select cadastrar_pessoa('y@facil.test','Y','membro','com','com-mkt')`, [], 'Só a Presidência e a Gente e Gestão cadastram pessoas.');
    await bloqueia('Núcleo precisa ser da área', P, `select cadastrar_pessoa('z@facil.test','Z','membro','com','adm-gg')`, [], 'O núcleo escolhido não pertence a essa área.');

    // projetos e demandas
    const pCli = await valor(P, `select criar_projeto('Mapeamento de processos','Padaria Trigo Bom','proj-cli')`);
    const pMkt = await valor(D, `select criar_projeto('Instagram Comercial','Conteúdo','com-mkt')`);
    const pFin = await valor(P, `select criar_projeto('Caixa e orçamento','Interno','fin-cx')`);
    const pEst = await valor(P, `select criar_projeto('Planejamento 2027','Interno','pres-gab', true)`);
    await bloqueia('Gerência não cria projeto em outra área', D, `select criar_projeto('x','x','proj-cli')`, [], 'Você não pode criar projetos neste núcleo.');
    const dCli = await valor(V, `select criar_demanda($1,'Desenhar fluxo AS-IS','',privado.hoje() + 5,'alta',array[$2,$3]::uuid[])`, [pCli, iAna, iLucas]);
    await bloqueia('Diretor não atribui pessoa de outra área', V, `select criar_demanda($1,'x','',privado.hoje(),'media',array[$2]::uuid[])`, [pCli, iPedro], 'Há executores fora do seu escopo.');
    await valor(D, `select criar_demanda($1,'Carrossel EJ','',privado.hoje() + 3,'media',array[$2]::uuid[])`, [pMkt, iCamila]);
    await bloqueia('Gerência não cria demanda em outra área', D, `select criar_demanda($1,'x','',privado.hoje(),'media',array[$2]::uuid[])`, [pCli, iCamila], 'Você não pode criar demandas neste projeto.');
    await bloqueia('Membro não cria demanda', ANA, `select criar_demanda($1,'x','',privado.hoje(),'media',array[$2]::uuid[])`, [pCli, iAna], 'Você não pode criar demandas neste projeto.');
    await valor(P, `select criar_demanda($1,'Metas 2027','',privado.hoje() + 10,'alta',array[$2]::uuid[])`, [pEst, iPres]);
    await valor(P, `select criar_demanda($1,'Orçamento 2027','',privado.hoje() + 15,'alta',array[$2,$3]::uuid[])`, [pFin, iPres, iEmilli]);
    confere('Códigos por área', (await db.query(`select codigo from demandas order by codigo`)).rows.map(r => r.codigo), ['COM-001', 'FIN-001', 'PRE-001', 'PRJ-001']);

    const visiveis = {};
    for (const n of ['pres', 'victor', 'emilli', 'duda', 'heitor', 'ana', 'lucas', 'camila', 'pedro']) visiveis[n] = await valor(`${n}@facil.test`, `select count(*)::int from demandas`);
    confere('Demandas visíveis por perfil', visiveis, { pres: 4, victor: 2, emilli: 1, duda: 1, heitor: 0, ana: 1, lucas: 1, camila: 1, pedro: 0 });
    confere('Diretoria não vê registro restrito da Presidência', await valor(V, `select count(*)::int from demandas where projeto_id = $1`, [pEst]), 0);
    confere('Membro vê só o projeto em que atua', (await como(ANA, `select nome from projetos`)).map(r => r.nome), ['Mapeamento de processos']);

    // status e pontos
    await bloqueia('Executor não valida a própria entrega', ANA, `select mudar_status($1,'concluida')`, [dCli], 'Só a liderança do núcleo, a diretoria ou a Presidência validam a conclusão.');
    await permite('Executor move para revisão', ANA, `select mudar_status($1,'revisao')`, [dCli]);
    await permite('Diretoria valida a conclusão', V, `select mudar_status($1,'concluida')`, [dCli]);
    confere('Conclusão no prazo lança +2 por executor', await como(P, `select nome, pontos from ranking() where nome in ('Ana','Lucas') order by nome`), [{ nome: 'Ana', pontos: 12 }, { nome: 'Lucas', pontos: 12 }]);
    await permite('Diretoria reabre', V, `select mudar_status($1,'revisao')`, [dCli]);
    confere('Reabrir desconsidera os pontos', await valor(P, `select pontos from ranking() where nome = 'Ana'`), 10);
    await bloqueia('Pessoa de fora não altera a demanda', CAMILA, `select mudar_status($1,'andamento')`, [dCli], 'Você não pode alterar o status desta demanda.');
    await permite('Diretoria edita e troca executores', V, `select editar_demanda($1,'Fluxo AS-IS v2','','andamento','alta',privado.hoje() + 6,array[$2]::uuid[])`, [dCli, iAna]);
    confere('Executores após edição', await valor(P, `select count(*)::int from demanda_executores where demanda_id = $1`, [dCli]), 1);

    // pontuação
    await permite('Gente e Gestão lança evento', E, `select lancar_pontos($1,'evento',3,privado.hoje(),'Participação no EDL regional')`, [iAna]);
    await bloqueia('Diretoria fora de G&G não lança ajuste', V, `select lancar_pontos($1,'ajuste',2,privado.hoje(),'Ajuste qualquer de teste aqui')`, [iAna], 'Só a Presidência e a Gente e Gestão lançam ajustes.');
    await bloqueia('Ninguém ajusta a própria pontuação', E, `select lancar_pontos($1,'ajuste',2,privado.hoje(),'Ajuste qualquer de teste aqui')`, [iEmilli], 'Ninguém ajusta a própria pontuação.');
    await bloqueia('Valor zero é recusado', E, `select lancar_pontos($1,'ajuste',0,privado.hoje(),'Ajuste qualquer de teste aqui')`, [iAna], 'Informe um valor inteiro entre −20 e 20, diferente de zero.');
    const lancamento = await valor(P, `select id from lancamentos where tipo = 'evento' limit 1`);
    await bloqueia('Gerência comum não desconsidera', D, `select desconsiderar_lancamento($1,'motivo de teste longo')`, [lancamento], 'Você não pode desconsiderar este lançamento.');
    await permite('Gente e Gestão desconsidera com motivo', E, `select desconsiderar_lancamento($1,'Lançado em duplicidade')`, [lancamento]);
    const pontuacoes = {};
    for (const n of ['ana', 'camila', 'duda', 'victor', 'emilli']) pontuacoes[n] = await valor(`${n}@facil.test`, `select count(distinct pessoa_id)::int from lancamentos`);
    confere('Pessoas com pontuação detalhada visível', pontuacoes, { ana: 1, camila: 0, duda: 0, victor: 2, emilli: 2 });
    confere('Ranking público mostra todos os ativos', (await como(PEDRO, `select * from ranking()`)).length, 9);

    // reuniões
    const r1 = await valor(V, `select criar_reuniao('Status das entregas', privado.hoje(), '18:30', 'area', 'proj', 'Pauta')`);
    confere('Convocados da reunião de Projetos', (await db.query(`select p.nome from reuniao_convocados rc join pessoas p on p.id = rc.pessoa_id where reuniao_id = $1 order by 1`, [r1])).rows.map(r => r.nome), ['Ana', 'Lucas', 'Victor']);
    await bloqueia('Não encerra sem presença de todos', V, `select encerrar_reuniao($1)`, [r1], 'Marque a presença de todos (3 sem registro).');
    await permite('Organizador salva presença', V, `select salvar_presencas($1, $2::jsonb)`, [r1, JSON.stringify({ [iAna]: 'presente', [iLucas]: 'falta', [iVictor]: 'presente' })]);
    await permite('Organizador encerra', V, `select encerrar_reuniao($1)`, [r1]);
    confere('Falta vira −2', await valor(P, `select valor from lancamentos where pessoa_id = $1 and tipo = 'falta'`, [iLucas]), -2);
    confere('Pessoa não convocada não vê a reunião', await valor(CAMILA, `select count(*)::int from reunioes where id = $1`, [r1]), 0);
    await permite('Assessoria agenda reunião geral', HEITOR, `select criar_reuniao('Geral de novembro', privado.hoje() + 9, '19:00', 'geral', null, '')`);
    await bloqueia('Assessoria não agenda reunião de diretoria', HEITOR, `select criar_reuniao('x', privado.hoje(), '19:00', 'area', 'com', '')`, [], 'Escolha um público da lista.');
    await permite('Gerência agenda reunião do núcleo', D, `select criar_reuniao('Pauta de novembro', privado.hoje() + 2, '17:00', 'nucleo', 'com-mkt', '')`);
    await permite('Organizador salva ata', V, `select salvar_ata($1,'Clientes dentro do prazo.')`, [r1]);
    await bloqueia('Convocado comum não edita ata', ANA, `select salvar_ata($1,'tentativa')`, [r1], 'Você não pode editar esta ata.');

    // anexos (storage)
    await permite('Organizador envia arquivo', V, `insert into storage.objects(bucket_id,name) values ('anexos', $1)`, [r1 + '/apresentacao.pdf']);
    await bloqueia('Pessoa de fora não envia arquivo', CAMILA, `insert into storage.objects(bucket_id,name) values ('anexos', $1)`, [r1 + '/x.pdf'], 'new row violates row-level security policy for table "objects"');
    await permite('Organizador registra anexo', V, `select registrar_anexo($1,'apresentacao.pdf','application/pdf',1000,$2)`, [r1, r1 + '/apresentacao.pdf']);
    confere('Convocado vê anexo e arquivo', [await valor(ANA, `select count(*)::int from anexos`), await valor(ANA, `select count(*)::int from storage.objects`)], [1, 1]);
    confere('Pessoa de fora não vê o arquivo', await valor(CAMILA, `select count(*)::int from storage.objects`), 0);

    // integração de transcrições
    await bloqueia('Usuário logado não chama a integração', V, `select receber_transcricao_externa('x', now(), repeat('texto ',10))`, [], 'permission denied for function receber_transcricao_externa');
    const inicio = await valor(P, `select (privado.hoje() + time '18:40')::timestamp at time zone 'America/Sao_Paulo'`);
    await permite('Integração (service_role) envia transcrição', 'servico', `select receber_transcricao_externa('Status das entregas', $1, repeat('fala ',20))`, [inicio]);
    confere('Transcrição vinculada à reunião certa', await valor(P, `select count(*)::int from transcricoes where reuniao_id = $1 and origem = 'meet'`, [r1]), 1);
    await permite('Transcrição sem reunião correspondente fica guardada', 'servico', `select receber_transcricao_externa('Avulsa', now() - interval '3 days', repeat('fala ',20))`);
    confere('Sem vínculo: Assessoria vê, diretoria não', [await valor(HEITOR, `select count(*)::int from transcricoes where reuniao_id is null`), await valor(V, `select count(*)::int from transcricoes where reuniao_id is null`)], [1, 0]);

    // exceções de acesso
    await permite('Diretoria pede acesso para pessoa da sua área', E, `select solicitar_acesso($1,'projeto',$2,null,'Pedro vai apoiar a estimativa de custos de pessoal.',privado.hoje() + 30)`, [iPedro, pCli]);
    const pedido = await valor(P, `select id from solicitacoes limit 1`);
    await bloqueia('Pedido duplicado é recusado', E, `select solicitar_acesso($1,'projeto',$2,null,'Pedro vai apoiar a estimativa de custos de pessoal.',privado.hoje() + 30)`, [iPedro, pCli], 'Escolha um projeto da lista.');
    await bloqueia('Ninguém aprova o próprio pedido', E, `select decidir_solicitacao($1,true,'')`, [pedido], 'Você não pode decidir esta solicitação.');
    await bloqueia('Gerência de outra área não aprova', D, `select decidir_solicitacao($1,true,'')`, [pedido], 'Você não pode decidir esta solicitação.');
    confere('Diretoria dona da área vê o pedido', await valor(V, `select count(*)::int from solicitacoes`), 1);
    await permite('Diretoria dona da área aprova', V, `select decidir_solicitacao($1,true,'Só consulta')`, [pedido]);
    confere('Beneficiário passa a ver o projeto', await valor(PEDRO, `select count(*)::int from demandas where projeto_id = $1`, [pCli]), 1);
    await bloqueia('Exceção é só para consulta', PEDRO, `select mudar_status($1,'afazer')`, [dCli], 'Você não pode alterar o status desta demanda.');
    confere('Visão: exceção aparece como motivo e sem ações', await como(PEDRO, `select motivo_acesso, pode_gerir, pode_mudar_status from demandas_visiveis where id = $1`, [dCli]),
      [{ motivo_acesso: 'excecao', pode_gerir: false, pode_mudar_status: false }]);
    await permite('Pedido para demanda restrita pode ser feito', CAMILA, `select solicitar_acesso($1,'demanda',null,'PRE-001','Quero ver as metas para planejar posts.',privado.hoje() + 10)`, [iCamila]);
    const pedidoRestrito = await valor(P, `select id from solicitacoes where demanda_id is not null`);
    await bloqueia('Só a Presidência aprova item restrito', V, `select decidir_solicitacao($1,true,'')`, [pedidoRestrito], 'Você não pode decidir esta solicitação.');
    confere('Visão: diretoria vê pedido da sua equipe, mas só a Presidência aprova item restrito', [
      await valor(V, `select pode_aprovar from solicitacoes_visiveis where id = $1`, [pedidoRestrito]),
      await valor(P, `select pode_aprovar from solicitacoes_visiveis where id = $1`, [pedidoRestrito])], [false, true]);
    await permite('Quem aprovou pode revogar', V, `select revogar_acesso($1)`, [pedido]);
    confere('Revogação corta o acesso na hora', await valor(PEDRO, `select count(*)::int from demandas where projeto_id = $1`, [pCli]), 0);

    // regras de pontuação
    await bloqueia('Gerência não altera regras', D, `select salvar_config(10,2,1,-2,0,true)`, [], 'Só a Presidência e a Diretoria Administrativa alteram as regras.');
    await permite('Diretoria Administrativa altera regras', E, `select salvar_config(12,2,1,-2,0,true)`);
    confere('Pontos iniciais novos valem para todos', await valor(P, `select pontos from ranking() where nome = 'Ana'`), 12);

    // visões para a interface (03)
    confere('Perfil: diretoria que cobre vacância conduz duas áreas', await como(V, `select areas_que_conduz, pode_ajustar_pontos, pode_editar_regras from meu_perfil`),
      [{ areas_que_conduz: ['com', 'proj'], pode_ajustar_pontos: false, pode_editar_regras: false }]);
    confere('Perfil: Administrativa ajusta pontos, cadastra e edita regras', await como(E, `select pode_ajustar_pontos, pode_cadastrar_pessoas, pode_editar_regras from meu_perfil`),
      [{ pode_ajustar_pontos: true, pode_cadastrar_pessoas: true, pode_editar_regras: true }]);
    confere('Perfil: login sem cadastro não tem perfil', (await como('sem-cadastro@facil.test', `select * from meu_perfil`)).length, 0);
    confere('Visão: executor pode mudar status, não gerir', await como(ANA, `select motivo_acesso, pode_gerir, pode_mudar_status from demandas_visiveis where id = $1`, [dCli]),
      [{ motivo_acesso: 'executor', pode_gerir: false, pode_mudar_status: true }]);
    confere('Visão: diretoria gere as demandas da área', await como(V, `select motivo_acesso, pode_gerir from demandas_visiveis where id = $1`, [dCli]),
      [{ motivo_acesso: 'diretoria', pode_gerir: true }]);
    confere('Visão: demandas visíveis = demandas da RLS', await valor(V, `select count(*)::int from demandas_visiveis`), await valor(V, `select count(*)::int from demandas`));
    confere('Visão: reunião para convocado comum', await como(ANA, `select pode_gerir, convocado, total_anexos, tem_transcricao from reunioes_visiveis where id = $1`, [r1]),
      [{ pode_gerir: false, convocado: true, total_anexos: 1, tem_transcricao: true }]);
    confere('Visão: reunião invisível para quem não foi convocado', (await como(CAMILA, `select id from reunioes_visiveis where id = $1`, [r1])).length, 0);
    confere('Visitante sem login não lê o perfil', (await tenta(null, `select * from meu_perfil`)).startsWith('permission denied'), true);
    confere('Visão não aceita gravação', (await tenta(V, `update reunioes_visiveis set titulo = 'x'`)).startsWith('permission denied'), true);

    // proteção da camada de dados
    await bloqueia('Gravação direta em tabela é bloqueada', V, `insert into demandas(codigo,projeto_id,titulo,prazo,criado_por) values ('X-1',$1,'x',privado.hoje(),$2)`, [pCli, iVictor], 'permission denied for table demandas');
    await bloqueia('Alteração direta de pontos é bloqueada', E, `update lancamentos set valor = 99`, [], 'permission denied for table lancamentos');
    await bloqueia('Visitante sem login não lê pessoas', null, `select count(*) from pessoas`, [], 'permission denied for table pessoas');
    await bloqueia('Visitante sem login não vê ranking', null, `select * from ranking()`, [], 'permission denied for function ranking');
    confere('Login sem cadastro não vê ninguém', await valor('sem-cadastro@facil.test', `select count(*)::int from pessoas`), 0);
    const auditoria = {};
    for (const n of ['pres', 'camila', 'pedro']) auditoria[n] = await valor(`${n}@facil.test`, `select count(*)::int from auditoria`);
    confere('Presidência vê toda a auditoria; membros, só o seu escopo', auditoria.pres > auditoria.camila && auditoria.camila > 0 && auditoria.pedro > 0, true);
  } catch (e) {
    falhas++;
    log(`ERRO GERAL ${e.message}`);
  }
  log(`RESULTADO ${total - falhas}/${total} verificações ok${falhas ? `, ${falhas} falha(s)` : ''}`);
  log('FIM');
})();
