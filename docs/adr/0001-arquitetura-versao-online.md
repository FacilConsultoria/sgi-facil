# ADR 0001 · Arquitetura da versão online do SGI

- **Status:** Aceita
- **Data:** 29/10/2026
- **Decisores:** equipe da Fácil Consultoria (decisões de repositório, stack, dependências e CI tomadas pelo usuário em 29/10/2026)

## Contexto

O SGI existe hoje como protótipo navegável em um único arquivo HTML (`sgi-facil.html`), com dados de exemplo no `localStorage`. Ele serviu para validar telas, permissões e fluxos, mas viola o §3.1 das diretrizes (arquivo monolítico que mistura apresentação, regras, dados e estado) e não persiste nada entre pessoas.

O banco da versão online já está pronto e testado (`supabase/`): tabelas, regras de acesso por RLS, escrita só por funções RPC com auditoria, 72 verificações passando.

Falta a aplicação web que as pessoas vão usar.

## Decisão

1. **Repositório:** GitHub, repositório privado da Fácil. Fonte única do código, com histórico de mudanças.
2. **Stack do site:** Vite + TypeScript, sem framework de interface. Renderização com DOM e módulos TypeScript pequenos, por funcionalidade.
3. **Dependências autorizadas (§15.3):**
   - Produção: `@supabase/supabase-js`.
   - Desenvolvimento: `vite`, `typescript`, `vitest`, `eslint`.
   - Qualquer outra exige nova autorização explícita.
4. **Build e testes:** só na nuvem, por GitHub Actions (este computador não tem Node.js). Cada envio ao GitHub roda linter, checagem de tipos, testes e build.
5. **Hospedagem:** Vercel, publicando a partir do GitHub.
6. **Fonte de verdade das permissões:** o banco. O site nunca decide sozinho quem pode o quê; ele só esconde botões com base em indicadores calculados no banco (ver "Permissões na interface").

## Estrutura de pastas

```
sgi-facil/
├─ index.html
├─ package.json · tsconfig.json · vite.config.ts · eslint.config.js
├─ .env.example                  # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (públicas)
├─ .github/workflows/ci.yml      # lint → tipos → testes → build
├─ docs/
│  ├─ NOTAS.md · DIRETRIZES.md
│  └─ adr/0001-arquitetura-versao-online.md
├─ prototipo/sgi-facil.html      # referência visual até a migração terminar
├─ supabase/
│  ├─ 01_estrutura_e_regras.sql  # tabelas, RLS e operações (dividir por domínio quando crescer)
│  ├─ 02_dados_iniciais.sql      # estrutura Fácil 27
│  ├─ 03_visoes_interface.sql    # visões com indicadores de permissão para o site
│  ├─ functions/receber-transcricao/index.ts
│  └─ testes/                    # testes de regras do banco (PGlite no Edge)
└─ src/
   ├─ main.ts                    # ponto de entrada: sessão, layout, roteador
   ├─ app/                       # menu lateral, roteamento por hash, sessão do usuário
   ├─ lib/                       # cliente Supabase único, tradução de erros, datas
   ├─ ui/                        # componentes reutilizáveis: chip, painel, modal, aviso, tabela
   ├─ styles/                    # tokens.css (paleta oficial), base.css
   ├─ types/                     # tipos das tabelas e das respostas RPC
   └─ features/                  # um módulo por domínio
      ├─ auth/  dashboard/  demandas/  projetos/  reunioes/
      ├─ presencas/  pontuacao/  estrutura/  acessos/  historico/  regras/
```

Cada `features/<domínio>/` segue o mesmo formato:

| Arquivo | Responsabilidade |
|---|---|
| `repositorio.ts` | Único lugar que conversa com o Supabase para o domínio (`select` e `rpc`). Converte erros do banco em mensagens para a interface. |
| `regras.ts` | Regras puras de apresentação (ex.: se uma demanda está atrasada, rótulos de status). Sem acesso a dados nem DOM. Testável com Vitest. |
| `pagina.ts` | Monta a tela do domínio e liga os eventos. |
| componentes do domínio | Partes da tela com responsabilidade própria (ex.: `quadro.ts`, `painel-demanda.ts`). |

