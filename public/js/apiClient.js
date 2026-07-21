(function exposeApiClient(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else {
        root.ApiClient = factory(root.fetch.bind(root));
    }
}(typeof window !== 'undefined' ? window : globalThis, function createApiClient(fetchImpl) {
    class ApiError extends Error {
        constructor(message, { status = 0, code = 'NETWORK_ERROR', details = [] } = {}) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
            this.code = code;
            this.details = details;
        }
    }

    let unauthorizedHandler = null;

    async function request(path, options = {}) {
        const {
            skipUnauthorized = false,
            headers: customHeaders = {},
            body,
            ...fetchOptions
        } = options;
        const headers = {
            Accept: 'application/json',
            ...customHeaders,
        };
        let requestBody = body;

        if (body !== undefined && body !== null && typeof body !== 'string') {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            requestBody = JSON.stringify(body);
        }

        let response;
        try {
            response = await fetchImpl(path, {
                ...fetchOptions,
                headers,
                body: requestBody,
                credentials: 'include',
            });
        } catch (_error) {
            throw new ApiError('Não foi possível conectar à API.', { code: 'NETWORK_ERROR' });
        }

        const text = await response.text();
        let payload = null;
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch (_error) {
                payload = null;
            }
        }

        if (!response.ok) {
            const error = new ApiError(
                payload?.error?.message || 'A API não conseguiu concluir a operação.',
                {
                    status: response.status,
                    code: payload?.error?.code || 'HTTP_ERROR',
                    details: payload?.error?.details || [],
                }
            );

            if (response.status === 401 && !skipUnauthorized && unauthorizedHandler) {
                unauthorizedHandler(error);
            }
            throw error;
        }

        return payload;
    }

    return {
        ApiError,
        request,
        setUnauthorizedHandler(handler) {
            unauthorizedHandler = handler;
        },
    };
}));
