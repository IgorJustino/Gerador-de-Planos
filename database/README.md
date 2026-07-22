# Banco de dados

O desenvolvimento usa PostgreSQL local pelo Docker Compose. A aplicação não
executa migrations automaticamente ao iniciar.

## Execução local

```bash
cp .env.example .env
docker compose up -d postgres
npm ci
npm run migrate:up
npm run db:seed
npm start
```

Para subir a aplicação e o PostgreSQL em containers:

```bash
docker compose up --build
```

Nesse caso, execute as migrations em uma etapa separada:

```bash
docker compose run --rm app npm run migrate:up
docker compose run --rm app npm run db:seed
```

## Comandos de migration

```bash
npm run migrate:create -- nome_da_migration
npm run migrate:up
npm run migrate:down
```

O `DATABASE_URL` deve apontar para o banco desejado. Em produção, migrations
devem ser executadas em uma etapa controlada, nunca automaticamente pelo
processo web.

O Marco 2 criou a extensão `pgcrypto` e a tabela base `users`. A 3A adiciona
`lesson_plans`, suas constraints, índices e triggers de `updated_at`. A 4A
adiciona `lesson_plan_versions` e `lesson_plans.current_version`, mantendo um
snapshot completo para cada versão e fazendo backfill da versão 1 para planos
existentes. A sprint de produto adiciona `lesson_plan_feedbacks`, com um
feedback por usuário e plano. A sprint de IA avançada adiciona `bncc_skills`,
`lesson_plan_bncc_skills`, `pg_trgm` e `vector`.

## Versionamento de planos

`lesson_plans` mantém o snapshot atual para consultas e listagens rápidas.
`lesson_plan_versions` mantém o histórico imutável de snapshots completos,
com `source` igual a `ai` ou `manual` e unicidade por
`(lesson_plan_id, version_number)`.

A criação da versão inicial e a criação de versões posteriores ocorrem em
transação. Para versões posteriores, o plano é bloqueado com `SELECT ... FOR
UPDATE` antes do cálculo do próximo número. A foreign key usa `ON DELETE
CASCADE`, portanto as versões são removidas junto com o plano.

## Feedback

`lesson_plan_feedbacks` registra avaliação de 1 a 5, utilidade, uso em aula e
comentário opcional. A constraint `UNIQUE (lesson_plan_id, user_id)` mantém um
feedback por usuário em cada plano; novo envio atualiza o registro existente.
A foreign key usa `ON DELETE CASCADE`, portanto feedbacks são removidos junto
com o plano ou usuário.

## BNCC e pgvector

`bncc_skills` armazena habilidades BNCC em catálogo estruturado. A base inicial
contém poucos registros fictícios para desenvolvimento e não representa uma
carga oficial completa.

`lesson_plan_bncc_skills` registra quais habilidades foram selecionadas ou
recuperadas para um plano. O campo `source` aceita `selected` e `retrieved`.

O desenvolvimento usa a imagem Docker `pgvector/pgvector:pg16`. A coluna
`bncc_skills.embedding` usa `vector(768)`. Os embeddings do seed são
demonstrativos; embeddings reais dependem de `GEMINI_API_KEY` e
`EMBEDDING_MODEL`.

O seed cria o usuário fictício `demo@example.com` com a senha `demo123` para
uso local. Essa credencial não deve ser usada em produção.
