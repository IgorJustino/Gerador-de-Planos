# Decisões da modernização

Este documento registra decisões arquiteturais fechadas antes da
implementação. Ele complementa a baseline e deve ser atualizado quando uma
decisão for formalmente alterada.

## ADR-001 — Banco de dados

**Decisão:** usar PostgreSQL local via Docker no desenvolvimento e Neon
PostgreSQL em produção, com conexão por `DATABASE_URL`.

Os dados antigos do Supabase não serão migrados. A nova base começará vazia e
será inicializada por migrations e seed fictício de demonstração.

**Motivos:** independência do Supabase, PostgreSQL convencional, ambiente
reproduzível e compatibilidade futura com `pgvector`.

## ADR-002 — Autenticação

**Decisão:** implementar autenticação própria no backend, com senha protegida
por `bcrypt` e JWT transmitido por cookie `httpOnly`.

Configuração esperada:

```text
httpOnly=true
secure=false no desenvolvimento
secure=true em produção
sameSite=lax
expiração definida
```

O JWT não será armazenado em `localStorage`. Usuários comuns não poderão
alterar o próprio papel.

Ainda será necessário definir a proteção CSRF e a estratégia de invalidação de
tokens antes do Marco 3.

## ADR-003 — Estrutura Express

**Decisão:** separar a aplicação em:

```text
src/app.js
src/server.js
```

`src/app.js` criará e configurará a aplicação Express. `src/server.js` será
responsável apenas por iniciar o servidor.

Não será criado `api/index.js`, pois o deploy-alvo é o Render e não há
necessidade atual de sustentar Vercel simultaneamente.

## ADR-004 — Migrations e acesso ao banco

**Decisão:** usar `node-pg-migrate` para controle de migrations e `pg` como
driver de acesso ao PostgreSQL.

A ferramenta deverá controlar criação, execução para frente, rollback e
histórico das migrations. Nenhuma migration destrutiva será executada
automaticamente em produção.

## ADR-005 — Contrato HTTP

**Decisão:** preservar inicialmente os campos usados pelo frontend:

```text
tema
nivelEnsino
duracaoMinutos
codigoBNCC
observacoes
disciplina
```

O banco utilizará nomes internos em `snake_case`, como `nivel_ensino`,
`duracao_minutos` e `codigo_bncc`. A conversão ficará nas camadas da API,
serviço ou repository.

Mudanças no contrato público só ocorrerão depois da estabilização do MVP.

## ADR-006 — Integração com Gemini

**Decisão:** a versão modernizada usará structured output em JSON, validação
com Zod, timeout, uma retentativa controlada e mocks nos testes.

O parsing por regex não será usado no fluxo modernizado. Essa implementação
será feita no Marco 3, depois da fundação técnica e da autenticação.

### Atualização do Marco 3C

O fluxo moderno utiliza `@google/generative-ai@0.24.1`, que suporta resposta
JSON com `responseMimeType`, `responseSchema` e `AbortSignal`. O modelo é
configurado por `GEMINI_MODEL`; a versão inicial do prompt é
`lesson-plan-v1`. A resposta é validada com Zod antes da persistência, com
timeout configurável e no máximo uma retentativa para resposta estruturalmente
inválida.

O serviço legado foi removido na etapa 3E. O endpoint moderno
`/api/planos/gerar` não possui fallback para parser legado.

## ADR-010 — Frontend moderno

**Decisão:** manter HTML, CSS e JavaScript sem framework nesta fase. As
chamadas passam por `public/js/apiClient.js`, sempre com
`credentials: 'include'`; o JWT permanece exclusivamente no cookie
`httpOnly`.

O frontend principal usa somente `/api/auth/*` e `/api/planos/*`. A resposta da
IA é renderizada com criação de elementos e `textContent`, sem interpolar dados
externos em `innerHTML`. O legado Supabase não faz parte da arquitetura ativa.

## ADR-011 — Versionamento por snapshots completos

