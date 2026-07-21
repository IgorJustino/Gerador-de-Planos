(function initializeAppPage() {
    const state = {
        user: null,
        plans: [],
        selectedPlan: null,
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        loading: { session: false, generation: false, history: false, plan: false },
        redirecting: false,
    };

    const form = document.getElementById('formPlanoAula');
    if (!form) return;

    const result = document.getElementById('resultado');
    const submitButton = form.querySelector('button[type="submit"]');
    const userEmail = document.getElementById('userEmail');
    const logoutButton = document.getElementById('btnLogout');
    const historyCard = document.getElementById('planosAnteriores');
    const historyList = document.getElementById('listaPlanos');
    const historyButton = document.getElementById('btnMostrarPlanos');
    const pagination = document.getElementById('pagination');

    function redirectToLogin() {
        if (state.redirecting || window.location.pathname.endsWith('/login.html')) return;
        state.redirecting = true;
        window.location.href = '/login.html?expired=1';
    }

    function errorMessage(error, fallback) {
        const messages = {
            VALIDATION_ERROR: 'Revise os campos informados.',
            RATE_LIMIT_EXCEEDED: 'Limite de gerações atingido. Tente novamente mais tarde.',
            AI_TIMEOUT: 'A geração demorou mais que o esperado. Tente novamente.',
            AI_INVALID_RESPONSE: 'A IA retornou uma resposta inconsistente. Tente novamente.',
            AI_PROVIDER_ERROR: 'O serviço de IA está temporariamente indisponível.',
            AI_CONFIGURATION_ERROR: 'O serviço de IA ainda não está configurado neste ambiente.',
            NETWORK_ERROR: 'Não foi possível conectar à aplicação.',
        };
        return messages[error.code] || error.message || fallback;
    }

    function showError(message) {
        AppUi.showStatus(result, message, 'error');
        result.style.display = 'block';
    }

    function validateForm() {
        const tema = document.getElementById('tema');
        const nivel = document.getElementById('nivelEnsino');
        const duration = document.getElementById('duracao');
        const bncc = document.getElementById('codigoBNCC');
        const context = document.getElementById('contextoAdicional');
        [tema, nivel, duration, bncc, context].forEach((field) => field.setCustomValidity(''));

        if (tema.value.trim().length < 3 || tema.value.trim().length > 200) {
            tema.setCustomValidity('O tema deve ter entre 3 e 200 caracteres.');
        } else if (!nivel.value || nivel.value.trim().length < 2) {
            nivel.setCustomValidity('Selecione um nível de ensino.');
        } else if (!Number.isInteger(Number(duration.value)) || Number(duration.value) < 10 || Number(duration.value) > 300) {
            duration.setCustomValidity('A duração deve ser um número inteiro entre 10 e 300 minutos.');
        } else if (bncc.value.trim() && !/^[A-Za-z]{2}\d{2}[A-Za-z]{2}\d{2}$/.test(bncc.value.trim())) {
            bncc.setCustomValidity('Use um código no formato EF05CI01.');
        } else if (context.value.length > 1000) {
            context.setCustomValidity('O contexto adicional deve ter no máximo 1.000 caracteres.');
        }

        return form.reportValidity();
    }

    function collectFormData() {
        return {
            tema: document.getElementById('tema').value.trim(),
            nivelEnsino: document.getElementById('nivelEnsino').value.trim(),
            duracaoMinutos: Number(document.getElementById('duracao').value),
            codigoBNCC: document.getElementById('codigoBNCC').value.trim() || undefined,
            contextoAdicional: document.getElementById('contextoAdicional').value.trim() || undefined,
        };
    }

    function scrollToResult() {
        result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderPagination() {
        pagination.replaceChildren();
        const { page, totalPages } = state.pagination;
        if (totalPages <= 1) return;

        const previous = document.createElement('button');
        previous.type = 'button';
        previous.className = 'btn-acao btn-ver';
        previous.textContent = 'Anterior';
        previous.disabled = page <= 1 || state.loading.history;
        previous.addEventListener('click', () => loadHistory(page - 1));

        const label = document.createElement('span');
        label.className = 'pagination-label';
        label.textContent = `Página ${page} de ${totalPages}`;

        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'btn-acao btn-ver';
        next.textContent = 'Próxima';
        next.disabled = page >= totalPages || state.loading.history;
        next.addEventListener('click', () => loadHistory(page + 1));

        pagination.append(previous, label, next);
    }

    async function loadHistory(page = 1) {
        if (state.loading.history) return;
        state.loading.history = true;
        historyCard.style.display = 'block';
        AppUi.showLoading(historyList, 'Carregando seus planos...');
        try {
            const payload = await ApiClient.request(`/api/planos?page=${page}&limit=${state.pagination.limit}`);
            state.plans = payload?.items || [];
            state.pagination = payload?.pagination || { page, limit: 10, total: 0, totalPages: 0 };
            LessonPlanRenderer.renderPlanList(historyList, state.plans, openPlan);
        } catch (error) {
            if (error.status === 401) return;
            AppUi.showStatus(historyList, errorMessage(error, 'Não foi possível carregar o histórico.'), 'error');
        } finally {
            state.loading.history = false;
            renderPagination();
        }
    }

    async function openPlan(id) {
        if (state.loading.plan) return;
        state.loading.plan = true;
        AppUi.showLoading(result, 'Carregando plano...');
        try {
            const payload = await ApiClient.request(`/api/planos/${encodeURIComponent(id)}`);
            state.selectedPlan = payload?.plano || null;
            if (!state.selectedPlan) throw new Error('Plano não encontrado.');
            LessonPlanRenderer.renderLessonPlan(result, state.selectedPlan);
            scrollToResult();
        } catch (error) {
            if (error.status !== 401) showError(errorMessage(error, 'Plano não encontrado.'));
        } finally {
            state.loading.plan = false;
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (state.loading.generation || !validateForm()) return;

        state.loading.generation = true;
        AppUi.setBusy(submitButton, true, 'Gerando...', 'Gerar Plano de Aula');
        AppUi.showLoading(result, 'A IA está preparando seu plano de aula...');
        scrollToResult();

        try {
            const payload = await ApiClient.request('/api/planos/gerar', {
                method: 'POST',
                body: collectFormData(),
            });
            state.selectedPlan = payload?.plano || null;
            if (!state.selectedPlan) throw new Error('A API não retornou o plano gerado.');
            LessonPlanRenderer.renderLessonPlan(result, state.selectedPlan);
            const notice = document.createElement('div');
            notice.className = 'api-message success';
            notice.setAttribute('role', 'status');
            notice.textContent = 'Plano gerado e salvo com sucesso.';
            result.prepend(notice);
            await loadHistory(1);
            scrollToResult();
        } catch (error) {
            if (error.status !== 401) showError(errorMessage(error, 'Não foi possível gerar o plano.'));
        } finally {
            state.loading.generation = false;
            AppUi.setBusy(submitButton, false, 'Gerando...', 'Gerar Plano de Aula');
        }
    }

    async function handleLogout() {
        if (state.loading.session) return;
        state.loading.session = true;
        AppUi.setBusy(logoutButton, true, 'Saindo...', 'Sair');
        try {
            await ApiClient.request('/api/auth/logout', { skipUnauthorized: true, method: 'POST' });
        } finally {
            window.location.href = '/login.html';
        }
    }

    async function init() {
        state.loading.session = true;
        try {
            const payload = await ApiClient.request('/api/auth/me', { skipUnauthorized: true });
            if (!payload?.user) return redirectToLogin();
            state.user = payload.user;
            userEmail.textContent = state.user.email;
            historyCard.style.display = 'block';
            historyButton.textContent = '🔽 Ocultar Planos Anteriores';
            await loadHistory(1);
        } catch (_error) {
            redirectToLogin();
        } finally {
            state.loading.session = false;
        }
    }

    ApiClient.setUnauthorizedHandler(redirectToLogin);
    form.addEventListener('submit', handleSubmit);
    logoutButton.addEventListener('click', handleLogout);
    historyButton.addEventListener('click', () => {
        const visible = historyCard.style.display !== 'none';
        historyCard.style.display = visible ? 'none' : 'block';
        historyButton.textContent = visible ? '📚 Ver Meus Planos Anteriores' : '🔽 Ocultar Planos Anteriores';
        if (!visible && state.plans.length === 0) loadHistory(1);
    });

    document.getElementById('duracao').addEventListener('input', validateForm);
    document.getElementById('codigoBNCC').addEventListener('input', (event) => {
        event.target.value = event.target.value.toUpperCase();
    });
    document.addEventListener('DOMContentLoaded', init);
}());
