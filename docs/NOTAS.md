# SGI Fácil Consultoria — notas do projeto

Arquivo de continuidade. Uma sessão nova (em qualquer dispositivo) deve ler este arquivo e o código do artefato antes de mexer em qualquer coisa.

- **Artefato (código + estas notas):** https://claude.ai/artifact/HHq2XfDEoMViynv5ns9QZs
- **Código:** a própria página publicada (um único HTML, sem build). Para editar: `Artifact read` na URL acima, editar o arquivo salvo e publicar de volta na mesma URL.
- **Estas notas:** arquivo `projeto/NOTAS.md` publicado junto ao artefato. Atualizar sempre que uma decisão mudar.
- **Banco (Supabase):** arquivos em `projeto/supabase/` publicados junto ao artefato: `01_estrutura_e_regras.sql`, `02_dados_iniciais.sql`, `functions/receber-transcricao/index.ts` e `LEIA-ME.md` (passo a passo de instalação).
- **Regras de desenvolvimento:** `projeto/DIRETRIZES.md` (diretrizes arquiteturais da Fácil) vale para todo código novo. Destaques: nada de arquivo monolítico (§3.1), nenhuma dependência nova sem autorização explícita (§15.3), alteração cirúrgica (§15.2), testes com evidência (§9) e decisões grandes registradas em ADR (§13). O protótipo `sgi-facil.html` é um arquivo único só porque é protótipo; não deve virar a base da versão online.
- **Testes do banco:** `projeto/supabase/testes/` (`rodar_testes.ps1` + `teste_regras.js`). Comando: `powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1`. Última execução: 72/72 ok (29/10/2026).
- **Última atualização:** 29/10/2026.

## Objetivo

Aplicação web interna da Fácil Consultoria (empresa júnior) para organizar demandas e entregas das equipes, substituindo planilhas e mensagens. Matriz hierárquica de permissões aplicada na camada de dados. Protótipo inspirado no "Sistema de Pontos" da Inova Jr. (layout com menu lateral, pontuação, reuniões, atas).

## Identidade visual

- Paleta oficial: branco + azul **#1479E1**. Azul-escuro **#0B3B73** para textos menores (sugestão da Fácil).
- Texto branco pequeno sobre #1479E1 fica abaixo do contraste AA; por isso #1479E1 vai em botões, números grandes e barras, e o texto pequeno em #0B3B73.
- Tela de login: fundo #0B3B73, cartão #0B1F3A; símbolo, favicon e botão em **#1478C0**, o tom das faces do logotipo (medido em "Logo - Fácil Consultoria (Azul e Cinza).png"; branco sobre ele = 4,7:1, passa AA). Assinatura (símbolo + nome) com a mesma largura do cartão (400px; 100% no celular), dimensionada em cqi.
- Logo: símbolo redesenhado em SVG no menu lateral (círculo + quatro paralelogramos). Fonte Poppins.
- Tema claro e escuro.

## Estrutura real (confirmada pelo usuário em 29/10/2026; substitui a tabela do documento abaixo)

| Pessoa | Papel no banco | Área / núcleo |
|---|---|---|
| Mel | `presidente` | Presidência (titular). Cobre a Diretoria Administrativa, vaga. Única que aprova pedidos de itens restritos e revoga qualquer acesso. |
| Luis | `vice` | Vice-Presidência, acesso irrestrito (Presex). Titular da Diretoria Financeira. |
| João | `diretor` | Diretoria Comercial (titular); cobre a Diretoria de Projetos, vaga. |
| Victor | `gerente` | Entregas aos clientes (`proj-cli`, área Projetos). |
| Emilli | `gerente` | Captação e clientes (`com-cap`, área Comercial). |
| Duda | `gerente` | Marketing (`com-mkt`). |
| Maju | `assessor` | Assessoria de Presidência (`pres-ass`). |

Gente e Gestão e Diretoria Administrativa vagas: ajustes de pontos e regras ficam com a Presex (Mel e Luis).

**Supabase em produção (29/10/2026):** projeto `sgi-facil-br`, organização `sgi-facil`, região São Paulo (sa-east-1), URL `https://prjhsfipxtvnuxshzkjv.supabase.co`. Scripts 01, 03 e 02 (com os e-mails reais) rodados pelo SQL Editor; conferência: 7 pessoas, 5 áreas, 8 núcleos, 14 políticas RLS, 3 políticas de arquivos, bucket `anexos`, 4 visões, 23 funções públicas. "Automatically expose new tables" desligado na criação. Chave pública: Settings → API Keys → Legacy → `anon public` (vai para a Vercel). Senha do banco: guardada pelo usuário, nunca pedir. O projeto antigo `sgi-facil` (us-east-1, vazio) pode ser apagado pelo usuário.

**Site no ar (30/10/2026):** https://sgi-facil.vercel.app (Vercel, conta da Fácil `facilconsultoria-4157`, plano Hobby, projeto `sgi-facil`, Vite). Publica sozinho a cada commit em `main`. Variáveis na Vercel: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (colada pelo usuário). Supabase Auth: Site URL `https://sgi-facil.vercel.app` e Redirect URL `https://sgi-facil.vercel.app/**`. GitHub App da Vercel instalado só no repositório `sgi-facil`. CI: verificações #6 e #7 verdes (a #4 falhou por ordem de commits e foi corrigida na #5). E-mails reais ficam só no banco do Supabase, nunca no repositório nem no artefato (público por link).

