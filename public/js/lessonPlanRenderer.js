(function exposeLessonPlanRenderer(root) {
    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function formatDate(value) {
        if (!value) return 'Data não informada';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'Data não informada';
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    function sumLessonDurations(content) {
        return (content?.etapas || []).reduce(
            (total, etapa) => total + Number(etapa.duracaoMinutos || 0),
            0
        );
    }

    function normalizePlan(plan) {
        return {
            ...plan,
            conteudo: plan.conteudo || plan.content || {},
            tema: plan.tema || '',
            nivelEnsino: plan.nivelEnsino || plan.nivel_ensino || '',
            duracaoMinutos: plan.duracaoMinutos || plan.duracao_minutos || 0,
            codigoBNCC: plan.codigoBNCC || plan.codigo_bncc || '',
            criadoEm: plan.criadoEm || plan.created_at,
        };
    }

    function appendList(parent, items, emptyText = 'Nenhum item informado.') {
        const list = element('ul', 'lesson-list');
        if (!Array.isArray(items) || items.length === 0) {
            list.append(element('li', null, emptyText));
        } else {
            items.forEach((item) => list.append(element('li', null, item)));
        }
        parent.append(list);
    }

    function appendSection(parent, icon, title, content, emptyText = 'Nenhum item informado.') {
        const section = element('section', 'secao');
        const header = element('button', 'secao-header acordeao-header');
        header.type = 'button';
        header.setAttribute('aria-expanded', 'true');
        header.append(
            element('span', 'secao-icon', icon),
            element('span', 'section-title', title),
            element('span', 'acordeao-seta', '▼')
        );

        const body = element('div', 'secao-content acordeao-content aberto');
        if (Array.isArray(content)) {
            appendList(body, content, emptyText);
        } else {
            body.append(element('p', null, content || 'Nenhum conteúdo informado.'));
        }

        header.addEventListener('click', () => {
            const open = header.getAttribute('aria-expanded') === 'true';
            header.setAttribute('aria-expanded', String(!open));
            body.hidden = open;
            body.classList.toggle('aberto', !open);
            header.querySelector('.acordeao-seta').textContent = open ? '▶' : '▼';
        });
        section.append(header, body);
        parent.append(section);
    }

    function appendSteps(parent, steps) {
        const list = element('div', 'steps-list');
        (steps || []).forEach((step, index) => {
            const item = element('article', 'step-item');
            item.append(
                element('h3', null, `${index + 1}. ${step.titulo}`),
                element('p', null, step.descricao),
                element('span', 'meta-tag', `${step.duracaoMinutos} min`)
            );
            list.append(item);
        });
        parent.append(list);
    }

    function appendMeta(parent, plan) {
        const meta = element('div', 'plano-meta');
        [
            ['🎓', plan.nivelEnsino],
            ['⏱️', `${plan.duracaoMinutos} min`],
            ['📋', plan.codigoBNCC],
            ['📌', plan.status],
        ].forEach(([icon, value]) => {
            if (value) meta.append(element('span', 'meta-tag', `${icon} ${value}`));
        });
        parent.append(meta);
    }

    function renderLessonPlan(container, originalPlan) {
        const plan = normalizePlan(originalPlan);
        const content = plan.conteudo;
        const card = element('div', 'card');
        const heading = element('div', 'plan-heading');
        heading.append(element('h2', null, content.titulo || plan.tema));
        heading.append(element('p', null, content.resumo || ''));
        appendMeta(heading, plan);
        heading.append(element('p', 'plano-data', `Criado em: ${formatDate(plan.criadoEm)}`));
        card.append(heading);

        appendSection(card, '🎯', 'Objetivos', content.objetivos);
        appendSection(card, '🧭', 'Metodologia', content.metodologia);
        appendSection(card, '🧰', 'Recursos', content.recursos);

        const stepsSection = element('section', 'secao');
        stepsSection.append(element('h2', null, 'Etapas da aula'));
        appendSteps(stepsSection, content.etapas);
        stepsSection.append(element('p', 'duration-summary', `Duração: ${sumLessonDurations(content)} de ${plan.duracaoMinutos} minutos`));
        card.append(stepsSection);

        appendSection(card, '✅', 'Avaliação', content.avaliacao);
        appendSection(card, '♿', 'Adaptações', content.adaptacoes, 'Nenhuma adaptação informada.');

        const bncc = (content.habilidadesBNCC || []).map((skill) => `${skill.codigo}: ${skill.descricao}`);
        appendSection(card, '📚', 'Habilidades BNCC informadas', bncc, 'Nenhuma habilidade informada.');

        container.style.display = 'block';
        container.replaceChildren(card);
    }

    function appendSectionWithEmpty(parent, icon, title, content, emptyText) {
        const section = element('section', 'secao');
        const header = element('h2', null, `${icon} ${title}`);
        section.append(header);
        if (Array.isArray(content) && content.length > 0) appendList(section, content);
        else section.append(element('p', null, emptyText));
        parent.append(section);
    }

    function renderPlanList(container, plans, onOpen) {
        container.replaceChildren();
        if (!plans || plans.length === 0) {
            const empty = element('div', 'empty-state');
            empty.append(element('p', null, '📭'), element('p', null, 'Você ainda não possui planos gerados.'));
            container.append(empty);
            return;
        }

        plans.forEach((originalPlan) => {
            const plan = normalizePlan(originalPlan);
            const item = element('article', 'plano-item');
            const info = element('div', 'plano-info');
            info.append(element('h3', 'plano-titulo', plan.tema));
            appendMeta(info, plan);
            info.append(element('p', 'plano-data', `Criado em: ${formatDate(plan.criadoEm)}`));
            const button = element('button', 'btn-acao btn-ver', '👁️ Ver plano');
            button.type = 'button';
            button.addEventListener('click', () => onOpen(plan.id));
            item.append(info, element('div', 'plano-acoes'));
            item.lastChild.append(button);
            container.append(item);
        });
    }

    root.LessonPlanRenderer = {
        formatDate,
        normalizePlan,
        sumLessonDurations,
        renderLessonPlan,
        renderPlanList,
        appendSectionWithEmpty,
    };
}(window));
