# SGI · Fácil Consultoria

Sistema de Gestão Interna da Fácil Consultoria: demandas, reuniões e atas, presenças, pontuação e ranking, com permissões hierárquicas aplicadas no banco de dados.

## Onde está cada coisa

| Pasta | Conteúdo |
|---|---|
| `src/` | Site (Vite + TypeScript). Um módulo por domínio em `src/features/`. |
| `supabase/` | Banco: estrutura e regras (`01`), dados iniciais (`02`), visões da interface (`03`), função de transcrições e testes. Instalação em `supabase/LEIA-ME.md`. |
| `docs/` | Notas do projeto, diretrizes de arquitetura e decisões (ADR). Leia antes de alterar código. |
| `prototipo/` | Protótipo navegável usado como referência visual durante a migração. |

## Regras de desenvolvimento

Todo código segue `docs/DIRETRIZES.md`. A arquitetura está em `docs/adr/0001-arquitetura-versao-online.md`. Resumo:

- Permissões são decididas pelo banco (RLS e funções). O site só lê os indicadores das visões (`pode_gerir`, `pode_aprovar` etc.).
- Gravações acontecem apenas por funções do banco (`supabase.rpc(...)`), nunca por insert/update direto.
- Dependências novas só com autorização explícita. Autorizadas hoje: `@supabase/supabase-js`, `vite`, `typescript`, `vitest`.

## Verificação automática

A cada envio para `main`, o GitHub Actions (aba **Actions**) roda checagem de tipos, testes unitários e build. Uma entrega só está pronta com essa verificação verde.

Testes das regras do banco (Windows com Microsoft Edge e internet):

```
powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1
```

## Rodar localmente (opcional, exige Node.js 20+)

```
npm install
copy .env.example .env.local
npm run dev
```

Preencha `.env.local` com a Project URL e a anon key do Supabase. Nunca use a service_role key no site.

## Publicação

O site é publicado pela Vercel a partir deste repositório. Variáveis de ambiente na Vercel: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