## Estrutura Fácil 27 (fonte: "Funções e Responsabilidades — Fácil 27"; histórico)

| Área | Titular | Observação |
|---|---|---|
| Presidência | nome ainda não informado (usar "Presidente") | Sem Vice-Presidência em 2027. Cobre a vacância da Diretoria Financeira. Coordena Comercial e Administrativa, lidera ENEJ/EDL, conduz o PS com Gente e Gestão. |
| Assessoria de Presidência | vaga (PS em andamento) | Agenda, atas, comunicação institucional. |
| Diretoria Comercial | Victor | Prospecção, clientes, Instagram Comercial (2–3 posts/semana), portfólio e preços. Cobre a vacância da Diretoria de Projetos. |
| Gerência de Marketing | Duda | Reporta à Comercial. Lidera o Time de Marketing (vaga, depende do PS). |
| Diretoria Administrativa | Emilli | Processos internos, documentação, conformidade MEJ, lidera Gente e Gestão. Apoia o financeiro sem ser responsável principal. Escopo ainda em aberto. |
| Gente e Gestão | liderança vaga | PS, integração, desempenho, capacitações. |
| Diretoria de Projetos | vaga → Victor | Entregas aos clientes, cronograma, qualidade. |
| Diretoria Financeira | vaga → Presidência | Caixa, gastos, prestação de contas, orçamento. |

Pendências do documento (⚠): quem cobre a Presidência na ausência do titular; se há Conselho/Assembleia acima da Presidência; escopo completo da Administrativa; funções exatas da Assessoria e de Gente e Gestão.

Pessoas fictícias marcadas `exemplo:true` preenchem vagas e times em PS, só para testar permissões.

## Regras de acesso (camada `Dados` no código)

- **Presidência:** tudo, inclusive registros restritos.
- **Diretoria:** tudo das diretorias que conduz, inclusive as cobertas por vacância (`diretorias: [...]` no usuário). Não vê restritos da Presidência.
- **Gerência / Assessoria:** demandas e membros do próprio núcleo.
- **Membro:** só as demandas em que é executor.
- **Executor sempre vê a demanda**, mesmo fora do núcleo ou em registro restrito.
- **Exceção de acesso:** pedido formal com justificativa (≥ 20 caracteres), escopo pontual (projeto ou demanda por código), validade até 90 dias, aprovação da Presidência ou da diretoria que conduz a área (restritos: só Presidência), ninguém aprova o próprio pedido, somente consulta, revogável, auditado.
- **Pontuação detalhada:** Presidência e Gente e Gestão (Diretoria Administrativa + liderança de G&G) veem todos; diretoria vê as suas; núcleo vê o seu; membro vê a própria.
- **Ajuste de pontos e desconsiderar lançamentos:** Presidência e Gente e Gestão, com justificativa; ninguém ajusta a própria.
- **Alterar regras de pontuação:** Presidência e Diretoria Administrativa.
- **Reuniões:** convocados veem; quem organiza ou lidera o escopo gerencia presença, ata, transcrição e anexos. Assessoria gerencia reuniões gerais e da Presidência.
- Abas Presenças, Acessos e Histórico ficam visíveis para todos, mas cada um vê só o seu escopo (decisão confirmada pelo usuário).

## Pontuação (valores editáveis na tela Regras)

Pontos iniciais 10 · entrega no prazo +2 · entrega com atraso +1 · falta em reunião −2 · falta justificada 0 · ranking visível para todos (opção).
Executor leva a demanda até "Em revisão"; a liderança valida "Concluída" e os pontos são lançados. Reabrir desconsidera os pontos.

## Módulos do protótipo

Dashboard · Demandas (quadro por etapa) · Projetos · Reuniões e atas (pauta, presença, ata, transcrição, anexos até 1 MB no protótipo) · Presenças · Pontuações (grade de membros + linha do tempo + ajuste manual, padrão do modelo Inova) · Ranking · Estrutura e equipe (organograma) · Acessos · Histórico completo · Regras.

## Recursos vistos no modelo Inova e ainda não feitos

Teto de pontos no dashboard (o modelo mostra "15/15" e "pontos no ranking" acima do teto) · presença por QR Code · central de atas com exportação PDF/Word · inscrição em projetos com pontos mínimos e aprovação · filtros na auditoria · cadastro de usuários com importação CSV.

## Integração com Google Meet (planejada)

A Fácil usa conta Google gratuita, sem transcrição nativa do Meet.
- **Fase 1 (agora):** extensão Tactiq (lê as legendas do Meet, sem bot; plano grátis em torno de 10 transcrições/mês por conta, conferir) e colar o texto na reunião do SGI.
- **Fase 2 (automática, após versão online):** (A) tl;dv Pro em uma conta organizadora, com MCP/API/webhooks; ou (B) extensão própria do SGI que lê as legendas e envia ao sistema. O modelo de dados já guarda a origem (`manual` ou `meet`) de transcrições e anexos.
- Avisar os participantes que a reunião é transcrita (LGPD).

