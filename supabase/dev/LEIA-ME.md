# Ambiente de desenvolvimento (sgi-facil-dev)

Uma cópia do SGI com **dados fictícios**, para testar à vontade com uma conta que tem todas as permissões, sem
risco de expor ou estragar os dados reais da equipe. Usa o mesmo código do site, outro banco e outro endereço.

| | Produção | Desenvolvimento |
|---|---|---|
| Banco (Supabase) | `sgi-facil-br` | `sgi-facil-dev` |
| Site (Vercel) | `sgi-facil` | `sgi-facil-dev` |
| Dados | reais | fictícios (`02_dados_dev.sql`) |
| Aviso na tela | nenhum | faixa "Ambiente de desenvolvimento" e "[DEV]" no título da aba |

## 1. Criar o banco de desenvolvimento

1. No Supabase, **New project**: nome `sgi-facil-dev`, região São Paulo, plano Free. Gere uma senha forte do banco e
   guarde no seu gerenciador de senhas (não compartilhe).
2. **Authentication → Users → Add user → Create new user**: a sua conta de teste.
   - Use um e-mail que **você** controle (por exemplo `seuemail+dev@gmail.com`, que chega na sua caixa). Não use
     e-mails inventados de domínios públicos: quem for dono deles poderia pedir "Esqueci minha senha".
   - Senha nova, com pelo menos 10 caracteres, letras e números (não reaproveite senhas que já circularam).
   - Marque **Auto Confirm User**.
3. **Authentication → Sign In / Providers → Email**: **Minimum password length** em 10.
4. **SQL Editor**: rode os scripts da pasta `supabase` na mesma ordem da produção (ver `supabase/LEIA-ME.md`), **menos o
   `02_dados_iniciais.sql`**: `01`, `03`, `04`, `05`, `06` (sozinho), `07` a `20`.
5. Depois, `supabase/dev/02_dados_dev.sql`, com o e-mail da conta de teste no lugar de `PREENCHER`.
   O script se recusa a rodar se o banco já tiver pessoas (proteção contra rodar na produção por engano).
6. Por último, `supabase/dev/03_trocar_cargo_dev.sql`: liga o seletor **"Ver como"** da faixa do topo, que troca o
   cargo da conta de teste (Presidência, Vice, diretoria de cada área, assessoria, gerência ou membro de cada núcleo)
   para ver a plataforma pela ótica de cada um. Só a conta de teste troca de cargo, e o script se recusa a rodar num
   banco com pessoas reais.

A conta de teste vira a **Presidente** do ambiente de desenvolvimento: vê tudo, cadastra pessoas, ajusta pontos, edita
regras e autoriza recados e pedidos de acesso. Já entra com e-mail e senha, sem o formulário de primeiro acesso.
O script também cria pessoas fictícias em cada cargo (e-mails `@example.com`, que não recebem nada), dois projetos,
três demandas (uma atrasada e uma em revisão), uma reunião, um lançamento de pontos e um recado.

## 2. Criar o site de desenvolvimento

1. Na Vercel, **Add New → Project**, importe o repositório `FacilConsultoria/sgi-facil` e dê o nome `sgi-facil-dev`.
2. **Environment Variables** (do projeto `sgi-facil-dev`, nunca do `sgi-facil`):
   - `VITE_SUPABASE_URL`: Project URL do `sgi-facil-dev` (Supabase → Project Settings → Data API);
   - `VITE_SUPABASE_ANON_KEY`: anon/publishable key do `sgi-facil-dev`;
   - `VITE_AMBIENTE`: `desenvolvimento`.
3. **Deploy**. No Supabase do `sgi-facil-dev`, em **Authentication → URL Configuration**, coloque o endereço do site
   de desenvolvimento em **Site URL** e em **Redirect URLs**.

Os dois sites publicam a partir do mesmo ramo `main`: o código é o mesmo, só os dados mudam.

## 3. No dia a dia

- **Migração nova:** rode primeiro no `sgi-facil-dev`, teste no site de desenvolvimento e só depois rode na produção.
- **Ver como outro cargo:** escolha na lista "Ver como" da faixa do topo; a página recarrega já no novo cargo. Para
  voltar a ter todas as permissões, escolha "Presidência".
- **Recomeçar do zero:** apague e recrie o projeto `sgi-facil-dev` (ou crie outro) e repita os passos 1.4 a 1.6.
- **Conferir o script de dados fictícios** sem o Supabase, a partir da pasta do projeto:
  `powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1 -Teste teste_dev.js`
