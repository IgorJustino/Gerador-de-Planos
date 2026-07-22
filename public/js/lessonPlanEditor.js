(function exposeLessonPlanEditor(root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory;
    } else {
        root.LessonPlanEditor = factory(root.LessonPlanRenderer);
    }
}(typeof window !== 'undefined' ? window : globalThis, function createLessonPlanEditor(renderer) {
    const STATUS_LABELS = {
        draft: 'Rascunho',
        reviewed: 'Revisado',
        approved: 'Aprovado',
        archived: 'Arquivado',
    };

    function normalizePlan(plan) {
        if (renderer?.normalizePlan) return renderer.normalizePlan(plan);
        return {
            ...plan,
            conteudo: plan.conteudo || plan.content || {},
            tema: plan.tema || '',
            nivelEnsino: plan.nivelEnsino || plan.nivel_ensino || '',
            duracaoMinutos: plan.duracaoMinutos || plan.duracao_minutos || 0,
            codigoBNCC: plan.codigoBNCC || plan.codigo_bncc || '',
            versaoAtual: plan.versaoAtual || plan.current_version || 1,
        };
    }

    function asArray(value) {
        return Array.isArray(value) ? value : [];
    }

    function linesToArray(value) {
        return String(value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean);
    }

    function arrayToLines(value) {
        return asArray(value).join('\n');
    }

    function objectivesToText(objectives) {
        return asArray(objectives)
            .map((objective) => {
                if (!objective || typeof objective !== 'object') return objective;
                return [
                    objective.id,
                    objective.descricao,
                    objective.evidencia,
                    objective.criterioSucesso,
                ].join(' | ');
            })
            .join('\n');
    }

    function textToObjectives(value) {
        return linesToArray(value).map((line) => {
            const parts = line.split('|').map((part) => part.trim());
            if (!/^OBJ-[1-9]\d{0,2}$/.test(parts[0]) || parts.length < 4) return line;
            return {
                id: parts[0],
                descricao: parts[1],
                evidencia: parts[2],
                criterioSucesso: parts.slice(3).join(' | '),
            };
        });
    }

    function stepsToText(steps) {
        return asArray(steps)
            .map((step) => {
                if (!Array.isArray(step.objetivosRelacionados)) {
                    return `${step.titulo || ''} | ${step.duracaoMinutos || 0} | ${step.descricao || ''}`;
                }
                return [
                    step.titulo || '',
                    step.duracaoMinutos || 0,
                    step.objetivosRelacionados.join(', '),
                    step.produtoDoEstudante || '',
                    step.descricao || '',
                    step.aulaNumero ? `aulaNumero=${step.aulaNumero}` : '',
                    Array.isArray(step.momentos) ? `momentos=${JSON.stringify(step.momentos)}` : '',
                ].join(' | ');
            })
            .join('\n');
    }

    function textToSteps(value) {
        return String(value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const parts = line.split('|').map((part) => part.trim());
                const objectiveIds = (parts[2] || '')
                    .split(',')
                    .map((part) => part.trim())
                    .filter(Boolean);
                if (parts.length >= 5 && objectiveIds.every((id) => /^OBJ-[1-9]\d{0,2}$/.test(id))) {
                    const step = {
                        titulo: parts[0] || 'Etapa',
                        duracaoMinutos: Number(parts[1]),
                        objetivosRelacionados: objectiveIds,
                        produtoDoEstudante: parts[3],
                        descricao: parts[4] || 'Descrição não informada.',
                    };
                    parts.slice(5).forEach((part) => {
                        if (part.startsWith('aulaNumero=')) {
                            step.aulaNumero = Number(part.replace('aulaNumero=', ''));
                        }
                        if (part.startsWith('momentos=')) {
                            try {
                                step.momentos = JSON.parse(part.replace('momentos=', ''));
                            } catch (_error) {
                                step.momentos = undefined;
                            }
                        }
                    });
                    return step;
                }
                return {
                    titulo: parts[0] || 'Etapa',
                    duracaoMinutos: Number(parts[1]),
                    descricao: parts.slice(2).join(' | ') || 'Descrição não informada.',
                };
            });
    }

    function assessmentsToText(assessments) {
        return asArray(assessments)
            .map((assessment) => {
                if (!assessment || typeof assessment !== 'object') return assessment;
                return [
                    assessment.instrumento,
                    asArray(assessment.objetivosRelacionados).join(', '),
                    assessment.criterioSucesso,
                ].join(' | ');
            })
            .join('\n');
    }

    function textToAssessments(value) {
        return linesToArray(value).map((line) => {
            const parts = line.split('|').map((part) => part.trim());
            const objectiveIds = (parts[1] || '')
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean);
            if (parts.length < 3 || !objectiveIds.every((id) => /^OBJ-[1-9]\d{0,2}$/.test(id))) {
                return line;
            }
            return {
                instrumento: parts[0],
                objetivosRelacionados: objectiveIds,
                criterioSucesso: parts.slice(2).join(' | '),
            };
        });
    }

    function bnccToText(skills) {
        return asArray(skills)
            .map((skill) => `${skill.codigo || ''} | ${skill.descricao || ''}`)
            .join('\n');
    }

    function textToBncc(value) {
        return String(value || '')
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const parts = line.split('|').map((part) => part.trim());
                return {
                    codigo: parts[0] || '',
                    descricao: parts.slice(1).join(' | ') || 'Habilidade informada pelo usuário',
                };
            });
    }

    function createDraftFromPlan(plan) {
        const normalized = normalizePlan(plan);
        const content = normalized.conteudo || {};
        return {
            tema: normalized.tema || '',
            nivelEnsino: normalized.nivelEnsino || '',
            duracaoMinutos: Number(normalized.duracaoMinutos || 0),
            codigoBNCC: normalized.codigoBNCC || '',
            conteudo: {
                titulo: content.titulo || '',
                resumo: content.resumo || '',
                objetivos: objectivesToText(content.objetivos),
                metodologia: arrayToLines(content.metodologia),
                recursos: arrayToLines(content.recursos),
                etapas: stepsToText(content.etapas),
                avaliacao: assessmentsToText(content.avaliacoes || content.avaliacao),
                adaptacoes: arrayToLines(content.adaptacoes),
                habilidadesBNCC: bnccToText(content.habilidadesBNCC),
            },
            expectedVersion: Number(normalized.versaoAtual || 1),
        };
    }

    function contentFromDraft(draft) {
        const objectives = textToObjectives(draft.conteudo.objetivos);
        const steps = textToSteps(draft.conteudo.etapas);
        const assessments = textToAssessments(draft.conteudo.avaliacao);
        const usesStructuredContract = objectives.some((item) => typeof item === 'object')
            || steps.some((item) => Array.isArray(item.objetivosRelacionados))
            || assessments.some((item) => typeof item === 'object');
        const content = {
            titulo: draft.conteudo.titulo.trim(),
            resumo: draft.conteudo.resumo.trim(),
            objetivos: objectives,
            metodologia: linesToArray(draft.conteudo.metodologia),
            recursos: linesToArray(draft.conteudo.recursos),
            etapas: steps,
            adaptacoes: linesToArray(draft.conteudo.adaptacoes),
            habilidadesBNCC: textToBncc(draft.conteudo.habilidadesBNCC),
        };
        if (usesStructuredContract) content.avaliacoes = assessments;
        else content.avaliacao = assessments;
        return content;
    }

    function validateDraft(draft) {
        const errors = [];
        const content = contentFromDraft(draft);
        const structured = Array.isArray(content.avaliacoes);

        if (draft.tema.trim().length < 3 || draft.tema.trim().length > 200) {
            errors.push('O tema deve ter entre 3 e 200 caracteres.');
        }
        if (draft.nivelEnsino.trim().length < 2 || draft.nivelEnsino.trim().length > 100) {
            errors.push('O nível de ensino deve ter entre 2 e 100 caracteres.');
        }
        if (!Number.isInteger(Number(draft.duracaoMinutos)) || Number(draft.duracaoMinutos) < 10 || Number(draft.duracaoMinutos) > 300) {
            errors.push('A duração deve ser um número inteiro entre 10 e 300 minutos.');
        }
        if (draft.codigoBNCC && !/^[A-Za-z]{2}\d{2}[A-Za-z]{2,3}\d{2,3}$/.test(draft.codigoBNCC.trim())) {
            errors.push('Use um código BNCC válido, como EF05CI01 ou EM13CHS101.');
        }
        if (content.titulo.length < 3 || content.titulo.length > 200) {
            errors.push('O título do plano deve ter entre 3 e 200 caracteres.');
        }
        if (content.resumo.length < 10 || content.resumo.length > 1500) {
            errors.push('O resumo deve ter entre 10 e 1.500 caracteres.');
        }
        if (content.objetivos.length < 1) errors.push('Informe ao menos um objetivo.');
        if (content.metodologia.length < 1) errors.push('Informe ao menos uma metodologia.');
        if ((content.avaliacoes || content.avaliacao).length < 1) {
            errors.push('Informe ao menos uma forma de avaliação.');
        }
        if (content.etapas.length < 1) errors.push('Informe ao menos uma etapa.');
        if (content.etapas.some((step) => !Number.isInteger(step.duracaoMinutos) || step.duracaoMinutos <= 0 || step.duracaoMinutos > 300)) {
            errors.push('Cada etapa deve usar o formato: título | duração inteira | descrição.');
        }

        if (structured) {
            const objectivesAreStructured = content.objetivos.every(
                (objective) => objective && typeof objective === 'object'
            );
            if (!objectivesAreStructured) {
                errors.push('Cada objetivo deve informar ID, descrição, evidência e critério.');
            }

            const objectiveIds = objectivesAreStructured
                ? content.objetivos.map((objective) => objective.id)
                : [];
            const uniqueObjectiveIds = new Set(objectiveIds);
            if (uniqueObjectiveIds.size !== objectiveIds.length) {
                errors.push('Os IDs dos objetivos não podem ser repetidos.');
            }

            const stepsAreStructured = content.etapas.every(
                (step) => Array.isArray(step.objetivosRelacionados)
                    && step.objetivosRelacionados.length > 0
                    && step.produtoDoEstudante
            );
            if (!stepsAreStructured) {
                errors.push('Cada etapa deve informar objetivos relacionados e produto do estudante.');
            }

            const assessmentsAreStructured = content.avaliacoes.every(
                (assessment) => assessment && typeof assessment === 'object'
                    && assessment.objetivosRelacionados.length > 0
            );
            if (!assessmentsAreStructured) {
                errors.push('Cada avaliação deve informar instrumento, objetivos e critério.');
            }

            const references = [
                ...content.etapas.flatMap((step) => step.objetivosRelacionados || []),
                ...content.avaliacoes.flatMap((assessment) => assessment.objetivosRelacionados || []),
            ];
            if (references.some((id) => !uniqueObjectiveIds.has(id))) {
                errors.push('Etapas e avaliações devem referenciar somente objetivos existentes.');
            }

            const stepCoverage = new Set(
                content.etapas.flatMap((step) => step.objetivosRelacionados || [])
            );
            const assessmentCoverage = new Set(
                content.avaliacoes.flatMap((assessment) => assessment.objetivosRelacionados || [])
            );
            if (objectiveIds.some((id) => !stepCoverage.has(id) || !assessmentCoverage.has(id))) {
                errors.push('Todo objetivo deve estar ligado a uma etapa e a uma avaliação.');
            }
            if (content.adaptacoes.length < 1) {
                errors.push('Informe ao menos uma adaptação concreta.');
            }
        }

        const totalDuration = content.etapas.reduce(
            (sum, step) => sum + (Number.isFinite(step.duracaoMinutos) ? step.duracaoMinutos : 0),
            0
        );
        const expectedDuration = Number(draft.duracaoMinutos);
        const tolerance = Math.max(5, expectedDuration * 0.1);
        if (Math.abs(totalDuration - expectedDuration) > tolerance) {
            errors.push('A soma das etapas não é compatível com a duração total.');
        }

        return { valid: errors.length === 0, errors, content };
    }

    function buildUpdatePayload(currentPlan, draft) {
        const current = normalizePlan(currentPlan);
        const validation = validateDraft(draft);
        if (!validation.valid) return { valid: false, errors: validation.errors };

        const payload = {
            expectedVersion: Number(current.versaoAtual || draft.expectedVersion),
        };

        if (draft.tema.trim() !== current.tema) payload.tema = draft.tema.trim();
        if (draft.nivelEnsino.trim() !== current.nivelEnsino) payload.nivelEnsino = draft.nivelEnsino.trim();
        if (Number(draft.duracaoMinutos) !== Number(current.duracaoMinutos)) {
            payload.duracaoMinutos = Number(draft.duracaoMinutos);
        }

        const draftBncc = draft.codigoBNCC.trim().toUpperCase();
        const currentBncc = current.codigoBNCC || '';
        if (draftBncc !== currentBncc) {
            payload.codigoBNCC = draftBncc || null;
        }

        const currentContent = contentFromDraft(createDraftFromPlan(current));
        if (JSON.stringify(validation.content) !== JSON.stringify(currentContent)) {
            payload.conteudo = validation.content;
        }

        if (Object.keys(payload).length === 1) {
            return { valid: false, errors: ['Não há alterações para salvar.'] };
        }

        return { valid: true, payload };
    }

    return {
        STATUS_LABELS,
        createDraftFromPlan,
        contentFromDraft,
        validateDraft,
        buildUpdatePayload,
        linesToArray,
        textToSteps,
        textToBncc,
    };
}));
