# Métricas básicas

O endpoint `GET /api/metrics/summary` retorna um resumo privado por usuário.

## Dados utilizados

As métricas usam apenas dados persistidos:

```text
lesson_plans
lesson_plan_versions
lesson_plan_feedbacks
```

Não há métrica inventada para tempo médio de geração porque a aplicação ainda
não persiste latência de IA em tabela própria.

## Campos

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

## Isolamento

Todas as consultas usam `user_id` da sessão. Planos, versões e feedbacks de
outros usuários não entram no resumo.

## Limitações

As métricas são operacionais e simples. Não existe dashboard administrativo,
exportação, análise longitudinal avançada ou segmentação por BNCC nesta fase.
