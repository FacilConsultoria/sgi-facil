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
- **Módulo Demandas (30/10/2026):** primeiro módulo migrado. Login testado pelo usuário com o João antes disso.
  - Banco: migração `04_modulo_demandas.sql` com as visões `projetos_visiveis` (`pode_criar_demanda`), `nucleos_visiveis` (`pode_criar_projeto`), `pessoas_atribuiveis` (mesma regra de `privado.pode_atribuir`) e `demandas_visiveis` refeita (colunas novas no fim: `nucleo_nome`, `excecao_ate`; `pode_mudar_status` falso para executor em demanda concluída). Regra nova em `privado.aplicar_status`: só quem gere reabre demanda concluída (antes o executor podia reabrir e anular os próprios pontos). Banco 104/104.
  - Site: `src/features/demandas/` (regras puras + testes, dados, componentes, painel, formulários, página), `src/ui/camada.ts` (painel/modal com foco, Esc e véu), `src/styles/componentes.css` e `demandas.css`. Quadro por etapa com busca, filtros e resumo; painel com motivo do acesso, edição completa (quem gere), só status (executor) ou consulta; histórico pela `auditoria`; "Nova demanda" e "Novo projeto" só aparecem se as visões permitirem. Tipos ok e 34/34 testes no Edge; visual conferido com dados fictícios em 1366 e 500 px, claro e escuro.
  - Verificação local reaproveitável: `%TEMP%\sgi-ts\verificar.ps1 -Projeto <pasta>` (tipos + testes) e `visual.ps1` (telas com Supabase simulado). Pasta temporária: pode sumir.

- **Login com senha (30/10/2026):** decisão do usuário: só o primeiro acesso usa link por e-mail; depois a pessoa cria a senha e passa a entrar com e-mail + senha. Telas: login em duas etapas (`features/auth/pagina.ts`), criar senha (`definir-senha.ts`), `main.ts` decide a tela (evento `PASSWORD_RECOVERY` = "esqueci a senha"; marca `user_metadata.senha_definida` = senha já criada; sem a marca ou em recuperação o sistema não abre antes de salvar a senha). Regras puras em `auth/regras.ts` (mínimo 10, letras e números, máximo 72). Verificado: tipos ok, 43/43 testes e uma simulação do `main.ts` real no Edge com Supabase simulado (23 conferências: etapas, erros, primeiro acesso, recuperação, renovação de token, sair). Falta confirmar com o Supabase real. Sem tela de "alterar senha" logado (usa "Esqueci minha senha"). Quem já estava logado pelo link antigo é levado a criar a senha na próxima abertura.
- **E-mail (feito, 30/10/2026):** a Fácil não tem domínio, então o Resend só entregaria ao e-mail dono da conta. Escolha do usuário: entregar direto a cada membro; solução: SMTP do Gmail institucional da Fácil no Supabase (smtp.gmail.com, porta 465, remetente "SGI Fácil Consultoria", senha de app criada e colada pelo usuário). Testado pela Maju: o link chegou. Se um dia houver domínio, dá para trocar para o Resend só mudando a configuração do Supabase. Os envios ficam na pasta "Enviados" do Gmail institucional; respostas caem nela.
- **Ajustes no Supabase (30/10/2026, feitos pelo Claude no painel):** senha mínima de 10 caracteres com letras e números (Sign In / Providers → Email); textos dos e-mails "Confirm sign up", "Magic link" e "Reset password" em português com botão na cor #1478C0. "Allow new users to sign up" continua ligado (o primeiro acesso cria o login); quem não tem cadastro em `pessoas` entra mas não vê nada.
- **Módulo Reuniões e atas (30/10/2026):** segundo módulo migrado.
  - Banco: migração `05_modulo_reunioes.sql`: `reunioes_visiveis` ganhou `total_convocados`, `total_faltas` e `pode_encerrar`; nova visão `escopos_de_reuniao` (públicos possíveis, nome, `pode_criar`, quantos seriam convocados; a área da Presidência fica de fora por já existir o público "Presidência"). Banco 113/113. Rodar a 05 no Supabase antes de publicar o site.
  - Site: `src/features/reunioes/` (regras puras + testes, dados, contexto, seções que se atualizam sozinhas: presença, ata, transcrição, anexos, histórico; painel, formulários de agendar e de ligar transcrição, página). Anexos: arquivos no bucket privado `anexos`, pasta = id da reunião, nome limpo, endereço temporário de 60 s para abrir; se o registro falha o arquivo enviado é removido. Encerrar em dois passos (salva a presença e encerra). Transcrições recebidas sem reunião (só Presidência e Assessoria veem) podem ser ligadas a uma reunião.
  - Refatoração de apoio: auxiliares compartilhados saíram de Demandas para `src/lib/datas.ts`, `src/lib/texto.ts` e `src/ui/formulario.ts`.
  - Verificado: tipos ok, 64/64 testes e simulação da tela inteira no Edge com Supabase simulado (44 conferências). Não há "editar/cancelar reunião" (o banco não tem essas funções ainda).

