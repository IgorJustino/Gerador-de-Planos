# Pipeline de IA e RAG

## Fluxo atual

```text
dados do professor
→ busca BNCC selecionada ou semântica
→ contexto BNCC recuperado
→ prompt Gemini
→ JSON estruturado
→ validação Zod
→ PostgreSQL
→ rastreabilidade em lesson_plan_bncc_skills
```

## Contexto BNCC

O prompt recebe um bloco:

```text
<contexto_bncc>
Código: EF05CI01
Componente: Ciências
Etapa: Ensino Fundamental
Descrição: ...
Fonte: ...
Origem no sistema: selecionada pelo usuário
</contexto_bncc>
```

A IA deve usar esse contexto como referência pedagógica. O sistema não afirma
que o plano possui validação oficial automática.

## Embeddings

Configuração atual:

```text
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSION=768
EMBEDDING_TIMEOUT_MS=15000
```

O serviço de embeddings usa Gemini quando `GEMINI_API_KEY` está configurada.
Nos testes, embeddings são mockados. O seed local possui embeddings
demonstrativos para permitir busca semântica em desenvolvimento.

## Catálogo

`bncc_skills` contém:

```text
code
education_stage
school_year
subject
thematic_unit
knowledge_object
description
source
source_version
embedding
```

A carga inicial é reduzida e fictícia. A importação de uma fonte oficial e sua
licença ficam para uma etapa específica.

## Rastreamento

`lesson_plan_bncc_skills` registra:

```text
lesson_plan_id
bncc_skill_id
relevance_score
source
```

`source` pode ser:

```text
selected
retrieved
```

## Limitações

Não há upload de documentos, scraping automático da BNCC, RAG sobre PDFs,
catálogo oficial completo, múltiplos provedores de embedding ou reindexação em
lote nesta fase.
