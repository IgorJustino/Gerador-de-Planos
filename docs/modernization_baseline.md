# Baseline da modernização

## Escopo e data

Esta baseline descreve o estado observado no repositório em 21/07/2026.
Ela é uma fotografia do sistema existente e não representa a arquitetura
alvo.

A instância antiga do Supabase foi considerada indisponível. Não foi feita
alteração funcional nesta etapa.

## 1. Estrutura atual

| Pasta/arquivo | Responsabilidade observada | Situação |
| --- | --- | --- |
| `src/server.js` | Criação da aplicação Express, middlewares, rotas, health check e inicialização | Monolítico; será refatorado |
| `src/routes/planoRoutes.js` | Geração, listagem, consulta, exclusão e histórico de planos | Funcionalidade concentrada em uma rota |
| `src/middleware/auth.js` | Validação de JWT pelo Supabase e criação/consulta de usuário | Acoplado ao Supabase |
| `src/services/geminiService.js` | Chamada ao Gemini, construção de prompt e parsing da resposta | Parsing textual por regex |
| `src/services/supabaseService.js` | Operações de usuários, planos e histórico | SDK do Supabase |
| `public/index.html` | Formulário de geração, resultado e lista de planos | Frontend sem build |
| `public/login.html` | Login e cadastro | Frontend sem build |
| `public/js/app.js` | Sessão, chamadas da API e renderização de planos | Usa Supabase diretamente |
| `public/js/auth.js` | Login, cadastro e sessão | Usa Supabase diretamente |
| `public/css/` | Estilos da aplicação e autenticação | Preservar inicialmente |
| `supabase/migrations/` | Schema, RLS, índices, triggers e correções do Supabase | Não reutilizar como migrations do Neon sem reescrita |
| `render.yaml` | Configuração de deploy no Render | Ainda exige variáveis do Supabase |
| `.env.example` | Variáveis de ambiente da versão antiga | Precisa ser substituído no Marco 2 |
| `README.md` | Documentação principal | Contém apenas `algo`; divergente/incompleto |
| `CONTRIBUTING.md`, `CHANGELOG.md` | Documentação histórica e operacional | Referem Supabase, Vercel e funcionalidades antigas |
| `CRIAR_TABELAS_CLOUD.md`, `aplicar-tabelas-cloud.sh` | Operação manual do Supabase Cloud | Avaliar remoção após a migração |
| `package.json` | Dependências e scripts | Sem lockfile, testes, lint ou migrations |

Não existem atualmente `api/index.js`, `docs/`, `tests/`, `database/`,
`Dockerfile` ou `docker-compose.yml` versionados.

## 2. Fluxos atuais

### Cadastro e login

Arquivos principais: `public/login.html`, `public/js/auth.js`,
`src/middleware/auth.js` e `src/services/supabaseService.js`.

O navegador chama o Supabase Auth diretamente. Depois do login, consulta ou
cria um registro na tabela `usuarios` e salva o token em `localStorage`.
O backend valida o token pelo Supabase em requisições protegidas.

Estado: acoplado ao projeto Supabase desativado; não deve ser considerado
operacional até ser validado com um ambiente ativo.

### Geração de plano

Endpoint atual: `POST /api/planos/gerar`.

O frontend envia `tema`, `nivelEnsino`, `duracaoMinutos`, `codigoBNCC`,
`observacoes` e `disciplina`. O backend faz validações manuais, chama o
Gemini, salva o plano em `planos_aula` e registra a geração em
`historico_geracoes`.

A resposta do Gemini é texto livre com quatro títulos. O serviço extrai as
seções por regex e a rota persiste campos textuais separados.

Estado: o fluxo existe, mas depende de Supabase, de credenciais externas e de
um formato frágil de resposta do Gemini.

### Listagem, consulta e exclusão

Endpoints atuais:

```text
GET    /api/planos
GET    /api/planos/:id
DELETE /api/planos/:id
GET    /api/planos/historico
```

O filtro de posse usa o usuário autenticado e as políticas RLS do Supabase.
O frontend possui a lista de planos anteriores, mas não há versionamento nem
edição estruturada.

Risco confirmado: `GET /:id` está declarado antes de `GET /historico` em
`src/routes/planoRoutes.js`; a rota específica deve ser declarada antes da
rota parametrizada.

### Logout

O frontend encerra a sessão pelo Supabase e remove valores do `localStorage`.
O comportamento futuro será substituído por limpeza do cookie de sessão.

### Health check

`GET /health` verifica Supabase e Gemini, inclusive realizando chamada ao
Gemini. Isso mistura saúde do processo com disponibilidade de serviços
externos e pode consumir quota. O desenho futuro separará `/health` e
`/ready`, sem chamada de IA em nenhum health check.

## 3. Integrações e acoplamentos

| Integração | Arquivos | Observação |
| --- | --- | --- |
| Supabase Auth e banco | `src/middleware/auth.js`, `src/services/supabaseService.js`, `src/routes/planoRoutes.js` | Backend usa SDK, RLS e cliente autenticado por requisição |
| Supabase no navegador | `public/index.html`, `public/login.html`, `public/js/app.js`, `public/js/auth.js` | CDN, URL e chave pública estão embutidos no frontend |
| Gemini | `src/services/geminiService.js`, `src/server.js`, `src/routes/planoRoutes.js` | Prompt e parsing ficam no serviço; health também chama a API |
| Render | `render.yaml` | Usa Node runtime e `npm install`; ainda configura Supabase |
| Supabase local/cloud | `supabase/`, `CRIAR_TABELAS_CLOUD.md`, `aplicar-tabelas-cloud.sh`, `CONTRIBUTING.md` | Documentação e migrations dependem de RLS/Auth do Supabase |
| Ambiente | `.env.example`, `src/server.js`, serviços | Variáveis são lidas diretamente em múltiplos módulos |

