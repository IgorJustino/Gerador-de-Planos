const assert = require('node:assert/strict');
const test = require('node:test');

const createApiClient = require('../../public/js/apiClient');

function response(status, payload) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
            return payload === null ? '' : JSON.stringify(payload);
        },
    };
}

test('cliente HTTP envia cookie de sessão e serializa body JSON', async () => {
    let request;
    const api = createApiClient(async (_path, options) => {
        request = options;
        return response(200, { user: { id: 'user-1' } });
    });

    const payload = await api.request('/api/auth/me', {
        method: 'POST',
        body: { nome: 'Maria' },
    });

    assert.deepEqual(payload, { user: { id: 'user-1' } });
    assert.equal(request.credentials, 'include');
    assert.equal(request.headers['Content-Type'], 'application/json');
    assert.equal(request.body, JSON.stringify({ nome: 'Maria' }));
});

test('cliente HTTP normaliza 401 e chama handler de sessão expirada', async () => {
    let unauthorized = null;
    const api = createApiClient(async () => response(401, {
        error: { code: 'UNAUTHORIZED', message: 'Autenticação necessária' },
    }));
    api.setUnauthorizedHandler((error) => { unauthorized = error; });

    await assert.rejects(
        api.request('/api/planos'),
        (error) => error.status === 401 && error.code === 'UNAUTHORIZED'
    );
    assert.equal(unauthorized.status, 401);
});

test('cliente HTTP preserva código de rate limit e trata 204 sem body', async () => {
    const rateLimited = createApiClient(async () => response(429, {
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Tente depois' },
    }));
    await assert.rejects(
        rateLimited.request('/api/planos/gerar'),
        (error) => error.status === 429 && error.code === 'RATE_LIMIT_EXCEEDED'
    );

    const logout = createApiClient(async () => response(204, null));
    assert.equal(await logout.request('/api/auth/logout'), null);
});
