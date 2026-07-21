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

O Marco 2 cria apenas a extensão `pgcrypto` e a tabela base `users`. As demais
tabelas do produto serão adicionadas junto aos fluxos dos próximos marcos.

O seed cria o usuário fictício `demo@example.com` com a senha `demo123` para
uso local. Essa credencial não deve ser usada em produção.
