(function initializeAppPage() {
    const state = {
        user: null,
        plans: [],
        selectedPlan: null,
        viewedVersion: null,
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        versionsPagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        filters: { tema: '', status: '', nivelEnsino: '', codigoBNCC: '', sort: 'created_desc' },
        loading: {
            session: false,
            generation: false,
            history: false,
            plan: false,
            edit: false,
            versions: false,
            status: false,
            delete: false,
            feedback: false,
            metrics: false,
        },
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
    const metricsCard = document.getElementById('metricsCard');
    const metricsSummary = document.getElementById('metricsSummary');
    const planManagement = document.getElementById('planManagement');
    const planVersionInfo = document.getElementById('planVersionInfo');
    const planActionMessage = document.getElementById('planActionMessage');
    const editButton = document.getElementById('btnEditarPlano');
    const versionsButton = document.getElementById('btnVersoesPlano');
    const deleteButton = document.getElementById('btnExcluirPlano');
    const statusSelect = document.getElementById('statusPlano');
    const saveStatusButton = document.getElementById('btnSalvarStatus');
    const editPanel = document.getElementById('editPanel');
    const unsavedNotice = document.getElementById('unsavedNotice');
    const editForm = document.getElementById('formEditarPlano');
    const cancelEditButton = document.getElementById('btnCancelarEdicao');
    const saveEditButton = document.getElementById('btnSalvarEdicao');
    const versionsPanel = document.getElementById('versionsPanel');
    const versionsList = document.getElementById('versionsList');
    const versionsPagination = document.getElementById('versionsPagination');
    const closeVersionsButton = document.getElementById('btnFecharVersoes');
    const feedbackPanel = document.getElementById('feedbackPanel');
    const feedbackForm = document.getElementById('formFeedback');
    const feedbackRating = document.getElementById('feedbackRating');
    const feedbackUseful = document.getElementById('feedbackUseful');
    const feedbackUsedInClass = document.getElementById('feedbackUsedInClass');
    const feedbackComment = document.getElementById('feedbackComment');
    const saveFeedbackButton = document.getElementById('btnSalvarFeedback');
    const feedbackMessage = document.getElementById('feedbackMessage');
    const filtersForm = document.getElementById('formFiltros');
    const clearFiltersButton = document.getElementById('btnLimparFiltros');

    function redirectToLogin() {
        if (state.redirecting || window.location.pathname.endsWith('/login.html')) return;
        state.redirecting = true;
        window.location.href = '/login.html?expired=1';
    }

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function errorMessage(error, fallback) {
        const messages = {
            VALIDATION_ERROR: 'Revise os campos informados.',
            INVALID_PLAN_DURATION: 'A soma das etapas não é compatível com a duração total.',
            VERSION_CONFLICT: 'O plano foi alterado em outra sessão. Recarregue o plano antes de salvar.',
            INVALID_STATUS_TRANSITION: 'Essa transição de status não é permitida.',
            RATE_LIMIT_EXCEEDED: 'Limite de gerações atingido. Tente novamente mais tarde.',
            AI_TIMEOUT: 'A geração demorou mais que o esperado. Tente novamente.',
            AI_INVALID_RESPONSE: 'A IA retornou uma resposta inconsistente. Tente novamente.',
            AI_PROVIDER_ERROR: 'O serviço de IA está temporariamente indisponível.',
            AI_CONFIGURATION_ERROR: 'O serviço de IA ainda não está configurado neste ambiente.',
            NETWORK_ERROR: 'Não foi possível conectar à aplicação.',
            PLAN_NOT_FOUND: 'Plano não encontrado.',
            VERSION_NOT_FOUND: 'Versão não encontrada.',
        };
        return messages[error.code] || error.message || fallback;
    }

    function showError(message) {
        AppUi.showStatus(result, message, 'error');
        result.style.display = 'block';
    }

    function showActionMessage(message, type = 'info') {
        AppUi.showStatus(planActionMessage, message, type);
    }

    function clearActionMessage() {
        planActionMessage.replaceChildren();
    }

    function showFeedbackMessage(message, type = 'info') {
        AppUi.showStatus(feedbackMessage, message, type);
    }

    function buildQuery(params) {
        const search = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                search.set(key, value);
            }
        });
        return search.toString();
    }

    function readFilters() {
        return {
            tema: document.getElementById('filterTema').value.trim(),
            status: document.getElementById('filterStatus').value,
            nivelEnsino: document.getElementById('filterNivel').value.trim(),
            codigoBNCC: document.getElementById('filterBNCC').value.trim().toUpperCase(),
            sort: document.getElementById('filterSort').value || 'created_desc',
        };
    }

    function resetFilters() {
        document.getElementById('filterTema').value = '';
        document.getElementById('filterStatus').value = '';
        document.getElementById('filterNivel').value = '';
        document.getElementById('filterBNCC').value = '';
        document.getElementById('filterSort').value = 'created_desc';
        state.filters = readFilters();
    }

    function renderMetric(label, value) {
        const item = element('div', 'metric-item');
        item.append(
            element('p', 'metric-label', label),
            element('p', 'metric-value', value === null || value === undefined ? '-' : value)
        );
        return item;
    }

    function renderMetrics(metrics) {
        metricsSummary.replaceChildren(
            renderMetric('Planos', metrics.totalPlanos || 0),
            renderMetric('Aprovados', metrics.planosPorStatus?.approved || 0),
            renderMetric('Versões', metrics.totalVersoes || 0),
            renderMetric('Nota média', metrics.notaMedia ?? '-'),
            renderMetric('Úteis', metrics.percentualUteis === null ? '-' : `${metrics.percentualUteis}%`),
            renderMetric('Últimos 7 dias', metrics.planosUltimos7Dias || 0)
        );
        metricsCard.hidden = false;
    }

    async function loadMetrics() {
        if (state.loading.metrics) return;
        state.loading.metrics = true;
        try {
            const payload = await ApiClient.request('/api/metrics/summary');
            renderMetrics(payload?.metrics || {});
        } catch (error) {
            if (error.status !== 401) {
                metricsCard.hidden = false;
                AppUi.showStatus(metricsSummary, errorMessage(error, 'Não foi possível carregar o resumo.'), 'error');
            }
        } finally {
            state.loading.metrics = false;
        }
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

    function activePlan() {
        return state.selectedPlan;
    }

    function setManagementVisible(visible) {
        planManagement.hidden = !visible;
        if (!visible) clearActionMessage();
    }

    function renderPlanManagement() {
        const plan = activePlan();
        if (!plan) {
            setManagementVisible(false);
            feedbackPanel.hidden = true;
            editPanel.hidden = true;
            versionsPanel.hidden = true;
            return;
        }

        const normalized = LessonPlanRenderer.normalizePlan(plan);
        const versionLabel = state.viewedVersion
            ? `Visualizando versão ${state.viewedVersion.versionNumber}. Atual: ${normalized.versaoAtual || 1}.`
            : `Versão atual: ${normalized.versaoAtual || 1}.`;

        setManagementVisible(true);
        feedbackPanel.hidden = false;
        planVersionInfo.textContent = versionLabel;
        statusSelect.value = normalized.status || 'draft';
    }

    function renderSelectedPlan(plan, { viewedVersion = null } = {}) {
        state.selectedPlan = plan;
        state.viewedVersion = viewedVersion;
        LessonPlanRenderer.renderLessonPlan(result, plan);
        renderPlanManagement();
        loadFeedback();
        scrollToResult();
    }

    function renderPagination() {
        pagination.replaceChildren();
        const { page, totalPages } = state.pagination;
        if (totalPages <= 1) return;

        const previous = element('button', 'btn-acao btn-ver', 'Anterior');
        previous.type = 'button';
        previous.disabled = page <= 1 || state.loading.history;
        previous.addEventListener('click', () => loadHistory(page - 1));

        const label = element('span', 'pagination-label', `Página ${page} de ${totalPages}`);

        const next = element('button', 'btn-acao btn-ver', 'Próxima');
        next.type = 'button';
        next.disabled = page >= totalPages || state.loading.history;
        next.addEventListener('click', () => loadHistory(page + 1));

        pagination.append(previous, label, next);
    }

    function renderVersionsPagination() {
        versionsPagination.replaceChildren();
        const { page, totalPages } = state.versionsPagination;
        if (totalPages <= 1) return;

        const previous = element('button', 'btn-acao btn-ver', 'Anterior');
        previous.type = 'button';
        previous.disabled = page <= 1 || state.loading.versions;
        previous.addEventListener('click', () => loadVersions(page - 1));

        const label = element('span', 'pagination-label', `Página ${page} de ${totalPages}`);

        const next = element('button', 'btn-acao btn-ver', 'Próxima');
        next.type = 'button';
        next.disabled = page >= totalPages || state.loading.versions;
        next.addEventListener('click', () => loadVersions(page + 1));

        versionsPagination.append(previous, label, next);
    }

    async function loadHistory(page = 1) {
        if (state.loading.history) return;
        state.loading.history = true;
        historyCard.style.display = 'block';
        AppUi.showLoading(historyList, 'Carregando seus planos...');
        try {
            const query = buildQuery({
                page,
                limit: state.pagination.limit,
                ...state.filters,
            });
            const payload = await ApiClient.request(`/api/planos?${query}`);
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
        editPanel.hidden = true;
        AppUi.showLoading(result, 'Carregando plano...');
        try {
            const payload = await ApiClient.request(`/api/planos/${encodeURIComponent(id)}`);
            const plan = payload?.plano || null;
            if (!plan) throw new Error('Plano não encontrado.');
            renderSelectedPlan(plan);
            clearActionMessage();
        } catch (error) {
            if (error.status !== 401) showError(errorMessage(error, 'Plano não encontrado.'));
        } finally {
            state.loading.plan = false;
        }
    }

    function setEditValue(id, value) {
        document.getElementById(id).value = value || '';
    }

    function openEditPanel() {
        const plan = activePlan();
        if (!plan) return;
        const draft = LessonPlanEditor.createDraftFromPlan(plan);
        setEditValue('editTema', draft.tema);
        setEditValue('editNivelEnsino', draft.nivelEnsino);
        setEditValue('editDuracao', draft.duracaoMinutos);
        setEditValue('editCodigoBNCC', draft.codigoBNCC);
        setEditValue('editTitulo', draft.conteudo.titulo);
        setEditValue('editResumo', draft.conteudo.resumo);
        setEditValue('editObjetivos', draft.conteudo.objetivos);
        setEditValue('editMetodologia', draft.conteudo.metodologia);
        setEditValue('editRecursos', draft.conteudo.recursos);
        setEditValue('editEtapas', draft.conteudo.etapas);
        setEditValue('editAvaliacao', draft.conteudo.avaliacao);
        setEditValue('editAdaptacoes', draft.conteudo.adaptacoes);
        setEditValue('editHabilidadesBNCC', draft.conteudo.habilidadesBNCC);
        editPanel.hidden = false;
        unsavedNotice.hidden = true;
        clearActionMessage();
        editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function collectEditDraft() {
        return {
            tema: document.getElementById('editTema').value,
            nivelEnsino: document.getElementById('editNivelEnsino').value,
            duracaoMinutos: Number(document.getElementById('editDuracao').value),
            codigoBNCC: document.getElementById('editCodigoBNCC').value,
            conteudo: {
                titulo: document.getElementById('editTitulo').value,
                resumo: document.getElementById('editResumo').value,
                objetivos: document.getElementById('editObjetivos').value,
                metodologia: document.getElementById('editMetodologia').value,
                recursos: document.getElementById('editRecursos').value,
                etapas: document.getElementById('editEtapas').value,
                avaliacao: document.getElementById('editAvaliacao').value,
                adaptacoes: document.getElementById('editAdaptacoes').value,
                habilidadesBNCC: document.getElementById('editHabilidadesBNCC').value,
            },
        };
    }

    async function saveEdit(event) {
        event.preventDefault();
        const plan = activePlan();
        if (!plan || state.loading.edit) return;

        const update = LessonPlanEditor.buildUpdatePayload(plan, collectEditDraft());
        if (!update.valid) {
            AppUi.showStatus(planActionMessage, update.errors.join(' '), 'error');
            planManagement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }

        state.loading.edit = true;
        AppUi.setBusy(saveEditButton, true, 'Salvando...', 'Salvar nova versão');
        try {
            const payload = await ApiClient.request(`/api/planos/${encodeURIComponent(plan.id)}`, {
                method: 'PATCH',
                body: update.payload,
            });
            editPanel.hidden = true;
            unsavedNotice.hidden = true;
            renderSelectedPlan(payload.plano);
            showActionMessage('Nova versão salva com sucesso.', 'success');
            await loadHistory(state.pagination.page);
            await loadMetrics();
            if (!versionsPanel.hidden) await loadVersions(state.versionsPagination.page);
        } catch (error) {
            if (error.status !== 401) showActionMessage(errorMessage(error, 'Não foi possível salvar a edição.'), 'error');
        } finally {
            state.loading.edit = false;
            AppUi.setBusy(saveEditButton, false, 'Salvando...', 'Salvar nova versão');
        }
    }

    async function saveStatus() {
        const plan = activePlan();
        if (!plan || state.loading.status) return;

        state.loading.status = true;
        AppUi.setBusy(saveStatusButton, true, 'Salvando...', 'Salvar status');
        try {
            const payload = await ApiClient.request(`/api/planos/${encodeURIComponent(plan.id)}/status`, {
                method: 'PATCH',
                body: { status: statusSelect.value },
            });
            renderSelectedPlan(payload.plano);
            showActionMessage('Status atualizado.', 'success');
            await loadHistory(state.pagination.page);
            await loadMetrics();
        } catch (error) {
            if (error.status !== 401) {
                statusSelect.value = LessonPlanRenderer.normalizePlan(plan).status || 'draft';
                showActionMessage(errorMessage(error, 'Não foi possível alterar o status.'), 'error');
            }
        } finally {
            state.loading.status = false;
            AppUi.setBusy(saveStatusButton, false, 'Salvando...', 'Salvar status');
        }
    }

    function renderVersions(items) {
        versionsList.replaceChildren();
        if (!items || items.length === 0) {
            const empty = element('div', 'empty-state');
            empty.append(element('p', null, 'Nenhuma versão encontrada.'));
            versionsList.append(empty);
            return;
        }

        items.forEach((version) => {
            const item = element('article', 'version-item');
            const info = element('div', 'version-info');
            info.append(
                element('p', 'version-title', `Versão ${version.versionNumber} (${version.source === 'ai' ? 'IA' : 'manual'})`),
                element('p', 'plano-data', LessonPlanRenderer.formatDate(version.criadoEm))
            );
            const meta = element('div', 'plano-meta');
            [
                version.tema,
                version.nivelEnsino,
                `${version.duracaoMinutos} min`,
                version.codigoBNCC,
            ].forEach((value) => {
                if (value) meta.append(element('span', 'meta-tag', value));
            });
            info.append(meta);

            const actions = element('div', 'version-actions');
            const open = element('button', 'btn-acao btn-ver', 'Abrir');
            open.type = 'button';
            open.addEventListener('click', () => openVersion(version.versionNumber));
            actions.append(open);
            item.append(info, actions);
            versionsList.append(item);
        });
    }

    async function loadVersions(page = 1) {
        const plan = activePlan();
        if (!plan || state.loading.versions) return;

        state.loading.versions = true;
        versionsPanel.hidden = false;
        AppUi.showLoading(versionsList, 'Carregando versões...');
        try {
            const payload = await ApiClient.request(
                `/api/planos/${encodeURIComponent(plan.id)}/versoes?page=${page}&limit=${state.versionsPagination.limit}`
            );
            state.versionsPagination = payload?.pagination || { page, limit: 20, total: 0, totalPages: 0 };
            renderVersions(payload?.items || []);
        } catch (error) {
            if (error.status !== 401) AppUi.showStatus(versionsList, errorMessage(error, 'Não foi possível carregar as versões.'), 'error');
        } finally {
            state.loading.versions = false;
            renderVersionsPagination();
        }
    }

    async function openVersion(versionNumber) {
        const plan = activePlan();
        if (!plan || state.loading.plan) return;

        state.loading.plan = true;
        AppUi.showLoading(result, 'Carregando versão...');
        try {
            const payload = await ApiClient.request(
                `/api/planos/${encodeURIComponent(plan.id)}/versoes/${encodeURIComponent(versionNumber)}`
            );
            const version = payload?.versao;
            if (!version) throw new Error('Versão não encontrada.');
            const displayPlan = {
                id: plan.id,
                tema: version.tema,
                nivelEnsino: version.nivelEnsino,
                duracaoMinutos: version.duracaoMinutos,
                codigoBNCC: version.codigoBNCC,
                status: plan.status,
                conteudo: version.conteudo,
                versaoAtual: plan.versaoAtual,
                criadoEm: version.criadoEm,
                atualizadoEm: version.criadoEm,
            };
            renderSelectedPlan(displayPlan, { viewedVersion: version });
            showActionMessage('Snapshot de versão carregado. Salvar uma edição usará controle de versão do plano atual.', 'info');
        } catch (error) {
            if (error.status !== 401) showActionMessage(errorMessage(error, 'Não foi possível abrir a versão.'), 'error');
        } finally {
            state.loading.plan = false;
        }
    }

    async function deleteSelectedPlan() {
        const plan = activePlan();
        if (!plan || state.loading.delete) return;
        const confirmed = window.confirm('Excluir este plano e todas as versões? Esta ação não pode ser desfeita.');
        if (!confirmed) return;

        state.loading.delete = true;
        AppUi.setBusy(deleteButton, true, 'Excluindo...', 'Excluir');
        try {
            await ApiClient.request(`/api/planos/${encodeURIComponent(plan.id)}`, { method: 'DELETE' });
            state.selectedPlan = null;
            state.viewedVersion = null;
            editPanel.hidden = true;
            versionsPanel.hidden = true;
            setManagementVisible(false);
            AppUi.showStatus(result, 'Plano excluído.', 'success');
            result.style.display = 'block';
            await loadHistory(1);
            await loadMetrics();
        } catch (error) {
            if (error.status !== 401) showActionMessage(errorMessage(error, 'Não foi possível excluir o plano.'), 'error');
        } finally {
            state.loading.delete = false;
            AppUi.setBusy(deleteButton, false, 'Excluindo...', 'Excluir');
        }
    }

    function fillFeedbackForm(feedback) {
        feedbackRating.value = feedback?.rating || '';
        feedbackUseful.checked = Boolean(feedback?.useful);
        feedbackUsedInClass.checked = Boolean(feedback?.usedInClass);
        feedbackComment.value = feedback?.comment || '';
        feedbackMessage.replaceChildren();
    }

    async function loadFeedback() {
        const plan = activePlan();
        if (!plan || state.loading.feedback) return;
        state.loading.feedback = true;
        try {
            const payload = await ApiClient.request(`/api/planos/${encodeURIComponent(plan.id)}/feedback`);
            fillFeedbackForm(payload?.feedback || null);
        } catch (error) {
            if (error.status !== 401) {
                fillFeedbackForm(null);
                showFeedbackMessage(errorMessage(error, 'Não foi possível carregar a avaliação.'), 'error');
            }
        } finally {
            state.loading.feedback = false;
        }
    }

    async function saveFeedback(event) {
        event.preventDefault();
        const plan = activePlan();
        if (!plan || state.loading.feedback) return;

        if (!feedbackRating.value) {
            showFeedbackMessage('Selecione uma nota de 1 a 5.', 'error');
            return;
        }

        state.loading.feedback = true;
        AppUi.setBusy(saveFeedbackButton, true, 'Salvando...', 'Salvar avaliação');
        try {
            const payload = await ApiClient.request(`/api/planos/${encodeURIComponent(plan.id)}/feedback`, {
                method: 'POST',
                body: {
                    rating: Number(feedbackRating.value),
                    useful: feedbackUseful.checked,
                    usedInClass: feedbackUsedInClass.checked,
                    comment: feedbackComment.value.trim() || null,
                },
            });
            fillFeedbackForm(payload?.feedback || null);
            showFeedbackMessage('Avaliação salva.', 'success');
            await loadMetrics();
        } catch (error) {
            if (error.status !== 401) showFeedbackMessage(errorMessage(error, 'Não foi possível salvar a avaliação.'), 'error');
        } finally {
            state.loading.feedback = false;
            AppUi.setBusy(saveFeedbackButton, false, 'Salvando...', 'Salvar avaliação');
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
            const plan = payload?.plano || null;
            if (!plan) throw new Error('A API não retornou o plano gerado.');
            renderSelectedPlan(plan);
            showActionMessage('Plano gerado e salvo com sucesso.', 'success');
            await loadHistory(1);
            await loadMetrics();
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
            historyButton.textContent = 'Ocultar Planos Anteriores';
            await loadMetrics();
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
    editButton.addEventListener('click', openEditPanel);
    cancelEditButton.addEventListener('click', () => {
        editPanel.hidden = true;
        unsavedNotice.hidden = true;
    });
    editForm.addEventListener('submit', saveEdit);
    editForm.addEventListener('input', () => {
        if (!editPanel.hidden) unsavedNotice.hidden = false;
    });
    saveStatusButton.addEventListener('click', saveStatus);
    versionsButton.addEventListener('click', () => loadVersions(1));
    closeVersionsButton.addEventListener('click', () => { versionsPanel.hidden = true; });
    deleteButton.addEventListener('click', deleteSelectedPlan);
    feedbackForm.addEventListener('submit', saveFeedback);
    filtersForm.addEventListener('submit', (event) => {
        event.preventDefault();
        state.filters = readFilters();
        loadHistory(1);
    });
    clearFiltersButton.addEventListener('click', () => {
        resetFilters();
        loadHistory(1);
    });
    historyButton.addEventListener('click', () => {
        const visible = historyCard.style.display !== 'none';
        historyCard.style.display = visible ? 'none' : 'block';
        historyButton.textContent = visible ? 'Ver Meus Planos Anteriores' : 'Ocultar Planos Anteriores';
        if (!visible && state.plans.length === 0) loadHistory(1);
    });

    document.getElementById('duracao').addEventListener('input', validateForm);
    document.getElementById('codigoBNCC').addEventListener('input', (event) => {
        event.target.value = event.target.value.toUpperCase();
    });
    document.getElementById('editCodigoBNCC').addEventListener('input', (event) => {
        event.target.value = event.target.value.toUpperCase();
    });
    document.getElementById('filterBNCC').addEventListener('input', (event) => {
        event.target.value = event.target.value.toUpperCase();
    });
    document.addEventListener('DOMContentLoaded', init);
}());
