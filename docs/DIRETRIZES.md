# Diretrizes e Padrões Arquiteturais da Aplicação

> **Status:** Ativo  
> **Versão:** 1.1 (Otimizado para Desenvolvimento Assistido por IA / Vibecoding)  
> **Público-alvo:** Equipes de Engenharia, Revisores de Código e Agentes Autônomos de IA  

---

## 1. Objetivo

Este documento estabelece os princípios, padrões e restrições arquiteturais que devem orientar o desenvolvimento e a evolução desta aplicação.

O objetivo é manter uma base de código organizada, modular, legível, segura, testável e sustentável, evitando o acúmulo de complexidade e de dívida técnica durante o desenvolvimento.

Estas diretrizes devem ser respeitadas por todos os agentes de desenvolvimento, incluindo ferramentas de IA responsáveis por criar, modificar, refatorar ou revisar código.

A arquitetura deve evoluir conforme as necessidades reais da aplicação, sem introduzir complexidade desnecessária.

---

## 2. Princípios Fundamentais

Toda implementação deve seguir estes princípios:

* **Separação de responsabilidades:** Cada módulo deve possuir uma finalidade clara e delimitada.
* **Alta coesão:** Elementos relacionados funcionalmente devem permanecer próximos e organizados.
* **Baixo acoplamento:** Módulos devem depender o mínimo possível dos detalhes internos de outros módulos.
* **Simplicidade:** Prefira a solução mais simples que atenda aos requisitos atuais sem comprometer a evolução previsível do sistema.
* **Legibilidade:** O código deve ser fácil de compreender, revisar e modificar.
* **Reutilização consciente:** Evite duplicações significativas, mas não crie abstrações prematuras.
* **Modularidade:** Funcionalidades devem ser divididas em módulos com responsabilidades bem definidas.
* **Testabilidade:** Regras de negócio e fluxos críticos devem poder ser verificados de maneira reproduzível.
* **Segurança:** Valide entradas, controle permissões e proteja dados sensíveis desde o início.
* **Evolução incremental:** Cada alteração deve preservar a integridade arquitetural existente.

---

## 3. Organização e Estrutura do Projeto

### 3.1. Estrutura Modular

A aplicação deve ser organizada em módulos e arquivos conforme suas responsabilidades e os padrões da tecnologia utilizada.

* **Não concentre** indiscriminadamente a aplicação em um único arquivo HTML, JavaScript, TypeScript, CSS ou equivalente.
* **Evite arquivos monolíticos** que acumulem simultaneamente apresentação, regras de negócio, acesso a dados, integrações, gerenciamento de estado e tratamento de eventos sem uma justificativa técnica clara.

A estrutura deve permitir identificar rapidamente:
* Onde cada funcionalidade está implementada.
* Onde os componentes visuais são definidos.
* Onde as regras de negócio são executadas.
* Onde os dados são consultados ou modificados.
* Onde as integrações externas são realizadas.
* Onde os testes e as configurações estão localizados.

### 3.2. Organização por Responsabilidade

Organize o código de acordo com as características do projeto. Quando apropriado, considere separar:

| Diretório | Responsabilidade Principal |
| :--- | :--- |
| `components/` | Componentes visuais reutilizáveis. |
| `pages/` ou `routes/` | Páginas e pontos de entrada das funcionalidades. |
| `features/` | Módulos organizados por funcionalidade ou domínio. |
| `services/` | Integrações externas e operações de comunicação. |
| `repositories/` | Acesso e persistência de dados, quando necessário. |
| `hooks/` | Lógica reutilizável de ciclo de vida ou estado (quando suportado). |
| `utils/` | Funções auxiliares genéricas e sem regras de negócio específicas. |
| `types/` | Tipos e contratos compartilhados, quando aplicável. |
| `tests/` | Testes, caso não estejam organizados junto aos respectivos módulos. |

> **Nota:** Esta lista é uma referência, não uma estrutura obrigatória. Utilize somente as divisões que façam sentido para a tecnologia, o domínio e o tamanho da aplicação. Prefira organizar funcionalidades relacionadas de maneira coesa em vez de criar uma estrutura de pastas excessivamente fragmentada.

### 3.3. Responsabilidade dos Arquivos

Cada arquivo deve ter um propósito identificável.

* Quando um arquivo começar a acumular responsabilidades distintas, dificultar a localização do código ou exigir alterações em áreas não relacionadas, avalie sua divisão em módulos menores.
* **Critério de fragmentação:** Não utilize apenas o número de linhas como métrica. Considere a complexidade, a coesão, a quantidade de responsabilidades e a facilidade de manutenção.

---

## 4. Separação de Responsabilidades

A arquitetura deve distinguir, quando aplicável, as seguintes camadas e papéis:

