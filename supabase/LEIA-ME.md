# SGI no Supabase: instalação passo a passo

Tempo estimado: 20 minutos. Não precisa instalar nada no computador; tudo é feito no navegador.

## O que vem pronto

| Arquivo | O que faz |
|---|---|
| `01_estrutura_e_regras.sql` | Cria as tabelas, as regras de acesso (quem vê o quê, direto no banco), as operações do sistema (criar demanda, validar, lançar pontos, encerrar reunião, pedir acesso etc.) e o espaço para arquivos das reuniões. |
| `02_dados_iniciais.sql` | Cadastra a estrutura 2027 (Presidência, Vice, diretorias, núcleos, vagas e coberturas) e as sete lideranças: Mel, Luis, João, Victor, Emilli, Duda e Maju. |
| `03_visoes_interface.sql` | Visões que o site lê: perfil de quem está logado e, para demandas, reuniões e pedidos, os indicadores do que cada pessoa pode fazer. |
| `04_modulo_demandas.sql` | Para a tela de Demandas: projetos, núcleos e pessoas que cada um pode usar nos cadastros, e a regra de que só a liderança reabre uma demanda concluída. |
| `05_modulo_reunioes.sql` | Para a tela de Reuniões e atas: os públicos em que cada pessoa pode agendar (com quantos seriam convocados) e, em cada reunião, convocados, faltas e se já dá para encerrar. |
| `06_reuniao_por_pessoas.sql` | Um comando só: cria o público "pessoas escolhidas". **Rode sozinho**, antes do 07. |
| `08_modulo_acessos.sql` | Para a tela de Autorizações: para quem cada pessoa pode pedir acesso por exceção, quais projetos podem ser pedidos, o nome do que foi pedido e o pedido de aval da Assessoria. |
| `09_modulo_pontuacao.sql` | Para a tela de Pontuação e ranking: as pessoas cuja pontuação cada um pode ver (com saldo, entregas, faltas e projetos ativos), a linha do tempo de lançamentos e quem pode ajustar ou pedir aval. |
| `10_modulo_presencas.sql` | Para a tela de Presenças: quantas reuniões encerradas convocaram cada pessoa que você acompanha e como ficou a presença (presente, justificada, falta). |
| `11_modulo_equipe.sql` | Para a tela Estrutura e equipe: pessoas da equipe (o e-mail só aparece para quem cadastra), quem pode editar cada uma, cargos e áreas disponíveis no cadastro e quem define titulares e coberturas. Também fecha uma brecha: só a Presidência cadastra ou move pessoas para a área da Presidência. |
| `12_modulo_historico.sql` | Para a tela Histórico completo: uma visão dos registros de auditoria com o nome de quem fez cada ação. Quem vê cada registro continua sendo decidido pela regra de leitura da auditoria. |
| `13_modulo_regras.sql` | Para a tela Regras: a simulação de visibilidade (quantas demandas e pontuações cada pessoa enxerga com os dados de agora), que só a Presidência recebe. Os valores de pontuação usam a tabela e a função que já existiam. |
| `14_modulo_projetos.sql` | Para a tela Projetos: uma visão com o andamento de cada projeto que a pessoa enxerga (demandas, concluídas, atrasadas) e o tipo de acesso dela (integral, exceção ou parcial). Os números contam só as demandas que a pessoa vê. |
| `15_dados_pessoais.sql` | Dados pessoais (nome completo, RGA, CPF, data de nascimento e gênero) e o e-mail protegido. A tabela `dados_pessoais` só é lida pela própria pessoa e pela Presidente, e só a própria pessoa grava (função `salvar_meus_dados`, que valida CPF, RGA, data e gênero). O e-mail deixa de ser legível por todas as pessoas: cada uma vê o seu e quem cadastra pessoas vê o de todas. |
| `16_tratamento.sql` | Gênero nos textos: guarda em `pessoas.tratamento` (feminino, masculino ou neutro) a forma de tratamento de cada pessoa, que todas leem; o gênero em si continua privado. Também troca duas mensagens de pedido de aval que tinham gênero fixo. |
| `17_disponibilidade.sql` | Calendário de disponibilidade: uma grade semanal por pessoa (segunda a domingo, das 7h às 22h), gravada só pela própria pessoa (`salvar_minha_disponibilidade`) e lida por ela e por quem a enxerga pela hierarquia (a mesma regra da pontuação). Inclui a visão `disponibilidade_pessoas`, com quem já preencheu. |
| `07_assessoria_aval_publico_exclusao.sql` | Assessoria de Presidência com acesso de Presidência, avais (pedidos que a Presidente ou a Vice aprovam), reunião para pessoas escolhidas, diretorias agendando para todos e exclusão de reuniões. |
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
6. Repita com `04_modulo_demandas.sql` e depois com `05_modulo_reunioes.sql`.
7. Rode `06_reuniao_por_pessoas.sql` **sozinho** e espere terminar. Só então rode o `07_assessoria_aval_publico_exclusao.sql` e, depois, o `08_modulo_acessos.sql`, o `09_modulo_pontuacao.sql`, o `10_modulo_presencas.sql`, o `11_modulo_equipe.sql`, o `12_modulo_historico.sql`, o `13_modulo_regras.sql`, o `14_modulo_projetos.sql`, o `15_dados_pessoais.sql`, o `16_tratamento.sql` e o `17_disponibilidade.sql`. O Supabase pode avisar de "operações destrutivas" no 07 (ele troca funções e políticas antigas, sem apagar dados).

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

Os dezessete scripts SQL foram executados num Postgres real (PGlite), simulando as partes do Supabase (login, papéis e armazenamento de arquivos), com 311 verificações por perfil (inclui o e-mail oculto, os dados pessoais, o tratamento e a disponibilidade) (inclui Assessoria, avais, público por pessoas, exclusão de reuniões, arquivos órfãos, as visões de pontuação, a frequência, o cadastro de pessoas, o histórico, a simulação de visibilidade e o painel de projetos): quem vê quais demandas, quem valida e quem reabre, pontos ao concluir e ao reabrir, faltas ao encerrar reunião, ajustes, pedidos de acesso, arquivos, transcrições, indicadores das visões, listas dos cadastros de demandas e de reuniões e bloqueio de escrita direta. Todas passaram (30/10/2026).

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