- **Assessoria, avais, público por pessoas e exclusão (30/10/2026, decisões do usuário):**
  - **Assessoria de Presidência** (papel `assessor` na área da Presidência) passa a ter o mesmo acesso da Presidência (`privado.eh_presidencia` agora inclui ela: vê e gere tudo, inclusive restritos, cadastra pessoas, altera regras, agenda qualquer reunião). **Só duas coisas dependem de aval:** ajustar a própria pontuação e aprovar acessos por exceção.
  - **Aval** = pedido que a Presidente ou a Vice aprovam ou negam no sistema (`public.avais`, funções `solicitar_aval` e `decidir_aval`, visão `avais_visiveis`). Ao aprovar, o banco executa a ação com as regras de quem aprovou (a Vice, por exemplo, ainda não aprova item restrito). Quem pediu não decide o próprio aval. Tipos: `ajuste_proprio`, `decidir_solicitacao`, `justificar_falta`.
  - **Falta de diretoria**: só vira "justificada" na lista de presença com aval (regra em `salvar_presencas`); a Presidente e a Vice marcam direto. Reunião com aval pendente não encerra. Interpretei que a Assessoria também precisa do aval nesse caso (conservador; fácil de relaxar).
  - **Público das reuniões**: novo público "pessoas escolhidas" (enum `pessoas`, migração 06 separada por limitação do Postgres). Presidência/Vice/Assessoria e diretores escolhem qualquer pessoa; gerentes, só do núcleo. **Diretorias também agendam para "todos"** (público geral). O formulário começa sem público escolhido para ninguém convocar todos sem querer.
  - **Excluir reunião** (`excluir_reuniao`): aberta, quem organiza; encerrada, só Presidência (incluindo Assessoria) ou diretoria que organiza, com motivo (≥10 caracteres): as faltas lançadas são desconsideradas, ficam sem reunião e os arquivos são apagados. Os arquivos órfãos podem ser lidos e apagados por quem tem cadastro (`privado.arquivo_orfao`), senão o site não conseguiria limpá-los.
  - Site: público por pessoas no agendamento, "Pedir aval para justificar" na presença, "Excluir reunião" no painel, nova página **Avais** (pedidos pendentes e decididos; quem pode decidir vê Aprovar/Negar).
  - **Pendente:** os botões para a Assessoria pedir aval de ajuste da própria pontuação e de aprovação de acesso por exceção chegam junto com os módulos Pontuações e Acessos (o banco e a página Avais já tratam esses dois tipos).
  - Banco 179/179; site: tipos ok, 74/74 testes e simulação das telas no Edge.

- **Autorizações (30/10/2026):** pedido do usuário: "Dashboard" virou **Tela Inicial**; o aviso do Google Meet saiu de Reuniões e atas; as abas **Avais** e **Acessos** viraram uma só, **Autorizações**, com duas abas (Acessos e Avais). Endereços antigos `#acessos` e `#avais` levam a ela.
  - **Acessos por exceção** (módulo novo no site; o banco já existia): pedir acesso (para quem pode pedir, a projeto ou demanda, validade de até 90 dias), decidir (aprovar/negar), revogar. Migração `08_modulo_acessos.sql`: `privado.pode_pedir_acesso_para` (a regra de quem pede para quem, agora única, usada também por `solicitar_acesso`), visão `beneficiarios_de_acesso`, função `projetos_solicitaveis(pessoa)` (não restritos, fora do escopo, sem pedido ou acesso vigente), `solicitacoes_visiveis` com `alvo_nome` e `pode_pedir_aval`. Banco 192/192.
  - **Assessoria** vê Aprovar/Negar substituídos por **"Pedir aval para aprovar/negar"** (aval do tipo `decidir_solicitacao`). Revogar continua só da Presidente (ou de quem aprovou); a Assessoria não revoga (decisão conservadora, fácil de mudar).
  - Site: tipos ok, 84/84 testes, simulação das telas no Edge. Ainda falta o botão da Assessoria para pedir aval de ajuste da própria pontuação (chega com Pontuações).

