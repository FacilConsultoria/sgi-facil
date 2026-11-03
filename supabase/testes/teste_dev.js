// Confere o script de dados fictícios do ambiente de desenvolvimento (supabase/dev/02_dados_dev.sql):
// trava contra a produção, conta de teste com todas as permissões e dados de exemplo criados pelas funções do sistema.
// Execução: powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1 -Teste teste_dev.js
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

// partes do Supabase simuladas; auth.users com os metadados, como no Supabase de verdade
const SIMULACAO_SUPABASE = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb);
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

const EMAIL_DEV = 'pessoa+dev@facil.test';

(async () => {
  try {
    const db = new PGlite();
    await db.exec(SIMULACAO_SUPABASE);
    for (const n of ['01', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19']) await db.exec(window[`SQL${n}`]);
    const tenta = async sql => { try { await db.exec(sql); return 'permitido'; } catch (e) { return e.message; } };
    const comEmail = window.SQLDEV.replace(/(v_email_dev\s+text := )'PREENCHER'/, `$1'${EMAIL_DEV}'`);

    confere('Recusa rodar sem o e-mail preenchido', await tenta(window.SQLDEV), 'Preencha o e-mail da conta de teste no início do script antes de rodar.');
    confere('Recusa rodar antes de a conta de teste existir', await tenta(comEmail), `Crie antes a conta ${EMAIL_DEV} em Authentication → Users (com senha e "Auto Confirm User").`);
    confere('Nada ficou gravado nas tentativas recusadas', (await db.query(`select count(*)::int as n from pessoas`)).rows[0].n, 0);

    await db.query(`insert into auth.users(email, raw_user_meta_data) values ($1, '{"origem":"painel"}')`, [EMAIL_DEV]);
    confere('Roda com a conta criada', await tenta(comEmail), 'permitido');
    confere('Recusa rodar de novo (banco já tem pessoas, como a produção)', await tenta(comEmail), 'Este script é só para um banco novo de desenvolvimento: já existem pessoas cadastradas aqui.');

    const login = (await db.query(`select id from auth.users where email = $1`, [EMAIL_DEV])).rows[0].id;
    const como = async (sql, params = []) => db.transaction(async tx => {
      await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [login]);
      await tx.exec('set local role authenticated');
      return (await tx.query(sql, params)).rows;
    });

    confere('A conta de teste é a Presidente, com todas as permissões e sem pendência de dados', await como(`select nome, papel, eh_presidencia, eh_presidente, pode_ajustar_pontos, pode_cadastrar_pessoas, pode_editar_regras, dados_pendentes from meu_perfil`),
      [{ nome: 'Dev', papel: 'presidente', eh_presidencia: true, eh_presidente: true, pode_ajustar_pontos: true, pode_cadastrar_pessoas: true, pode_editar_regras: true, dados_pendentes: false }]);
    confere('Senha marcada como definida, sem apagar os outros metadados', (await db.query(`select raw_user_meta_data from auth.users where id = $1`, [login])).rows[0].raw_user_meta_data,
      { origem: 'painel', senha_definida: true });
    confere('Pessoas fictícias em cada cargo (e-mails @example.com)', (await db.query(`select papel::text, count(*)::int as n from pessoas group by papel order by papel`)).rows,
      [{ papel: 'assessor', n: 1 }, { papel: 'diretor', n: 1 }, { papel: 'gerente', n: 3 }, { papel: 'membro', n: 3 }, { papel: 'presidente', n: 1 }, { papel: 'vice', n: 1 }]);
    confere('Só a conta de teste tem e-mail fora do example.com', (await db.query(`select count(*)::int as n from pessoas where email not like '%@example.com'`)).rows[0].n, 1);
    confere('A Presidente vê os projetos e as demandas de exemplo', [
      (await como(`select count(*)::int as n from projetos`))[0].n,
      (await como(`select titulo, status::text from demandas order by codigo`)),
    ], [2, [
      { titulo: 'Carrossel de apresentação', status: 'afazer' },
      { titulo: 'Levantar requisitos (atrasada)', status: 'afazer' },
      { titulo: 'Desenhar fluxo do processo', status: 'revisao' },
    ]]);
    confere('Há uma demanda atrasada e uma em revisão para validar', [
      (await db.query(`select count(*)::int as n from demandas where prazo < privado.hoje() and status <> 'concluida'`)).rows[0].n,
      (await como(`select count(*)::int as n from demandas_visiveis where status = 'revisao' and pode_gerir`))[0].n,
    ], [1, 1]);
    confere('Reunião, lançamento e recado de exemplo', [
      (await como(`select titulo from reunioes_visiveis`)).map(r => r.titulo),
      (await db.query(`select tipo::text, valor from lancamentos where tipo = 'evento'`)).rows,
      (await como(`select titulo, situacao from recados_painel`)),
    ], [['Reunião geral de exemplo'], [{ tipo: 'evento', valor: 3 }], [{ titulo: 'Ambiente de desenvolvimento', situacao: 'publicado' }]]);
    confere('O recado avisou as outras nove pessoas', (await db.query(`select count(*)::int as n from notificacoes where tipo = 'recado'`)).rows[0].n, 9);
    confere('A Presidente pode publicar para toda a equipe sem autorização', (await como(`select precisa_autorizacao from destinos_de_recado where escopo = 'todos'`)), [{ precisa_autorizacao: false }]);
    confere('As ações ficaram na auditoria em nome da conta de teste', (await db.query(`select count(*)::int as n from auditoria a join pessoas p on p.id = a.ator where p.nome = 'Dev'`)).rows[0].n > 5, true);
    confere('Depois do script ninguém fica "logado" na sessão do banco', (await db.query(`select coalesce(current_setting('request.jwt.claim.sub', true), '') as sub`)).rows[0].sub, '');
  } catch (e) {
    falhas++;
    log(`ERRO GERAL ${e.message}`);
  }
  log(`RESULTADO ${total - falhas}/${total} verificações ok${falhas ? `, ${falhas} falha(s)` : ''}`);
  log('FIM');
})();
