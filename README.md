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

Os Marcos 2, 3A, 3B, 3C e 3D estão concluídos. O fluxo principal usa
autenticação própria por cookie `httpOnly`, Gemini com JSON estruturado,
PostgreSQL e histórico privado por usuário. O legado do Supabase permanece
isolado em `/api/legacy/*` apenas durante a transição.

O frontend moderno não armazena JWT, não usa Supabase e renderiza a resposta da
IA com `textContent` e elementos DOM. Ainda não há edição, versionamento, RAG,
feedback ou métricas avançadas.
