const { GoogleGenerativeAI } = require('@google/generative-ai');

const AppError = require('../utils/AppError');

function createEmbeddingError(message, statusCode, code, cause) {
  const error = new AppError(message, statusCode, code);
  if (cause) error.cause = cause;
  return error;
}

function createDefaultProvider(env) {
  if (!env.geminiApiKey || !env.embeddingModel) {
    return null;
  }

  const client = new GoogleGenerativeAI(env.geminiApiKey);
  const model = client.getGenerativeModel({ model: env.embeddingModel });

  return {
    async embed(text) {
      const result = await model.embedContent(text);
      return result.embedding.values;
    },
  };
}

function normalizeEmbeddingInput(text) {
  return String(text || '').trim().replace(/\s+/g, ' ').slice(0, 2000);
}

function createEmbeddingService({ env, provider } = {}) {
  let activeProvider = provider;

  function getProvider() {
    if (!activeProvider) {
      activeProvider = createDefaultProvider(env);
    }

    if (!activeProvider) {
      throw createEmbeddingError('Serviço de embeddings não configurado.', 503, 'EMBEDDING_CONFIGURATION_ERROR');
    }

    return activeProvider;
  }

  async function runWithTimeout(operation) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(createEmbeddingError('Geração de embedding excedeu o tempo limite.', 504, 'EMBEDDING_TIMEOUT'));
      }, env.embeddingTimeoutMs || 15000);
    });

    try {
      return await Promise.race([operation(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  async function generateEmbedding(text) {
    const input = normalizeEmbeddingInput(text);
    if (!input) {
      throw createEmbeddingError('Texto de embedding vazio.', 400, 'EMBEDDING_INVALID_INPUT');
    }

    try {
      const embedding = await runWithTimeout(() => getProvider().embed(input));
      if (!Array.isArray(embedding) || embedding.length !== env.embeddingDimension) {
        throw createEmbeddingError('Dimensão de embedding incompatível.', 502, 'EMBEDDING_INVALID_RESPONSE');
      }
      return embedding.map(Number);
    } catch (error) {
      if (error.code?.startsWith('EMBEDDING_')) throw error;
      throw createEmbeddingError('Não foi possível gerar embedding.', 502, 'EMBEDDING_PROVIDER_ERROR', error);
    }
  }

  return {
    generateEmbedding,
    normalizeEmbeddingInput,
  };
}

module.exports = {
  createEmbeddingService,
  normalizeEmbeddingInput,
};