## Versão online

Decisão: Supabase (Postgres + login + storage + Row-Level Security) e site estático na Vercel ou Netlify, plano gratuito.

**Feito (29/10/2026):** esquema completo em `projeto/supabase/`.
- Leitura por RLS; escrita só por funções RPC que checam permissão e gravam auditoria (insert/update/delete direto bloqueados).
- Regras auxiliares no schema `privado`, todas parametrizadas pela pessoa (`privado.pode_ver_demanda(p, demanda)` etc.).
- Login: Supabase Auth (link mágico por e-mail para começar; Google depois). Gatilho em `auth.users` vincula o login à linha de `pessoas` pelo e-mail. Sem cadastro ativo, o banco não mostra nada.
- Diretório de pessoas visível a todos com cadastro (reuniões gerais já listam todos); o sensível segue a matriz.
- Bucket privado `anexos`, pasta = id da reunião, políticas por permissão da reunião.
- Integração: `receber_transcricao_externa` (só `service_role`), chamada pela Edge Function `receber-transcricao` com cabeçalho `x-sgi-chave`. Vincula à reunião do mesmo dia com horário mais próximo (até 2 h); sem correspondência fica sem vínculo para Presidência/Assessoria vincular (`vincular_transcricao`).
- Testado em PGlite (Postgres real no navegador) com stubs de auth/storage/papéis: mais de 50 verificações por perfil, todas passaram. Diferenças possíveis no Supabase real, sobretudo no storage.

**Arquitetura do site: ver `projeto/adr/0001-arquitetura-versao-online.md`.** Resumo das decisões do usuário (29/10/2026): GitHub (repositório privado), Vite + TypeScript sem framework, dependências autorizadas `@supabase/supabase-js` (produção) e `vite`, `typescript`, `vitest`, `eslint` (desenvolvimento), build e testes só no GitHub Actions (computador sem Node.js nem Git), hospedagem na Vercel. Permissões de interface vêm de visões do banco com indicadores (`pode_gerir` etc.), nunca recalculadas no TypeScript.

**Repositório (29/10/2026):** https://github.com/FacilConsultoria/sgi-facil (privado, dono: conta @FacilConsultoria; colaborador convidado: @joaojorte). Enviado pelo navegador (Claude in Chrome, upload por pasta), sem Git nesta máquina. Primeira verificação do GitHub Actions: verde (tipos ok, 18/18 testes, build ok). Pendência pequena: atualizar `actions/checkout` e `actions/setup-node` no `ci.yml` (v4 usa Node 20, descontinuado). O repositório inclui `docs/` (estas notas, diretrizes, ADR), `supabase/` (01, 02, 03, função, testes) e `prototipo/`. O artefato continua espelhando protótipo e documentos.
- Esqueleto entregue: Vite + TypeScript, login por link mágico, layout com menu lateral, Dashboard, demais módulos "em breve". Verificação local: tipos ok (TypeScript 5.6.3 no Edge, dependências com declarações simplificadas) e 18/18 testes unitários; banco 84/84.
- Migração 03 (`03_visoes_interface.sql`): `meu_perfil`, `demandas_visiveis` (`pode_gerir`, `pode_mudar_status`, `motivo_acesso`), `reunioes_visiveis`, `solicitacoes_visiveis` (`situacao`, `pode_aprovar`, `pode_revogar`), todas `security_invoker`.
- Pendente de autorização: `typescript-eslint` e `@eslint/js` (para o ESLint entender TypeScript) e `@electric-sql/pglite` (testes do banco no CI).

**Próximos passos:**
1. Usuário cria o projeto no Supabase e roda os scripts 01, 02 e 03 (ver `supabase/LEIA-ME.md`), preenchendo e-mails e nome da Presidência no `02`; envia Project URL e anon key (públicas). Nunca pedir service_role nem senha do banco.
2. Usuário cria o repositório privado `sgi-facil` no GitHub, envia os arquivos e confere a aba Actions (verificação verde).
3. Conectar a Vercel ao repositório com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; no Supabase Auth, Site URL e Redirect URLs com o endereço da Vercel.
4. Migrar os módulos na ordem do ADR, começando por Demandas.
5. Integração Meet: testar Tactiq x Fathom em reuniões reais; depois Apps Script (Drive → Edge Function). A ata é gerada como rascunho no SGI a partir da transcrição.
6. Pendente de autorização: `@electric-sql/pglite` (desenvolvimento) para rodar os testes do banco também no CI.

## Notas técnicas

- Um único HTML com CSS e JS embutidos; dados de exemplo gerados por `semente()`; persistência em `localStorage` (chave `sgi-facil-prototipo-v4`; trocar a chave ao mudar o formato dos dados).
- Toda leitura/escrita passa pelo objeto `Dados` (permissões checadas na escrita, não só na interface).
- Testes feitos rodando a página no Edge em modo headless (o computador original não tem Node nem Python).
