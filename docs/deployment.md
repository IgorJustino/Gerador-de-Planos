# Deploy Render e Neon

## Render Web Service

Configuração esperada:

```text
Build Command: npm ci
Start Command: npm start
Health Check Path: /health
```

O processo web não executa migrations automaticamente. Execute migrations em
uma etapa controlada antes ou durante a promoção da versão.

## Variáveis

```text
NODE_ENV=production
DATABASE_URL
DATABASE_SSL=true
JWT_SECRET
JWT_EXPIRES_IN=8h
COOKIE_NAME=copiloto_session
COOKIE_SECURE=true
COOKIE_SAME_SITE=lax
GEMINI_API_KEY
GEMINI_MODEL
GEMINI_TIMEOUT_MS=30000
GEMINI_MAX_RETRIES=1
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSION=768
EMBEDDING_TIMEOUT_MS=15000
CORS_ORIGIN
```

`JWT_SECRET`, `DATABASE_URL` e `GEMINI_API_KEY` devem ser configurados como
segredos no Render. Não versionar valores reais.

## Neon

Use a `DATABASE_URL` fornecida pelo Neon. Em produção, mantenha
`DATABASE_SSL=true`; o pool usa SSL com `rejectUnauthorized=false`, adequado
para a conexão gerenciada nesta fase do MVP.

## Health e Readiness

```text
GET /health
```

Verifica apenas o processo.

```text
GET /ready
```

Verifica somente a conexão PostgreSQL. Nenhum health check chama Gemini.

## Limitações atuais

Rate limit usa memória do processo, suficiente para MVP em uma instância, mas
não compartilhado entre múltiplas instâncias. RAG, embeddings e `pgvector`
ficam para uma sprint futura de IA avançada.
