# Modelo de versionamento de planos

## Visão geral

O plano atual fica em `lesson_plans`. Cada alteração futura também será
registrada como um snapshot completo em `lesson_plan_versions`.

```text
lesson_plans
├── estado atual
└── current_version

lesson_plan_versions
├── versão 1 — ai
├── versão 2 — manual
└── versão N — ai ou manual
```

## Snapshot completo

Uma versão contém os campos de identificação pedagógica e o conteúdo JSONB:

```text
tema
nivel_ensino
duracao_minutos
codigo_bncc
content
source
version_number
created_at
```

Isso permite reconstruir uma versão sem depender dos valores atuais de
`lesson_plans`.

## Transações e concorrência

A versão inicial é criada junto com o plano em uma única transação. Para uma
nova versão, o repository executa:

```text
BEGIN
→ SELECT lesson_plans ... FOR UPDATE
→ calcular current_version + 1
→ inserir snapshot
→ atualizar snapshot atual e current_version
→ COMMIT
```

Em caso de erro, a transação é revertida. O bloqueio da linha evita que duas
alterações simultâneas calculem o mesmo número; a constraint única em
`(lesson_plan_id, version_number)` fornece proteção adicional.

## Migração de dados existentes

A migration da 4A cria a versão 1 com `source = 'ai'` para cada plano já
existente, copiando seus campos e preservando a data original de criação.

## Estado da API e da interface

A API já expõe edição manual, histórico, consulta de versão, status e exclusão.
Edições exigem `expectedVersion` e usam `source = 'manual'`.

A interface de edição e histórico ainda não existe; ela será implementada na
4C.