### Apresentação
Responsável por exibir informações, receber interações do usuário e coordenar a interface.  
*Restrição:* Não deve concentrar regras de negócio complexas nem implementar diretamente detalhes de persistência ou integração com sistemas externos.

### Regras de Negócio
Responsável pelas regras, validações e decisões que definem o comportamento da aplicação.  
*Diretriz:* Sempre que houver complexidade relevante, mantenha essas regras independentes dos detalhes visuais, facilitando sua reutilização e seus testes.

### Acesso a Dados
Responsável pelas operações de leitura, gravação, atualização e exclusão de dados.  
*Restrição:* Evite espalhar consultas, comandos de persistência e detalhes de infraestrutura por toda a interface.

### Integrações Externas
Responsável pela comunicação com APIs, serviços de terceiros e outros sistemas.  
*Diretriz:* Centralize os detalhes de integração nos módulos apropriados, incluindo tratamento de erros, autenticação e transformação de dados quando necessário.

> **Regra prática:** Essas separações podem ser implementadas de diferentes formas. Não é obrigatório criar uma camada ou um arquivo específico para cada responsabilidade quando isso não trouxer benefício real.

---

## 5. Gerenciamento de Dependências e Estado

### 5.1. Dependências

As dependências entre módulos devem ser explícitas, compreensíveis e direcionadas.

**Evite categoricamente:**
* Dependências circulares.
* Importações desnecessárias entre funcionalidades independentes.
* Acesso indiscriminado a variáveis globais.
* Dependência de detalhes internos de outros módulos.
* Propagação descontrolada de alterações entre camadas.

*Prefira interfaces e contratos estáveis quando módulos precisarem se comunicar.*

### 5.2. Estado da Aplicação

O estado deve ser mantido no local mais adequado ao seu escopo:
* **Estados locais:** Devem permanecer próximos dos componentes que os utilizam.
* **Estados compartilhados:** Devem ter uma fonte de verdade claramente definida.
* **Dados persistentes:** Devem ser tratados de acordo com a estratégia de armazenamento adotada.
* **Dados derivados:** Devem ser calculados sob demanda, evitando duplicação desnecessária de estado.
* **Atualizações:** Devem seguir os mecanismos previstos pela tecnologia utilizada.

*Evite múltiplas fontes de verdade para a mesma informação e alterações implícitas de estado em módulos não relacionados.*

---

## 6. Qualidade e Legibilidade do Código

### 6.1. Nomenclatura
* Utilize nomes claros, consistentes e representativos da responsabilidade de cada elemento.
* Prefira termos que expressem intenção e significado de negócio.
* Evite abreviações obscuras, termos genéricos desprovidos de contexto (ex.: `data`, `temp`, `manager`) e nomes desalinhados com o comportamento real.
* Respeite as convenções idiomáticas da linguagem e do projeto.

### 6.2. Funções e Componentes
Funções, métodos e componentes devem possuir responsabilidades delimitadas e leitura intuitiva.

**Antipadrões a evitar:**
* Funções excessivamente extensas ou com múltiplos objetivos.
* Componentes que concentrem toda a lógica da aplicação.
* Condicionais profundamente aninhadas sem necessidade.
* Excesso de parâmetros independentes (agrupe-os em estruturas ou objetos quando cabível).
* Efeitos colaterais inesperados (*side-effects* velados).
* Mistura arbitrária de lógica de negócio, apresentação e persistência na mesma unidade.

*Extraia responsabilidades quando isso melhorar a compreensão, a testabilidade ou o reuso real.*

### 6.3. Duplicação e Abstrações
* Evite duplicar regras de negócio ou lógica que representem a mesma fonte de conhecimento.
* Não generalize implementações prematuramente apenas por semelhança superficial de sintaxe.
* Uma abstração deve possuir finalidade clara: reduzir complexidade ou isolar limites arquiteturais estáveis.

### 6.4. Consistência
* Siga os padrões já estabelecidos para nomenclatura, organização, tratamento de erros e formatação.
* Não introduza novas convenções ou bibliotecas sem justificativa evidente.
* Diante de inconsistências herdadas, priorize refatorações incrementais no padrão adotado em vez de introduzir um terceiro padrão paralelo.

---

## 7. Princípios de Design

Aplique os princípios **SOLID** com foco pragmático e adaptado ao contexto:
* **S (Single Responsibility):** Um módulo deve ter uma única responsabilidade principal bem delimitada.
* **O (Open/Closed):** Permita extensões apropriadas sem exigir alterações constantes em código estável.
* **L (Liskov Substitution):** Implementações substitutas devem honrar estritamente os contratos acordados.
* **I (Interface Segregation):** Prefira contratos específicos e coesos a interfaces inchadas e abrangentes.
* **D (Dependency Inversion):** Módulos de alto nível não devem acoplar-se diretamente a detalhes concretos de infraestrutura.