Não foram encontrados valores de `GEMINI_API_KEY` reais no repositório. Há,
contudo, chaves/URLs públicas ou de exemplo do Supabase em arquivos
versionados e logs que exibem informações de sessão parcialmente.

## 4. Problemas confirmados

| Severidade | Problema | Evidência/impacto |
| --- | --- | --- |
| Crítico | Persistência e autenticação dependem do Supabase desativado | Impede os fluxos protegidos e de gravação no ambiente antigo |
| Alto | Token é mantido no `localStorage` | Aumenta impacto de XSS; será substituído por cookie `httpOnly` |
| Alto | Frontend acessa o Supabase diretamente | Impede a substituição do provedor sem reescrever os dois fluxos |
| Alto | Gemini usa parsing por regex | Resposta válida pode ser rejeitada ou persistida incompleta |
| Alto | Rota parametrizada precede `/historico` | Pode capturar a rota específica como `id` |
| Alto | Health check chama Gemini | Pode consumir quota e indicar indisponibilidade externa como falha do processo |
| Alto | Erros e logs podem expor detalhes internos | Rotas concatenam mensagens de erro; logs incluem email, entradas e partes de tokens |
| Médio | `src/server.js` concentra responsabilidades | Dificulta testes, reuso e evolução da API |
| Médio | Validação está espalhada e é manual | Não há contrato compartilhado entre frontend, API e banco |
| Médio | Migrations usam RLS e funções próprias do Supabase | Não são portáveis diretamente para PostgreSQL/Neon com auth própria |
| Médio | Não há lockfile e o `.gitignore` o exclui | `npm ci` e builds reproduzíveis não estão disponíveis; o Marco 2 deverá ajustar essa regra |
| Médio | Não há testes, lint ou formatter configurados | Regressões não têm barreira automatizada |
| Médio | Deploy ainda referencia Supabase | `render.yaml` não corresponde à arquitetura alvo |
| Baixo | Documentação está divergente ou incompleta | `README.md` está incompleto; documentos históricos citam Vercel/Supabase |
| Baixo | Há scripts e guias operacionais da infraestrutura antiga | Devem ser classificados antes de remoção |

## 5. Classificação de arquivos

| Arquivo/pasta | Ação futura | Justificativa |
| --- | --- | --- |
| `src/server.js` | Refatorar | Deve apenas iniciar o servidor |
| `src/routes/planoRoutes.js` | Refatorar | Separar controllers, services, repositories e schemas |
| `src/middleware/auth.js` | Reescrever | Substituir verificação Supabase por sessão própria |
| `src/services/supabaseService.js` | Remover futuramente | Será substituído por pool/repositories PostgreSQL |
| `src/services/geminiService.js` | Refatorar | Manter integração, trocar contrato e parsing por JSON estruturado |
| `public/index.html`, `public/login.html` | Preservar inicialmente | Interface pode continuar na primeira versão |
| `public/js/app.js`, `public/js/auth.js` | Refatorar | Remover Supabase direto e adaptar para cookies/API própria |
| `public/css/` | Preservar | Não há necessidade de redesenho inicial |
| `supabase/migrations/` | Avaliar/remover futuramente | São histórico da infraestrutura antiga; não migrar automaticamente |
| `supabase/config.toml` | Avaliar/remover futuramente | Só é necessário se o Supabase continuar no desenvolvimento |
| `render.yaml` | Refatorar | Trocar variáveis, comando de build e health/readiness conforme necessário |
| `.env.example` | Refatorar no Marco 2 | Deve refletir `DATABASE_URL`, JWT e configurações novas |
| `package.json` | Refatorar no Marco 2 | Adicionar dependências/scripts e gerar lockfile versionado |
| `README.md` | Reescrever no Marco 6 | A documentação atual não representa o produto |
| `CONTRIBUTING.md`, `CHANGELOG.md` | Atualizar no Marco 6 | Preservar histórico útil, remover instruções obsoletas |
| `CRIAR_TABELAS_CLOUD.md` | Remover futuramente ou arquivar | Guia específico do Supabase Cloud desativado |
| `aplicar-tabelas-cloud.sh` | Remover futuramente | Script operacional da infraestrutura antiga |
| `docs/modernization_baseline.md` | Preservar | Registro desta auditoria |
| `docs/decisions.md` | Preservar | Registro das decisões arquiteturais |

## 6. Pendências para os próximos marcos

- Definir política de CSRF para operações autenticadas por cookie.
- Definir estratégia de logout e invalidação de JWT roubado.
- Definir necessidade de verificação de email e recuperação de senha.
- Escolher ferramenta e configuração de teste com PostgreSQL isolado.
- Definir fonte, versão e licença dos dados BNCC.
- Definir modelo e dimensão dos embeddings antes de criar a coluna vetorial.
- Definir limites de timeout, retry e rate limit da geração.
- Definir política de CORS para o frontend servido pelo próprio Render.
