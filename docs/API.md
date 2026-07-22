# API moderna

As rotas abaixo exigem o cookie de sessão `httpOnly`, exceto `/health` e
`/ready`. O `userId` nunca é recebido do cliente: a autorização usa o usuário
extraído da sessão.

## Planos

### Gerar plano

```text
POST /api/planos/gerar
```

Cria o plano e a versão 1 com `source = ai`.

### Consultar planos

```text
GET /api/planos?page=1&limit=20
GET /api/planos/:id
```

Filtros aceitos na listagem:

```text
status=draft|reviewed|approved|archived
nivelEnsino=texto
codigoBNCC=texto
tema=texto
sort=created_desc|created_asc|updated_desc|updated_asc
```

Todos os filtros são combinados com `user_id` da sessão. Busca por `tema`,
`nivelEnsino` e `codigoBNCC` usa correspondência parcial parametrizada.

### Editar plano

```text
PATCH /api/planos/:id
```

Body:

```json
{
  "tema": "Fotossíntese revisada",
  "expectedVersion": 1
}
```

Os campos editáveis são `tema`, `nivelEnsino`, `duracaoMinutos`, `codigoBNCC`
e `conteudo`. Todos são opcionais, mas pelo menos um deve ser enviado além de
`expectedVersion`. Para remover o código BNCC, enviar explicitamente
`"codigoBNCC": null`.

Uma edição bem-sucedida cria uma versão completa com `source = manual`.

Se `expectedVersion` estiver desatualizado:

```http
409 Conflict
```

```json
{
  "error": {
    "code": "VERSION_CONFLICT",
    "message": "O plano foi alterado em outra sessão. Atualize os dados antes de salvar novamente."
  }
}
```

### Histórico de versões

```text
GET /api/planos/:id/versoes?page=1&limit=20
GET /api/planos/:id/versoes/:versionNumber
```

As versões são retornadas da mais recente para a mais antiga. O acesso é
filtrado pelo usuário autenticado; plano ou versão de outro usuário retorna
404.

### Status

```text
PATCH /api/planos/:id/status
```

Body:

```json
{
  "status": "reviewed"
}
```

Valores aceitos: `draft`, `reviewed`, `approved` e `archived`. Status não cria
uma nova versão de conteúdo. Transições inválidas retornam `409` com o código
`INVALID_STATUS_TRANSITION`.

### Exclusão

```text
DELETE /api/planos/:id
```

Retorna `204 No Content`. As versões são removidas pelo `ON DELETE CASCADE`.
Plano inexistente ou pertencente a outro usuário retorna `404`.

## Feedback

```text
GET  /api/planos/:id/feedback
POST /api/planos/:id/feedback
```

Body:

```json
{
  "rating": 5,
  "useful": true,
  "usedInClass": false,
  "comment": "Plano bem estruturado."
}
```

Cada usuário pode manter um feedback por plano próprio. Novo envio atualiza o
registro existente. Feedback não cria versão e não altera status.

## Métricas

```text
GET /api/metrics/summary
```

Retorna somente dados do usuário autenticado:

```text
totalPlanos
planosPorStatus
totalVersoes
mediaVersoesPorPlano
totalFeedbacks
notaMedia
percentualUteis
planosUltimos7Dias
ultimosPlanos
```

## Erros comuns

```text
400 VALIDATION_ERROR
400 INVALID_PLAN_DURATION
401 UNAUTHORIZED
404 PLAN_NOT_FOUND ou VERSION_NOT_FOUND
409 VERSION_CONFLICT ou INVALID_STATUS_TRANSITION
429 RATE_LIMIT_EXCEEDED
```

O frontend do Marco 4C consome estes endpoints para edição, histórico de
versões, alteração de status e exclusão. Restauração dedicada de versões ainda
não foi implementada.