**Diretrizes complementares:**
* **KISS** (*Keep It Simple, Stupid*): Privilegie a clareza e a simplicidade.
* **DRY** (*Don't Repeat Yourself*): Centralize regras canônicas de negócio.
* **Evite YAGNI** (*You Aren't Gonna Need It*): Não codifique abstrações ou mecanismos para cenários puramente especulativos.

---

## 8. Tratamento de Erros e Segurança

### 8.1. Tratamento de Erros
* **Tratamento explícito:** Não silencie exceções relevantes nem utilize blocos `catch`/`except` vazios.
* **Experiência do usuário:** Forneça mensagens compreensíveis e orientadas à ação na interface.
* **Observabilidade:** Preserve detalhes técnicos em logs apropriados para diagnóstico e auditoria.
* **Resiliência:** Trate falhas de rede, respostas anômalas e interrupções externas de acordo com o contexto.
* **Proteção de dados:** Nunca exponha rastreamentos internos (*stack traces*), segredos ou dados confidenciais na camada de apresentação.

### 8.2. Segurança
* **Validação:** Valide, sanitize e normalize todas as entradas externas (*inputs*).
* **Controle de acesso:** Aplique autenticação e autorização nas fronteiras confiáveis do sistema.
* **Defesa no servidor:** Nunca confie exclusivamente em validações de front-end para resguardar recursos de back-end.
* **Gestão de credenciais:** Jamais versione segredos, chaves de API, senhas ou tokens privados em repositórios.
* **Criptografia:** Adote protocolos e algoritmos consolidados para armazenamento e trânsito de dados sensíveis.
* **Prevenção contínua:** Esteja atento contra injeções (SQL, NoSQL, HTML/XSS) e avalie dependências contra vulnerabilidades conhecidas (CVEs).

---

## 9. Testes e Validação

Toda alteração deve ser verificada proporcionalmente ao seu impacto e risco.

### Estrutura de Prioridades
1. **Testes Unitários:** Para validações e regras de negócio isoláveis.
2. **Testes de Integração:** Para validar fronteiras entre módulos, bancos de dados e serviços externos.
3. **Testes Ponta a Ponta (E2E):** Para fluxos críticos da jornada do usuário.
4. **Análise Estática:** Checagem rigorosa de tipos (*type-checking*), linters e formatação automática.
5. **Testes de Regressão:** Para proteger comportamentos preexistentes impactados pela alteração.

### Diretrizes de Execução
* Uma tarefa não está finalizada pela simples geração de código ou renderização inicial de tela.
* Registre e informe com transparência quais testes foram executados, quais falharam e quais não puderam ser realizados.
* **Proibição expressa:** Não declare aprovação em testes sem a devida evidência prática de sua execução.

---

## 10. Refatoração e Controle da Dívida Técnica

A refatoração deve ser um hábito contínuo para manter a saúde do ecossistema.

### Sinais de Alerta para Refatoração
* Módulos ou arquivos acumulando múltiplas responsabilidades.
* Funções com alta complexidade ciclomática, difíceis de testar.
* Regras de negócio duplicadas em múltiplos pontos.
* Acoplamentos rígidos ou ciclos de dependência.
* Acúmulo de soluções de contorno ("gambiarras") a cada nova demanda.
* Atrito perceptível para localizar ou alterar regras existentes.

### Regras de Execução
1. Separe refatorações estruturais de entregas funcionais para permitir revisões cirúrgicas.
2. Mantenha os comportamentos funcionais intactos, salvo alteração expressa de escopo.
3. Evite refatorações massivas em tarefas pontuais; privilegie a melhoria contínua e incremental.

---

## 11. Regras para o Desenvolvimento Assistido por IA

### Fase 1: Pré-Implementação (Análise e Planejamento)
O agente de IA deve obrigatoriamente:
1. Inspecionar a estrutura existente, identificando tecnologias, padrões vigentes e contratos estabelecidos.
2. Localizar com precisão os arquivos e módulos associados à funcionalidade solicitada.
3. Identificar as fronteiras de responsabilidade e as dependências que sofrerão impacto.
4. Determinar o local exato onde a nova lógica deve residir, sem sobrecarregar arquivos existentes.
5. Confirmar se a abordagem planejada está alinhada a este documento.

### Fase 2: Durante a Implementação
O agente deve:
* Reutilizar componentes e utilitários consolidados no repositório.
* Criar novos arquivos exclusivamente quando houver uma responsabilidade distinta e justificada.
* Preservar trechos de código funcionais preexistentes, evitando reescritas arbitrárias de estilo.
* Limitar o escopo das alterações aos arquivos pertinentes à solicitação.
* Não instalar ou sugerir novas dependências externas sem justificar o benefício técnico.
* Explicitar abertamente limitações, bloqueios ou verificações que não puderam ser concluídas.

### Fase 3: Pós-Implementação (Auditoria e Entrega)
O agente deve:
1. Auditar os arquivos alterados e verificar se novas responsabilidades foram introduzidas indevidamente.
2. Checar a existência de código duplicado, dependências circulares ou complexidade acidental.
3. Executar as baterias de testes e verificações estáticas disponíveis no ambiente.
4. Resolver regressões introduzidas pela mudança.
5. Atualizar a documentação ou comentários técnicos pertinentes.
6. Apresentar um resumo claro: alterações realizadas, testes validados e limitações identificadas.

---

## 12. Critérios de Aceitação Arquitetural

Uma entrega é considerada pronta quando cumpre cumulativamente os critérios aplicáveis:
- [ ] A implementação possui escopo e responsabilidade claramente definidos.
- [ ] O código foi distribuído nos módulos e diretórios adequados.
- [ ] A solução adere aos padrões existentes de nomenclatura e tipagem.
- [ ] Não foram adicionadas abstrações especulativas ou complexidade desnecessária.
- [ ] Não foram introduzidas regressões funcionais ou de segurança conhecidas.
- [ ] Testes pertinentes foram executados com sucesso (ou as limitações foram reportadas com transparência).
- [ ] Validações de segurança, tratamento de erros e sanitização de dados foram implementados.
- [ ] A documentação técnica correspondente foi atualizada.

---

## 13. Evolução da Arquitetura

Decisões de engenharia devem responder às dores do presente, aos riscos identificados e a cenários realisticamente previsíveis.

Toda mudança arquitetural expressiva deve ser deliberada e registrada (ex.: via *Architecture Decision Records* - ADR), contemplando:
* O contexto e o problema raiz que motivaram a alteração.
* As alternativas técnicas avaliadas e os motivos do descarte.
* A relação entre custos e benefícios (*trade-offs*).
* O impacto nos módulos existentes e a estratégia de migração.
* Implicações em testes, observabilidade, segurança e ciclo de vida operacional.

---

## 14. Referências Conceituais

* **Clean Code** — Robert C. Martin
* **Clean Architecture** — Robert C. Martin
* **Refactoring: Improving the Design of Existing Code** — Martin Fowler
* **ISO/IEC 25010** — Modelos de Qualidade de Produto de Software
* **Google Engineering Practices** — Práticas de Engenharia e Revisão de Código
* **Princípios SOLID, KISS, DRY e YAGNI**

---

## 15. Diretrizes Operacionais Estritas para Vibecoding (System Instructions para IA)

> **AVISO OBRIGATÓRIO PARA O AGENTE DE IA:** As regras a seguir são imperativas e sobrepõem qualquer padrão gerador padrão da LLM. Elas devem ser seguidas em toda e qualquer resposta de código neste projeto.

### 15.1. Regra Anti-Preguiça e Integridade Total de Código
* **PROIBIDO TRUNCAR CÓDIGO:** Nunca utilize comentários substitutivos como `// ... restante do código continua igual`, `/* mantenha os imports anteriores */` ou omita funções preexistentes.
* **CÓDIGO PRONTO PARA EXECUÇÃO:** Sempre entregue o arquivo ou o trecho modificado completo, sintaticamente válido e pronto para substituição ou cópia direta sem quebrar o fluxo.

### 15.2. Modificação Cirúrgica e Controle de Danos (*Blast Radius*)
* Altere **estritamente** os arquivos e linhas necessários para atender ao prompt atual.
* **Não refatore código funcional adjacente** nem altere nomes de variáveis, estilos de formatação ou convenções de arquivos que não fazem parte do escopo imediato da tarefa.
* Preserve integrações, interfaces e contratos públicos existentes intactos.

### 15.3. Bloqueio Estrito de Novas Dependências
* É expressamente **proibido** instalar, importar ou sugerir bibliotecas externas adicionais (npm, pip, composer, etc.) sem autorização prévia e explícita do desenvolvedor.
* Resolva os problemas utilizando exclusivamente as dependências já instaladas no repositório e recursos nativos da linguagem utilizada.

### 15.4. Protocolo Obrigatório de Resposta
Toda resposta contendo alterações de código DEVE seguir rigidamente este formato de três etapas:
1. **Plano de Execução (2-3 linhas):** Identifique exatamente quais arquivos serão afetados e a estratégia adotada antes de escrever o código.
2. **Implementação:** O código completo, tipado e com tratamento de erros explícito (sem blocos `catch` silenciosos).
3. **Instrução de Verificação:** Indique o comando de teste, verificação de linter ou passo manual no navegador para comprovar que a alteração funciona sem quebras.