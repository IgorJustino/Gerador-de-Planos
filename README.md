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

Os Marcos 2, 3A, 3B, 3C, 3D, 3E, 4A, 4B e 4C estão concluídos. O fluxo principal usa
autenticação própria por cookie `httpOnly`, Gemini com JSON estruturado,
PostgreSQL, histórico privado por usuário e versionamento transacional. O
legado do Supabase foi removido da arquitetura ativa.

O frontend moderno não armazena JWT, não usa Supabase e renderiza a resposta da
IA com `textContent` e elementos DOM. A interface permite editar planos,
salvar novas versões manuais, consultar snapshots anteriores, alterar status,
excluir planos com confirmação, filtrar o histórico, registrar feedback e ver
um resumo básico de uso. Ainda não há RAG, embeddings, `pgvector` ou
exportação.

## API

Os endpoints estão documentados em [`docs/API.md`](docs/API.md). As operações
de edição exigem `expectedVersion` e criam snapshots manuais sem sobrescrever
o histórico anterior. Deploy e métricas estão documentados em
[`docs/deployment.md`](docs/deployment.md) e [`docs/metrics.md`](docs/metrics.md).