- **Pontuação e ranking (30/10/2026):** próximo módulo da ordem do ADR. Decisão minha, por analogia com Autorizações: **Pontuações** e **Ranking** do protótipo viraram **uma tela só, "Pontuação e ranking"**, com duas abas (endereços antigos `#pontuacoes` e `#ranking` levam a ela). Fácil de separar de novo.
  - **Pontuações:** grade de pessoas (as que a regra `pode_ver_pontuacao` deixa ver, em ordem alfabética, com busca a partir de 9 pessoas) e, ao escolher uma, o detalhe: saldo, posição no ranking, cargo, curso, entregas, faltas (+ justificadas), projetos ativos (só o nome dos que quem consulta pode ver; os outros viram "Projeto de outra área") e a linha do tempo de lançamentos com filtro por tipo e "mostrar desconsiderados". Demanda de outra área aparece como "demanda de outra área" (a RLS esconde o nome).
  - **Ajuste manual:** quem pode (Presidência e Gente e Gestão, nunca na própria pontuação; a Assessoria entra por ter acesso de Presidência) lança ajuste ou evento (−20 a 20, data até hoje, justificativa ≥ 15 caracteres) e desconsidera lançamentos (motivo ≥ 10). **Assessoria na própria pontuação:** o formulário vira "Pedir aval à Presidência" (aval `ajuste_proprio`; o texto do pedido vira a descrição do lançamento quando a Presidente ou a Vice aprovam). Isso fecha o item pendente da seção anterior.
  - **Ranking:** tabela com posição, setor, entregas, faltas e pontos; "você" destacado; quem aparece segue `ranking()` (e a opção `ranking_publico`).
  - Banco: migração `09_modulo_pontuacao.sql` (visões `pontuacao_pessoas` e `lancamentos_visiveis`, função `privado.projetos_ativos_de`). As regras de lançar, desconsiderar e do ranking não mudaram. Contagem: "faltas" = lançamentos de falta que tiram pontos (como no ranking); "justificadas" = lançamentos de falta sem perda de pontos.
  - Código novo reutilizável: `ui/abas.ts` (página com abas; Autorizações passou a usá-la) e `ui/recarregavel.ts` (carregar, "Tentar de novo" e redesenhar).
  - Banco 204/204; site: tipos ok, 106/106 testes e simulação das telas no Edge (Presidente, Assessoria e membro).

- **Presenças (30/10/2026):** relatório de frequência, somente leitura (marcar presença continua dentro de Reuniões e atas). Tabela com convocações, presenças, justificadas, faltas e taxa (presenças ÷ convocações, arredondada; "–" sem convocação), das menores taxas para as maiores. Só entram reuniões **encerradas**.
  - **Quem aparece:** a mesma regra da pontuação detalhada (`pode_ver_pontuacao`: a própria pessoa, Presidência com Assessoria, Gente e Gestão, diretoria da área, gerência do núcleo). Decisão minha, por coerência: a falta já aparece na pontuação. A função só devolve números, sem título de reunião.
  - Banco: migração `10_modulo_presencas.sql` (função `public.frequencia()`, security definer porque a regra de cada reunião esconderia as reuniões de outros núcleos). Banco 212/212.
  - **Método de teste (pedido do usuário):** a partir daqui testo só o que a entrega tocou: testes do banco (rápidos, completos), tipos e testes do site, simulação da tela nova e leitura das telas afetadas no site real. O que depende de uso real fica com o usuário, e escrita no banco real só com autorização.
  - Site: tipos ok, 113/113 testes e simulação da tela (diretor, membro e lista vazia).

