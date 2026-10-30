# SGI no Supabase: instalação passo a passo

Tempo estimado: 20 minutos. Não precisa instalar nada no computador; tudo é feito no navegador.

## O que vem pronto

| Arquivo | O que faz |
|---|---|
| `01_estrutura_e_regras.sql` | Cria as tabelas, as regras de acesso (quem vê o quê, direto no banco), as operações do sistema (criar demanda, validar, lançar pontos, encerrar reunião, pedir acesso etc.) e o espaço para arquivos das reuniões. |
| `02_dados_iniciais.sql` | Cadastra a estrutura 2027 (Presidência, Vice, diretorias, núcleos, vagas e coberturas) e as sete lideranças: Mel, Luis, João, Victor, Emilli, Duda e Maju. |
| `03_visoes_interface.sql` | Visões que o site lê: perfil de quem está logado e, para demandas, reuniões e pedidos, os indicadores do que cada pessoa pode fazer. |
| `04_modulo_demandas.sql` | Para a tela de Demandas: projetos, núcleos e pessoas que cada um pode usar nos cadastros, e a regra de que só a liderança reabre uma demanda concluída. |
| `functions/receber-transcricao/index.ts` | Endereço que vai receber as transcrições do Meet quando a automação estiver pronta. Pode ficar para depois. |

## 1. Criar o projeto

1. Acesse **supabase.com** e crie uma conta (pode entrar com a conta Google da Fácil).
2. Clique em **New project**.
   - **Name:** `sgi-facil`
   - **Database password:** gere uma senha forte e guarde num gerenciador de senhas. Não compartilhe com ninguém, nem comigo.
   - **Region:** South America (São Paulo).
   - Plano **Free**.
3. Aguarde uns dois minutos até o projeto ficar pronto.

## 2. Criar o banco

1. No menu à esquerda, abra **SQL Editor** e clique em **New query**.
2. Cole todo o conteúdo de `01_estrutura_e_regras.sql` e clique em **Run**. Deve aparecer "Success. No rows returned".
3. Abra outra query. Cole `02_dados_iniciais.sql` e, **antes de rodar**, troque no topo os sete `PREENCHER` pelos e-mails Google reais. Não salve o arquivo com os e-mails preenchidos no repositório.
4. Clique em **Run**. Se esquecer algum e-mail, o script avisa e não grava nada.
5. Abra mais uma query, cole `03_visoes_interface.sql` e clique em **Run**.
6. Repita com `04_modulo_demandas.sql`.

Para conferir: em **Table Editor**, a tabela `pessoas` deve ter 7 linhas e `areas` deve ter 5.

## 3. Login

O acesso funciona assim (o Supabase já vem com e-mail e senha ligados):

- **Primeiro acesso:** a pessoa digita o e-mail, escolhe "Primeiro acesso? Receber link por e-mail", abre o link e cria a própria senha (mínimo de 10 caracteres, com letras e números). A marca de que a senha foi criada fica no cadastro de acesso do Supabase (`senha_definida`).
- **Próximos acessos:** e-mail e depois senha. "Esqueci minha senha" envia um novo link, que leva direto à criação de uma nova senha.
- **Envio dos e-mails:** o envio padrão do Supabase só entrega para quem é da equipe do projeto e tem limite de 2 por hora; por isso é preciso ligar um serviço de e-mail próprio antes de convidar a equipe (Authentication → Emails → SMTP Settings). O Resend com domínio verificado funciona; sem domínio, ele só entrega para o e-mail dono da conta do Resend.
- Em **Authentication → Sign In / Providers → Email**, deixe **Minimum password length** em 10.
- Quem entrar com um e-mail que **não** está cadastrado em `pessoas` consegue criar a sessão, mas o banco não mostra nada para essa pessoa.
- Os próximos membros são cadastrados pelo próprio SGI, pela Presidência ou pela Gente e Gestão.
- Login com o botão "Entrar com Google" pode ser ligado depois em **Authentication → Sign In / Providers → Google**. Ele exige criar uma credencial no Google Cloud; eu passo o roteiro quando for a hora.

## 4. Me enviar dois dados

Em **Project Settings → API** (ou **Data API**), copie:

- **Project URL** (algo como `https://abcd1234.supabase.co`)
- **anon public key** (ou "publishable key")

Esses dois são públicos por natureza: vão dentro do site e não dão acesso a nada sozinhos, porque quem decide o que cada um vê são as regras do banco.

**Nunca** envie a `service_role key` (ou "secret key") nem a senha do banco. Elas dão acesso total.

Com a URL e a chave pública, eu ligo o protótipo ao banco de verdade e preparo a publicação do site (Vercel ou Netlify).

## 5. Depois: receber transcrições (opcional por enquanto)

Quando formos ligar a automação do Meet:

1. **Edge Functions → Deploy a new function → Via editor**, nome `receber-transcricao`, cole o conteúdo de `functions/receber-transcricao/index.ts` e publique.
2. Nas configurações da função, **desligue a verificação de JWT** (quem chama é uma automação, não uma pessoa logada).
3. Em **Edge Functions → Secrets**, crie `SGI_CHAVE_INTEGRACAO` com um texto aleatório de pelo menos 24 caracteres. Essa chave vai no Apps Script ou no Make, nunca em lugar público.

A função recebe `titulo`, `inicio` (data e hora com fuso) e `texto`, e vincula a transcrição à reunião agendada no mesmo dia, com horário mais próximo (até 2 horas de diferença). Se não achar, a transcrição fica guardada sem vínculo para a Presidência ou a Assessoria vincular.

## Como as regras foram testadas

Os quatro scripts SQL foram executados num Postgres real (PGlite), simulando as partes do Supabase (login, papéis e armazenamento de arquivos), com 104 verificações por perfil: quem vê quais demandas, quem valida e quem reabre, pontos ao concluir e ao reabrir, faltas ao encerrar reunião, ajustes, pedidos de acesso, arquivos, transcrições, indicadores das visões, listas dos cadastros de demandas e bloqueio de escrita direta. Todas passaram (30/10/2026).

Para repetir os testes em qualquer computador Windows com Edge e internet, a partir da pasta do projeto:

```
powershell -ExecutionPolicy Bypass -File supabase\testes\rodar_testes.ps1
```

O Supabase real pode ter pequenas diferenças nessas partes simuladas, principalmente no armazenamento de arquivos. Se algum passo der erro, copie a mensagem e me envie.

## Decisões embutidas no banco

- O **diretório de pessoas** (nome, cargo, área) é visível a todos que têm cadastro ativo, porque as reuniões gerais já listam todo mundo. Demandas, pontuação, presença, atas e pedidos seguem a matriz hierárquica.
- Toda escrita passa por funções que checam permissão e registram auditoria. Ninguém consegue alterar uma tabela diretamente, nem pelo navegador.
- Os IDs da Presidência (`pres`) e de Gente e Gestão (`adm`, `adm-gg`) ficam na tabela `config`. Se a estrutura mudar, troca-se ali.
- Fuso horário: `America/Sao_Paulo` (também na `config`).