**Decisão:** cada versão de um plano será armazenada como um snapshot completo
em `lesson_plan_versions`. O registro em `lesson_plans` continuará mantendo o
snapshot atual e o campo `current_version`.

A criação inicial grava o plano e a versão 1 na mesma transação. A criação de
versões posteriores bloqueia o plano com `SELECT ... FOR UPDATE`, calcula o
próximo número, insere o snapshot e atualiza o registro atual antes do commit.
Também existe uma constraint única em `(lesson_plan_id, version_number)` como
proteção adicional contra duplicidades.

As versões aceitam as origens `ai` e `manual` e usam `ON DELETE CASCADE`.
Escolhemos snapshots completos para permitir a reconstrução exata do plano em
qualquer ponto do histórico, incluindo tema, nível, duração, código BNCC e
conteúdo estruturado.

## ADR-012 — Edição com controle otimista

**Decisão:** toda edição manual exige `expectedVersion`. O service monta um
snapshot completo a partir do estado atual e das alterações recebidas. O
repository bloqueia o plano, compara `expectedVersion` com `current_version` e
cria a nova versão somente quando os valores coincidem.

Conflitos retornam HTTP 409 com código `VERSION_CONFLICT`. Alterações de status
são operacionais e não criam versões de conteúdo. A interface do Marco 4C usa
esses contratos para edição, consulta de versões, status e exclusão sem
armazenar tokens no navegador.

## ADR-007 — BNCC e RAG

**Decisão:** separar a evolução em duas fases.

Fase 1:

```text
catálogo SQL
busca por código
busca textual
seleção de habilidade existente
```

Fase 2:

```text
embeddings
pgvector
busca semântica
RAG
```

Antes da Fase 2, deverão ser definidos a fonte e versão dos dados, a licença,
o modelo de embedding, a dimensão do vetor, o processo de carga e o processo
de atualização.

## ADR-008 — Deploy e observabilidade mínima

**Decisão:** usar Render para a aplicação Node.js e Neon para PostgreSQL.

Os endpoints futuros serão:

```text
GET /health
GET /ready
```

`/health` verificará somente se o processo está vivo. `/ready` verificará a
conexão com o banco. Nenhum dos dois chamará Gemini ou outro serviço externo.

## ADR-009 — Organização dos marcos

**Decisão:** executar a modernização em seis marcos, sem iniciar o seguinte
antes da aprovação do anterior.

### Marco 1 — Baseline e decisões

Auditoria do repositório, classificação de arquivos, mapeamento de fluxos e
registro das decisões deste documento.

### Marco 2 — Fundação técnica

Criar `src/app.js`, configuração de ambiente, erros centralizados, PostgreSQL
local, migrations, pool de conexão, lockfile, health/readiness e testes
básicos da aplicação.

### Marco 3 — MVP vertical

Entregar o fluxo:

```text
cadastro → login → gerar plano → validar resposta → salvar → listar
```

Inclui autenticação, Zod, Gemini estruturado, repositories, persistência,
mock do Gemini e testes.

### Marco 4 — Produto

Adicionar edição, versionamento, histórico, exclusão, filtros e estados de
loading, erro e vazio no frontend.

### Marco 5 — BNCC e inteligência

Adicionar catálogo, busca textual, contexto no prompt, embeddings, `pgvector`
e rastreabilidade das habilidades usadas.

### Marco 6 — Produção e portfólio

Adicionar feedback, métricas, segurança, CI, Render, Neon, documentação,
screenshots e material de portfólio.

## Critérios de transição

O Marco 2 só começa após a baseline ser revisada e aprovada.

O Marco 3 só começa quando a aplicação Express, o PostgreSQL local e as
migrations estiverem funcionando sem Supabase.

O Marco 4 só começa quando o fluxo vertical estiver coberto por testes
essenciais.

O Marco 5 só começa quando o catálogo BNCC SQL estiver funcionando.

O Marco 6 só começa quando o fluxo principal estiver reproduzível localmente.
