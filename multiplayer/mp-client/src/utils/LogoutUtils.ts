import type { Game } from 'phaser';
import { EventBus } from '../game/EventBus';
import { IN_UI_REQUEST_PLAYER_LOGOUT } from '../constants/EventNames';
import { INITIAL_GAME_WORLD_STATE_KEY } from '../constants/RegistryKeys';
import { setNetworkManager } from './RegistryUtils';
import { setSelectedMap } from '../ui/store/ControlsDialog.store';
import { resetMapDialogToDefaults, setMapDialogOpen } from '../ui/store/MapDialog.store';
import { setCameraDialogOpen } from '../ui/store/CameraDialog.store';
import { setMinimapDialogOpen } from '../ui/store/MinimapDialog.store';
import { setSoundDialogOpen } from '../ui/store/SoundDialog.store';
import { setMonsterDialogOpen } from '../ui/store/MonsterDialog.store';
import { setNPCDialogOpen } from '../ui/store/NPCDialog.store';
import { setEffectDialogOpen } from '../ui/store/EffectDialog.store';
import { setCastDialogOpen } from '../ui/store/CastDialog.store';
import { setControlsDialogOpen } from '../ui/store/ControlsDialog.store';
import { setPlayerDialogOpen } from '../ui/store/PlayerDialog.store';
import { setCharacterDialogOpen } from '../ui/store/CharacterDialog.store';
import { setSkillDialogOpen } from '../ui/store/SkillDialog.store';
import { setSysMenuDialogOpen } from '../ui/store/SysMenuDialog.store';
import { setMobKillsDialogOpen } from '../ui/store/MobKillsDialog.store';
import { setTrainingDialogOpen } from '../ui/store/TrainingDialog.store';
import { resetTimedChallengeStore } from '../ui/store/TimedChallenge.store';
import { resetBeginnerPathStore } from '../ui/store/BeginnerPath.store';
import { resetPartyStore } from '../ui/store/Party.store';
import { resetProgressionStore } from '../ui/store/Progression.store';
import { resetSystemLogStore } from '../ui/store/SystemLog.store';
import { resetChatDialogStore } from '../ui/store/ChatDialog.store';
import { setInventoryDialogOpen } from '../ui/store/InventoryDialog.store';
import { setItemDialogOpen } from '../ui/store/ItemDialog.store';
import { setServerDialogOpen } from '../ui/store/ServerDialog.store';
import { setPerformanceDialogOpen } from '../ui/store/PerformanceDialog.store';
import { resetCitySelectDialog } from '../ui/store/CitySelectDialog.store';
import { setCharacterStats } from '../ui/store/CharacterDialog.store';
import { setShopDialogOpen } from '../ui/store/ShopDialog.store';
import { setWarehouseDialogOpen } from '../ui/store/WarehouseDialog.store';
import { setBlacksmithDialogOpen } from '../ui/store/BlacksmithDialog.store';
import { setNpcTalkDialogOpen } from '../ui/store/NpcTalkDialog.store';
import { resetMagicShopLearnedSpells, setMagicShopOpen } from '../ui/store/MagicShopDialog.store';

/**
 * Performs logout cleanup: clears network manager, resets dialogs, closes all dialogs,
 * and emits IN_UI_REQUEST_PLAYER_LOGOUT for Phaser to handle (stop music, save state, navigate to LoginScreen).
 * Used by both the Log out button and the socket disconnected handler.
 */
export function performLogoutCleanup(game?: Game): void {
    if (game) {
        setNetworkManager(game, undefined);
        game.registry.remove(INITIAL_GAME_WORLD_STATE_KEY);
    }

    setSelectedMap('', false);
    resetMapDialogToDefaults();
    setMapDialogOpen(false);
    setCameraDialogOpen(false);
    setMinimapDialogOpen(false);
    setSoundDialogOpen(false);
    setMonsterDialogOpen(false);
    setNPCDialogOpen(false);
    setEffectDialogOpen(false);
    setCastDialogOpen(false);
    setPlayerDialogOpen(false);
    setCharacterDialogOpen(false);
    setSkillDialogOpen(false);
    setSysMenuDialogOpen(false);
    setMobKillsDialogOpen(false);
    setTrainingDialogOpen(false);
    resetBeginnerPathStore();
    resetPartyStore();
    resetProgressionStore();
    resetSystemLogStore();
    resetChatDialogStore();
    setInventoryDialogOpen(false);
    setItemDialogOpen(false);
    setControlsDialogOpen(false);
    setServerDialogOpen(false);
    setPerformanceDialogOpen(false);
    resetCitySelectDialog();
    resetMagicShopLearnedSpells();
    resetTimedChallengeStore();
    setShopDialogOpen(false);
    setMagicShopOpen(false);
    setWarehouseDialogOpen(false);
    setBlacksmithDialogOpen(false);
    setNpcTalkDialogOpen(false);
    setCharacterStats({ faction: 'Traveller' });
    EventBus.emit(IN_UI_REQUEST_PLAYER_LOGOUT);
}
