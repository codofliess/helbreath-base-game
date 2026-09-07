import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    classifyMentorPrompt,
    clientMentorFallback,
    isFollowMePrompt,
    isPricePrompt,
    MENTOR_GUIDE_STARTER,
} from './mentorHeuristics';

describe('mentor heuristics', () => {
    it('treats sígueme / ahora / conviene as follow-me', () => {
        assert.equal(
            isFollowMePrompt('sígueme y explícame todo lo que tengo que hacer ahora / lo que más me conviene'),
            true,
        );
        assert.equal(isFollowMePrompt('qué hago ahora'), true);
        assert.equal(isFollowMePrompt(MENTOR_GUIDE_STARTER), true);
        assert.equal(classifyMentorPrompt('Guíame'), 'guide');
    });

    it('uses beginner next step when follow-me and API is down', () => {
        const result = clientMentorFallback('sígueme', {
            playerName: 'Elon',
            activeTitle: 'Slime hunt',
            activeHint: 'South of the farm: kill 5 Slimes.',
            enrolled: true,
        });
        assert.equal(result.kind, 'guide');
        assert.equal(result.source, 'client');
        assert.match(result.reply, /Slime hunt/);
        assert.match(result.reply, /Slimes/);
    });

    it('price questions stay approximate / no listings when API is down', () => {
        assert.equal(isPricePrompt('¿cuánto pagan por Long Sword en el mercado?'), true);
        const result = clientMentorFallback('¿cuánto pagan por Long Sword?', { playerName: 'Elon' });
        assert.equal(result.kind, 'price');
        assert.match(result.reply, /aproximad/i);
        assert.match(result.reply, /listing/i);
    });
});