- **Estrutura e equipe (30/10/2026):** duas abas. **Organograma** (para todos): Presidência no topo (titular e núcleos, como a Assessoria), diretorias por nome, cada núcleo com liderança e membros, "Vaga · coberta por Fulano" quando a área não tem titular. **Cadastro** (só para quem cadastra: Presidência com Assessoria, Gente e Gestão): lista com e-mail, cargo, curso e situação, busca, "mostrar desativadas", **cadastrar** e **alterar** pessoa. A Presidência também **define titular e cobertura** de cada área (botão no organograma).
  - **Decisão que difere do protótipo:** o protótipo mostrava os membros "conforme o escopo". O banco já tinha decidido (01) que o diretório de pessoas (nome, cargo, área) é aberto a quem tem cadastro, porque as reuniões gerais já listam todo mundo; o organograma segue isso e mostra todos. Fácil de restringir se preferirem.
  - **Brecha fechada (migração `11_modulo_equipe.sql`):** como a Assessoria de Presidência tem acesso de Presidência, a Gente e Gestão podia cadastrar uma "assessora" na área da Presidência e dar a ela esse acesso. Agora cadastrar ou mover alguém para a Presidência, ou para Presidente, Vice e diretoria, exige a Presidência.
  - **Regras novas no banco:** ninguém altera o próprio cadastro; núcleo obrigatório para gerência, assessoria e membro; Presidente e Vice só na Presidência; e-mail válido; quem conduz uma área (titular ou cobertura) não é desativado nem muda de cargo antes de a área ter outro responsável; titular e cobertura são Presidente, Vice ou diretoria ativa e diferentes entre si.
  - **Atenção (não alterado):** qualquer pessoa logada consegue ler a tabela `pessoas` pela API, inclusive a coluna `email` (o 01 abriu o diretório). A tela só mostra o e-mail a quem cadastra, mas a proteção real exigiria restringir a coluna, o que mexe em `meu_perfil` e em outras visões. Proposta para uma próxima rodada.
  - Banco 245/245; site: tipos ok, 128/128 testes e simulação da tela (Presidente e membro).

- **Histórico completo (30/10/2026):** lista somente leitura de tudo o que foi registrado (criação, edição, pontos, reuniões, decisões de acesso, cadastros), do mais recente para o mais antigo, com hora, quem fez, ação e detalhe. **Busca no banco** (em tudo o que a pessoa vê, não só no que já carregou) por ação, detalhe ou nome de quem fez, e **"Carregar mais"** de 100 em 100.
  - **Quem vê o quê não mudou:** a regra de leitura da auditoria (01) já decide (Presidência com Assessoria vê tudo; os demais veem o que fizeram, o que os envolve e o escopo deles). A migração `12_modulo_historico.sql` só cria a visão `historico_visivel` (com `ator_nome`). Os testes conferem que a visão mostra exatamente os mesmos registros da regra para 10 perfis. Banco 250/250.
  - Registros sem pessoa (integração automática) aparecem como "Integração automática".
  - Site: tipos ok, 135/135 testes e simulação da tela (paginação de 230 registros, busca, erro).

**Próximos passos:**
1. Usuário cria o projeto no Supabase e roda os scripts 01, 02 e 03 (ver `supabase/LEIA-ME.md`), preenchendo e-mails e nome da Presidência no `02`; envia Project URL e anon key (públicas). Nunca pedir service_role nem senha do banco.
2. Usuário cria o repositório privado `sgi-facil` no GitHub, envia os arquivos e confere a aba Actions (verificação verde).
3. Conectar a Vercel ao repositório com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`; no Supabase Auth, Site URL e Redirect URLs com o endereço da Vercel.
4. Migrar os módulos na ordem do ADR: Demandas e Reuniões e atas feitos; Autorizações (Acessos + Avais) , Pontuação e ranking , Presenças e Estrutura e equipe também feitos e Histórico completo também feitos; próximo: Regras (depois Projetos).
5. Integração Meet: testar Tactiq x Fathom em reuniões reais; depois Apps Script (Drive → Edge Function). A ata é gerada como rascunho no SGI a partir da transcrição.
6. Pendente de autorização: `@electric-sql/pglite` (desenvolvimento) para rodar os testes do banco também no CI.

## Notas técnicas

- Um único HTML com CSS e JS embutidos; dados de exemplo gerados por `semente()`; persistência em `localStorage` (chave `sgi-facil-prototipo-v4`; trocar a chave ao mudar o formato dos dados).
- Toda leitura/escrita passa pelo objeto `Dados` (permissões checadas na escrita, não só na interface).
- Testes feitos rodando a página no Edge em modo headless (o computador original não tem Node nem Python).
