import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { characterDialogStore, setCharacterStats } from '../store/CharacterDialog.store';
import { CharacterF5PlayerLine } from './CharacterDialog';

const here = path.dirname(fileURLToPath(import.meta.url));

function applyWorldEnterPlayerName(characterName: string): void {
    setCharacterStats({ playerName: characterName.trim() });
}

describe('F5 playerName after world enter', () => {
    it('copies the login name into characterDialogStore on world enter and F5 renders it', () => {
        setCharacterStats({ playerName: 'Player' });
        assert.equal(characterDialogStore.state.stats.playerName, 'Player');

        applyWorldEnterPlayerName('  Magias  ');
        assert.equal(characterDialogStore.state.stats.playerName, 'Magias');

        const html = renderToStaticMarkup(
            createElement(CharacterF5PlayerLine, { playerName: characterDialogStore.state.stats.playerName }),
        );
        assert.match(html, /Player: Magias/);
        assert.doesNotMatch(html, /Player: Player/);
    });

    it('LoginScreen writes playerName next to gsm.setCharacterName; GameWorld reapplies on scene enter', () => {
        const loginSrc = fs.readFileSync(path.join(here, '../../game/scenes/LoginScreen.ts'), 'utf8');
        assert.match(loginSrc, /gsm\.setCharacterName\(payload\.characterName\);/);
        assert.match(
            loginSrc,
            /setCharacterStats\(\{\s*playerName:\s*payload\.characterName\.trim\(\)\s*\}\)/,
        );

        const worldSrc = fs.readFileSync(path.join(here, '../../game/scenes/GameWorld.ts'), 'utf8');
        assert.match(
            worldSrc,
            /this\.player\.setCharacterName\(savedCharacterName\);\s*setCharacterStats\(\{\s*playerName:\s*savedCharacterName\.trim\(\)\s*\}\)/,
        );
    });
});
