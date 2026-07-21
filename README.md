# Copiloto Pedagógico com IA

Aplicação web para criação e gerenciamento de planos de aula com Node.js,
Express, PostgreSQL e Gemini.

## Requisitos

- Node.js 22 ou superior;
- Docker e Docker Compose;
- chave Gemini somente para os fluxos que chamam a IA.

## Desenvolvimento local

```bash
cp .env.example .env
npm ci
docker compose up -d postgres
npm run migrate:up
npm run db:seed
npm start
```

Health check:

```text
GET /health
GET /ready
```

Migrations não são executadas automaticamente pelo processo web.

## Status da modernização

O Marco 2 e a subetapa 3A estão concluídos. A autenticação própria por cookie
`httpOnly` está sendo implementada no Marco 3B. A integração legada com o
Supabase permanece isolada e condicional durante a transição.