## Permissões na interface

Para não duplicar regras de acesso no TypeScript (DRY, §6.3), o banco vai expor visões com colunas calculadas pelas mesmas funções do schema `privado`, por exemplo:

- `demandas_visiveis`: cada demanda com `pode_gerir` e `pode_mudar_status`.
- `reunioes_visiveis`: cada reunião com `pode_gerir`.
- `solicitacoes_visiveis`: cada pedido com `pode_aprovar` e `pode_revogar`.
- `meu_perfil`: papel, área, núcleo e indicadores gerais (`pode_ajustar_pontos`, `pode_editar_regras`, `pode_cadastrar_pessoas`).

A interface só lê esses indicadores. Se alguém forçar uma ação pelo navegador, as funções RPC recusam do mesmo jeito.

## Alternativas avaliadas

| Alternativa | Motivo do descarte |
|---|---|
| Manter o artefato como fonte do código | Sem histórico de versões, sem CI e sem deploy automático; inadequado para código modular. |
| JavaScript modular sem build | Sem checagem de tipos e sem linter, contrariando o §9. |
| React ou outro framework de interface | Dependência extra não autorizada. O volume de telas cabe em módulos TypeScript simples. |
| Backend próprio (Node, Python) | Servidor para manter. O Supabase cobre banco, login, arquivos e funções. |

## Consequências e trade-offs

- **Positivas:** responsabilidades separadas por domínio; permissões num lugar só (o banco); toda mudança passa por lint, tipos, testes e build antes de publicar; código acessível de qualquer computador.
- **Negativas:**
  - Sem Node.js local, o assistente **não consegue rodar build, tipos e testes do site antes de enviar**. A verificação acontece no GitHub Actions, depois do envio. Cada entrega vai informar isso com transparência e só será dada como pronta com o CI verde.
  - Os testes do banco hoje rodam no Edge via CDN, fora do Node. Para rodá-los também no CI será preciso autorizar `@electric-sql/pglite` como dependência de desenvolvimento (pedido pendente).
  - Sem framework, componentes com muito estado exigem disciplina na organização; se isso virar atrito real, reavaliar em novo ADR.

## Pré-requisitos (ações da equipe)

1. Criar o projeto no Supabase e rodar os scripts (`supabase/LEIA-ME.md`); enviar Project URL e anon key.
2. Criar o repositório privado `sgi-facil` no GitHub.
3. Escolher como o código chega ao GitHub:
   - instalar o **Git for Windows** (git-scm.com) neste computador, para o assistente enviar os commits; o login no GitHub é feito pela própria pessoa no navegador, na primeira vez; ou
   - receber os arquivos e enviar pelo site do GitHub ("Add file → Upload files").
4. Conectar o repositório à Vercel e cadastrar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente.

## Adendo · 29/10/2026 · esqueleto entregue

- O repositório inicial (configuração, CI, estilos, layout, login por link mágico, Dashboard e telas "em migração") foi gerado e verificado sem Node: checagem de tipos com o compilador TypeScript 5.6.3 rodando no Edge, com declarações simplificadas do `@supabase/supabase-js`, e testes unitários executados no mesmo ambiente (18/18). A checagem contra os tipos reais das dependências acontece no GitHub Actions.
- **ESLint autorizado, mas ainda não configurado:** para analisar TypeScript ele precisa de `typescript-eslint` e `@eslint/js`, que não estão na lista autorizada. Até essa autorização, o CI roda tipos, testes e build, sem linter.
- **Sem `package-lock.json`:** o CI usa `npm install`. Gerar e enviar o lockfile quando houver um computador com Node, para builds reprodutíveis.

## Estratégia de migração

1. Criar o esqueleto do repositório: configuração, CI, estilos com a paleta oficial, layout com menu lateral, login por link mágico.
2. Adicionar as visões de permissão no banco (nova migração, com testes).
3. Migrar os módulos na ordem de valor: demandas → reuniões e atas → pontuação e ranking → presenças → estrutura e cadastro de pessoas → acessos → histórico → regras.
4. O protótipo continua no artefato como referência visual até o último módulo ser migrado; depois é arquivado.
