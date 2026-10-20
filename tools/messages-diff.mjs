#!/usr/bin/env node
/**
 * Compare Helbreath Olympia packet IDs to ChainLords protobuf messages.
 *
 * Olympia names come from the live switches in reference/Server.cpp
 * (client dispatch, common commands, motion, and the login socket).
 * ChainLords names come from multiplayer/proto/network.proto, the server
 * PayloadOneofCase switches, and the mp-client send/handle sites.
 *
 * Numeric dword IDs are not in this repo (no NetMessages header). The
 * equivalence table below is the maintained map from an Olympia symbol
 * to the protobuf fields that stand in for it. A new C++ case that is
 * not in the table shows up as unmapped.
 *
 *   node tools/messages-diff.mjs
 *   node tools/messages-diff.mjs --out /tmp/messages-diff
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const CALL = /\b[A-Za-z_][A-Za-z0-9_]*\s*\(/;
const INTERESTING = /^(MSGID_|DEF_REQUEST_|DEF_COMMONTYPE_|DEF_OBJECT)/;

const IMPACT_NAME = {
    5: 'Critical',
    4: 'High',
    3: 'Medium',
    2: 'Low',
    1: 'Admin',
};

const STATUS_RANK = {
    missing: 0,
    unmapped: 1,
    'server-only': 2,
    partial: 3,
};

const CLIENT_ONLY_NOTES = {
    MSGID_GETMINIMUMLOADGATEWAY: 'Login-gateway load probe. This game server never switches on it.',
    MSGID_REQUEST_CHARGED_TELEPORT: 'Paid teleport request. Absent from the server dispatch.',
    MSGID_REQUEST_HELDENIAN_SCROLL: 'Heldenian scroll request. Absent from the server dispatch.',
    MSGID_REQUEST_HELDENIAN_TP: 'Heldenian teleport pick. The server handles MSGID_REQUEST_HELDENIANTELEPORT, which is a different ID.',
    MSGID_REQUEST_HELDENIAN_TP_LIST: 'Heldenian teleport list. Absent from the server dispatch.',
    MSGID_REQUEST_TELEPORT_LIST: 'Teleport destination list. Absent from the server dispatch.',
    DEF_COMMONTYPE_REQUEST_HUNTMODE: 'Client toggles hunt mode. The live server case for citizen versus hunter is DEF_COMMONTYPE_REQ_CHANGEPLAYMODE.',
};

const FEATURE_ORDER = [
    'trade',
    'guild',
    'party',
    'item',
    'magic',
    'combat',
    'movement',
    'craft',
    'skill',
    'quest',
    'npc',
    'event',
    'angel',
    'chat',
    'login',
    'command',
    'admin',
];

/**
 * Maintained equivalence. `coverage`:
 * - full: these protobuf fields are the player-facing stand-in
 * - partial: a related path exists and is not this packet
 * - missing: no stand-in
 * - dispatcher: umbrella ID; the real work is the nested cases
 */
export const EQUIVALENTS = [
    entry('DEF_COMMONTYPE_EXCHANGEITEMTOCHAR', 'trade', 5, 'missing', [],
        'Start a face-to-face item trade with the player you are looking at.'),
    entry('DEF_COMMONTYPE_SETEXCHANGEITEM', 'trade', 5, 'missing', [],
        'Put an item or gold into the open exchange window.'),
    entry('DEF_COMMONTYPE_CONFIRMEXCHANGEITEM', 'trade', 5, 'missing', [],
        'Accept the exchange so both sides swap items.'),
    entry('DEF_COMMONTYPE_CANCELEXCHANGEITEM', 'trade', 5, 'missing', [],
        'Cancel the exchange and return the offered items.'),
    entry('DEF_COMMONTYPE_GIVEITEMTOCHAR', 'trade', 5, 'missing', [],
        'Hand an item to another player without a trade window.'),
    entry('MSGID_REQUEST_CREATENEWGUILD', 'guild', 5, 'missing', [],
        'Create a guild from the guild hall.'),
    entry('MSGID_REQUEST_DISBANDGUILD', 'guild', 5, 'missing', [],
        'Disband the guild you lead.'),
    entry('DEF_COMMONTYPE_JOINGUILDAPPROVE', 'guild', 5, 'missing', [],
        'Guild master accepts a join request.'),
    entry('DEF_COMMONTYPE_JOINGUILDREJECT', 'guild', 5, 'missing', [],
        'Guild master rejects a join request.'),
    entry('DEF_COMMONTYPE_DISMISSGUILDAPPROVE', 'guild', 5, 'missing', [],
        'Confirm kicking a member, or confirm leaving.'),
    entry('DEF_COMMONTYPE_DISMISSGUILDREJECT', 'guild', 5, 'missing', [],
        'Refuse a kick or a leave confirmation.'),
    entry('DEF_COMMONTYPE_REQ_USEITEM', 'item', 5, 'partial', ['consume_item_request'],
        'Double-click an item. Potions are ConsumeItemRequest; scrolls, dyes, and the rest of the Olympia use-item switch are not one packet.'),
    entry('DEF_COMMONTYPE_MAGIC', 'magic', 5, 'full', ['spell_cast_request'],
        'Cast a spell. The cast bar is SpellCastStartRequest and SpellCastCancelRequest around this.'),
    entry('DEF_OBJECTATTACK', 'combat', 5, 'full', ['player_attacked_monster_request', 'player_attacked_player_request'],
        'Swing at a monster or another player.'),
    entry('DEF_OBJECTMOVE', 'movement', 5, 'full', ['request_movement'],
        'Walk one step.'),
    entry('DEF_OBJECTRUN', 'movement', 5, 'full', ['request_movement', 'player_movement_state_change_request'],
        'Run. Walk versus run is PlayerMovementStateChangeRequest plus the step.'),
    entry('DEF_OBJECTSTOP', 'movement', 5, 'full', ['request_movement', 'player_movement_state_change_request'],
        'Stop moving.'),
    entry('MSGID_COMMAND_CHATMSG', 'chat', 5, 'full', ['chat_message_send_request'],
        'Send a chat line. Channel tags live inside the string, not as their own packet.'),
    entry('MSGID_REQUEST_INITDATA', 'login', 5, 'full', ['authenticate_request'],
        'Enter the map with inventory and nearby objects. ChainLords folds this into AuthenticateRequest plus InitialGameWorldState.'),
    entry('MSGID_REQUEST_INITPLAYER', 'login', 5, 'full', ['authenticate_request'],
        'Finish character init before the map snapshot.'),
    entry('DEF_COMMONTYPE_REQ_STUDYMAGIC', 'magic', 5, 'partial', ['city_npc_service_request'],
        'Learn a spell from the wizard. The tower accepts learn:ID on CityNpcServiceRequest, which is not the classic study-magic packet.'),
    entry('DEF_COMMONTYPE_ITEMDROP', 'item', 4, 'full', ['player_item_drop_requested'],
        'Drop a bag item on the ground.'),
    entry('DEF_COMMONTYPE_EQUIPITEM', 'item', 4, 'full', ['equip_item_request'],
        'Equip a bag item.'),
    entry('DEF_COMMONTYPE_RELEASEITEM', 'item', 4, 'full', ['unequip_item_request'],
        'Unequip to the bag.'),
    entry('DEF_COMMONTYPE_REQ_PURCHASEITEM', 'trade', 4, 'full', ['buy_shop_item_request'],
        'Buy from a shop NPC.'),
    entry('DEF_COMMONTYPE_REQ_SELLITEM', 'trade', 4, 'partial', ['sell_bag_item_request'],
        'Sell a bag item to an NPC. ChainLords sells immediately from the bag, without the NPC sell dialog.'),
    entry('DEF_COMMONTYPE_REQ_REPAIRITEM', 'item', 4, 'full', ['repair_item_request'],
        'Repair one weapon or armor piece at the blacksmith.'),
    entry('DEF_COMMONTYPE_REQ_REPAIRITEMCONFIRM', 'item', 4, 'full', ['repair_item_request'],
        'Confirm the repair price. The ChainLords repair request completes the repair in one step.'),
    entry('DEF_COMMONTYPE_TOGGLECOMBATMODE', 'combat', 4, 'full', ['player_attack_mode_change_request'],
        'Toggle armed combat mode.'),
    entry('DEF_COMMONTYPE_TOGGLESAFEATTACKMODE', 'combat', 4, 'full', ['player_safe_attack_mode_change_request'],
        'Toggle safe attack so you do not hit non-enemies.'),
    entry('DEF_COMMONTYPE_REQUEST_ACTIVATESPECABLTY', 'combat', 4, 'full', ['activate_special_ability_request'],
        'Activate the equipped special ability.'),
    entry('MSGID_LEVELUPSETTINGS', 'command', 4, 'full', ['level_up_settings_request'],
        'Spend unspent level-up points into stats.'),
    entry('MSGID_STATECHANGEPOINT', 'command', 4, 'full', ['majestic_stat_respec_request'],
        'Spend a majestic to remove stat points.'),
    entry('MSGID_COMMAND_CHECKCONNECTION', 'command', 4, 'full', ['ping_request'],
        'Keepalive. ChainLords uses PingRequest.'),
    entry('DEF_COMMONTYPE_TALKTONPC', 'npc', 4, 'partial', ['city_npc_service_request', 'beginner_path_talk_request'],
        'Talk to an NPC. City desks and beginner-path NPCs answer; a general dialogue tree does not.'),
    entry('DEF_COMMONTYPE_REQUEST_JOINPARTY', 'party', 4, 'partial', ['create_party_request', 'join_party_request'],
        'Invite a player into the party by name. ChainLords party is create, join-by-code, and leave.'),
    entry('DEF_COMMONTYPE_REQUEST_ACCEPTJOINPARTY', 'party', 4, 'partial', ['join_party_request'],
        'Accept a party invite. There is no invite packet to accept; joining uses a code.'),
    entry('MSGID_REQUEST_CIVILRIGHT', 'login', 4, 'partial', [],
        'Become a citizen at city hall. Citizenship is chosen in the traveler zone, not by this packet.'),
    entry('MSGID_REQUEST_TELEPORT', 'movement', 4, 'partial', ['player_teleport_requested', 'world_change_request'],
        'NPC or scroll teleport. Pads and the world-change request cover some landings, not every Olympia teleport string.'),
    entry('MSGID_REQUEST_RESTART', 'movement', 4, 'missing', [],
        'Respawn in town and keep the session. Death uses PlayerResurrectedRequest; there is no town-restart packet.'),
    entry('MSGID_REQUEST_RETRIEVEITEM', 'item', 4, 'partial', ['open_warehouse_request', 'warehouse_deposit_request', 'warehouse_withdraw_request'],
        'Take an item back from the bank. William warehouse open, deposit, and withdraw stand in for that bank desk.'),
    entry('DEF_REQUEST_ANGEL', 'angel', 4, 'missing', [],
        'Summon or change an angel. Majestic item upgrade is a different system.'),
    entry('DEF_REQUEST_RESURRECTPLAYER_YES', 'combat', 4, 'partial', ['player_resurrected_request'],
        'Accept a resurrection. One resurrect request covers the yes path; there is no angel prompt.'),
    entry('DEF_REQUEST_RESURRECTPLAYER_NO', 'combat', 4, 'partial', ['player_resurrected_request'],
        'Refuse a resurrection. The client does not send a no packet.'),
    entry('DEF_COMMONTYPE_BUILDITEM', 'craft', 4, 'missing', [],
        'Blacksmith manufacture from a recipe.'),
    entry('DEF_COMMONTYPE_CRAFTITEM', 'craft', 4, 'missing', [],
        'Craft an item at the crafting NPC.'),
    entry('DEF_COMMONTYPE_REQ_CREATEPORTION', 'craft', 4, 'missing', [],
        'Alchemy: brew a potion from ingredients.'),
    entry('DEF_COMMONTYPE_QUESTACCEPTED', 'quest', 4, 'partial', ['beginner_path_enroll_request', 'city_npc_service_request'],
        'Accept an NPC quest. Beginner path and Garden quests exist; the Olympia quest log does not.'),
    entry('DEF_COMMONTYPE_REQUEST_CANCELQUEST', 'quest', 4, 'partial', ['beginner_path_abandon_request'],
        'Abandon the active quest. Beginner path can be abandoned; other Olympia quests cannot.'),
    entry('DEF_COMMONTYPE_REQ_USESKILL', 'skill', 4, 'partial', ['skill_gather_request'],
        'Use a skill. Mining and fishing gathers exist; the rest of the skill list does not have this packet.'),
    entry('DEF_COMMONTYPE_REQUEST_SELECTCRUSADEDUTY', 'event', 4, 'missing', [],
        'Pick a crusade duty at the commander.'),
    entry('DEF_COMMONTYPE_REQ_GETOCCUPYFLAG', 'event', 4, 'missing', [],
        'Take an occupy flag during crusade.'),
    entry('DEF_COMMONTYPE_REQ_CHANGEPLAYMODE', 'command', 4, 'missing', [],
        'In city hall, switch between citizen and hunter.'),
    entry('DEF_COMMONTYPE_GUILDTELEPORT', 'guild', 4, 'missing', [],
        'Teleport to the guild teleport point.'),
    entry('DEF_COMMONTYPE_REQ_SELLITEMCONFIRM', 'trade', 3, 'missing', [],
        'Confirm an NPC sale. Bag sell does not use a second confirm packet.'),
    entry('MSGID_REQUEST_SELLITEMLIST', 'trade', 3, 'missing', [],
        'Ask an NPC for the list of items it will buy.'),
    entry('DEF_COMMONTYPE_REQ_REPAIRALL', 'item', 3, 'missing', [],
        'Repair all equipped gear in one request.'),
    entry('DEF_COMMONTYPE_REQ_REPAIRALLDELETE', 'item', 3, 'missing', [],
        'Drop one piece out of the repair-all list.'),
    entry('DEF_COMMONTYPE_REQ_REPAIRALLCONFIRM', 'item', 3, 'missing', [],
        'Confirm repair-all and pay the total.'),
    entry('DEF_COMMONTYPE_UPGRADEITEM', 'item', 3, 'full', ['stone_item_upgrade_request'],
        'Upgrade with a Xelima or Merien stone.'),
    entry('DEF_COMMONTYPE_ENCHANTITEM', 'item', 3, 'full', ['item_enchant_request'],
        'Apply an enchant shard or fragment.'),
    entry('DEF_COMMONTYPE_DISENCHANTITEM', 'item', 3, 'full', ['item_disenchant_request'],
        'Break an item into enchant materials.'),
    entry('DEF_COMMONTYPE_UPGRADEENCHANT', 'item', 3, 'full', ['enchant_material_upgrade_request'],
        'Combine shards or fragments into the next level.'),
    entry('MSGID_REQUEST_SETITEMPOS', 'item', 3, 'missing', [],
        'Save paperdoll item positions.'),
    entry('MSGID_REQUEST_FULLOBJECTDATA', 'item', 3, 'missing', [],
        'Ask for the full description of a ground item or a player.'),
    entry('DEF_COMMONTYPE_REQ_CREATESLATE', 'craft', 3, 'missing', [],
        'Create a slate.'),
    entry('DEF_COMMONTYPE_REQ_GETFISHTHISTIME', 'skill', 3, 'partial', ['skill_gather_request'],
        'Finish a fishing attempt. Fishing is SkillGatherRequest skill 1, not this timing packet.'),
    entry('DEF_COMMONTYPE_REQ_SETDOWNSKILLINDEX', 'skill', 3, 'missing', [],
        'Set the weapon skill that loses points on death.'),
    entry('DEF_COMMONTYPE_GETMAGICABILITY', 'magic', 3, 'missing', [],
        'Read or grant magic-circle ability. Spells are learned at the tower instead.'),
    entry('DEF_COMMONTYPE_REQ_GETREWARDMONEY', 'quest', 3, 'missing', [],
        'Collect quest reward gold.'),
    entry('DEF_COMMONTYPE_REQ_GETHEROMANTLE', 'event', 3, 'missing', [],
        'Claim a hero mantle for crusade contribution.'),
    entry('DEF_COMMONTYPE_SUMMONWARUNIT', 'event', 3, 'missing', [],
        'Summon a crusade war unit.'),
    entry('DEF_COMMONTYPE_SETGUILDTELEPORTLOC', 'guild', 3, 'missing', [],
        'Set the guild teleport location.'),
    entry('DEF_COMMONTYPE_SETGUILDCONSTRUCTLOC', 'event', 3, 'missing', [],
        'Place a guild construction site during crusade.'),
    entry('DEF_COMMONTYPE_REQGUILDNAME', 'guild', 3, 'missing', [],
        'Look up a player\'s guild name.'),
    entry('MSGID_REQUEST_FIGHTZONE_RESERVE', 'event', 3, 'missing', [],
        'Reserve a fight zone.'),
    entry('MSGID_REQUEST_HELDENIANTELEPORT', 'event', 3, 'missing', [],
        'Teleport into the Heldenian event.'),
    entry('MSGID_REQUEST_CITYHALLTELEPORT', 'movement', 3, 'partial', ['world_change_request', 'player_teleport_requested'],
        'Teleport from city hall to the middleland landing. World change covers other landings, not this shortcut.'),
    entry('DEF_COMMONTYPE_REQUEST_MAPSTATUS', 'event', 3, 'missing', [],
        'Ask for crusade map status (towers, flags).'),
    entry('DEF_OBJECTGETITEM', 'item', 3, 'full', ['player_item_pickup_requested'],
        'Pick a ground item up. The motion is the pickup request.'),
    entry('DEF_OBJECTMAGIC', 'magic', 3, 'full', ['spell_cast_request'],
        'The cast motion. The client sends the spell request; the server broadcasts the motion.'),
    entry('DEF_OBJECTATTACKMOVE', 'combat', 3, 'partial', ['player_attacked_monster_request', 'request_movement'],
        'Step and attack in one motion. Attack and movement are separate requests.'),
    entry('DEF_OBJECTDAMAGEMOVE', 'combat', 3, 'partial', [],
        'Knockback step after damage. The server moves the body; the client does not send this.'),
    entry('MSGID_REQUEST_DELETECHARACTER', 'login', 3, 'missing', [],
        'Delete a character from the select-character desk.'),
    entry('DEF_COMMONTYPE_REQ_GETNPCHP', 'npc', 2, 'partial', [],
        'Pull one NPC\'s HP bar. Monster snapshots already carry HP; there is no pull request.'),
    entry('MSGID_REQUEST_PANNING', 'movement', 2, 'partial', [],
        'Ask the server for tiles as the camera pans. The client has the map locally and does not send this.'),
    entry('DEF_COMMONTYPE_REQUEST_HELP', 'command', 2, 'missing', [],
        'Request help (the crusade/help ping).'),
    entry('DEF_COMMONTYPE_REQ_GETOCCUPYFIGHTZONETICKET', 'event', 2, 'missing', [],
        'Take a fight-zone ticket.'),
    entry('MSGID_REQUEST_CREATENEWACCOUNT', 'login', 2, 'partial', ['authenticate_request'],
        'Create an account. Wallet sign-in replaces the account form.'),
    entry('MSGID_REQUEST_CHANGEPASSWORD', 'login', 1, 'missing', [],
        'Change the account password. Wallet sessions have no password packet.'),
    entry('MSGID_BWM_COMMAND_SHUTUP', 'admin', 1, 'missing', [],
        'Background-window mute command.'),
    entry('MSGID_BWM_INIT', 'admin', 1, 'missing', [],
        'Background-window init.'),
    entry('MSGID_ADMINUSER', 'admin', 1, 'missing', [],
        'Toggle GM admin mode. Anti-bot tool packets are a different GM surface.'),
    entry('MSGID_REQUEST_NOTICEMENT', 'login', 1, 'missing', [],
        'Read the notice file. The Olympia case is empty, so the server only swallows it.'),
    entry('DEF_COMMONTYPE_REQ_TRAINSKILL', 'skill', 2, 'missing', [],
        'Train a skill at an NPC. The Olympia handler call is commented out, so the case is a no-op.'),
    entry('MSGID_REQUEST_LOGIN', 'login', 4, 'partial', ['authenticate_request'],
        'Log in. AuthenticateRequest is the wallet session, not the account/password packet.'),
    entry('MSGID_REQUEST_ENTERGAME', 'login', 4, 'partial', ['authenticate_request'],
        'Enter the world with a character. The same authenticate request carries the character name.'),
    entry('MSGID_REQUEST_CREATENEWCHARACTER', 'login', 4, 'partial', ['authenticate_request', 'character_name_check_request'],
        'Create a character. Name check is separate; the create payload rides on authenticate when no save exists.'),
    entry('MSGID_COMMAND_COMMON', 'command', 5, 'dispatcher', [],
        'Umbrella for DEF_COMMONTYPE_* . Those cases are listed on their own.'),
    entry('MSGID_COMMAND_MOTION', 'movement', 5, 'dispatcher', [],
        'Umbrella for DEF_OBJECT* motions. Those cases are listed on their own.'),
];

function entry(id, feature, impact, coverage, ours, summary) {
    return { id, feature, impact, coverage, ours, summary };
}

export function stripCppComments(src) {
    let out = '';
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === '"' || c === "'") {
            const quote = c;
            out += c;
            i++;
            while (i < src.length) {
                if (src[i] === '\\') {
                    out += src[i];
                    i++;
                    if (i < src.length) {
                        out += src[i];
                        i++;
                    }
                    continue;
                }
                out += src[i];
                if (src[i] === quote) {
                    i++;
                    break;
                }
                i++;
            }
            continue;
        }
        if (c === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i++;
            continue;
        }
        if (c === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i = Math.min(src.length, i + 2);
            out += ' ';
            continue;
        }
        out += c;
        i++;
    }
    return out;
}

function skipString(text, i) {
    const quote = text[i];
    i++;
    while (i < text.length) {
        if (text[i] === '\\') {
            i += 2;
            continue;
        }
        if (text[i] === quote) return i + 1;
        i++;
    }
    return i;
}

export function extractFunction(source, signature) {
    const at = source.indexOf(signature);
    if (at < 0) return null;
    const brace = source.indexOf('{', at);
    if (brace < 0) return null;
    let depth = 0;
    let i = brace;
    while (i < source.length) {
        const c = source[i];
        if (c === '"' || c === "'") {
            i = skipString(source, i);
            continue;
        }
        if (c === '{') depth++;
        else if (c === '}') {
            depth--;
            if (depth === 0) return source.slice(brace, i + 1);
        }
        i++;
    }
    return null;
}

export function parseSwitchCases(text, braceIndex) {
    const cases = [];
    let depth = 0;
    let i = braceIndex;
    let current = null;
    const finish = (end) => {
        if (!current) return;
        const body = text.slice(current.start, end).split(/\bdefault\s*:/)[0];
        cases.push({ id: current.id, stub: !CALL.test(body) });
        current = null;
    };
    while (i < text.length) {
        const c = text[i];
        if (c === '"' || c === "'") {
            i = skipString(text, i);
            continue;
        }
        if (c === '{') {
            depth++;
            i++;
            continue;
        }
        if (c === '}') {
            depth--;
            if (depth === 0) {
                finish(i);
                return cases;
            }
            i++;
            continue;
        }
        if (depth === 1 && isWordAt(text, i, 'case')) {
            const match = /^case\s+([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(text.slice(i));
            if (match) {
                finish(i);
                current = { id: match[1], start: i + match[0].length };
                i += match[0].length;
                continue;
            }
        }
        if (depth === 1 && isWordAt(text, i, 'default')) {
            const match = /^default\s*:/.exec(text.slice(i));
            if (match) {
                finish(i);
                i += match[0].length;
                continue;
            }
        }
        i++;
    }
    finish(text.length);
    return cases;
}

function isWordAt(text, index, word) {
    if (!text.startsWith(word, index)) return false;
    if (index > 0 && /[A-Za-z0-9_]/.test(text[index - 1])) return false;
    const after = index + word.length;
    return after >= text.length || !/[A-Za-z0-9_]/.test(text[after]);
}

export function switchCasesAfter(source, marker) {
    const at = source.indexOf(marker);
    if (at < 0) return [];
    const sw = source.indexOf('switch', at);
    if (sw < 0) return [];
    const brace = source.indexOf('{', sw);
    if (brace < 0) return [];
    return parseSwitchCases(source, brace);
}

export function firstSwitchCases(fnBody) {
    const sw = fnBody.indexOf('switch');
    if (sw < 0) return [];
    const brace = fnBody.indexOf('{', sw);
    if (brace < 0) return [];
    return parseSwitchCases(fnBody, brace);
}

function keepInteresting(cases, layer) {
    const seen = new Set();
    const rows = [];
    for (const row of cases) {
        if (!INTERESTING.test(row.id) || seen.has(row.id)) continue;
        seen.add(row.id);
        rows.push({ ...row, layer });
    }
    return rows;
}

export function parseOlympiaServer(serverSource) {
    const text = stripCppComments(serverSource);
    const process = extractFunction(text, 'void CGame::MsgProcess');
    const common = extractFunction(text, 'void CGame::ClientCommonHandler');
    const motion = extractFunction(text, 'void CGame::ClientMotionHandler');
    if (!process || !common || !motion) {
        throw new Error('Olympia Server.cpp is missing MsgProcess, ClientCommonHandler, or ClientMotionHandler');
    }
    const client = keepInteresting(switchCasesAfter(process, 'case DEF_MSGFROM_CLIENT:'), 'client');
    const login = keepInteresting(switchCasesAfter(process, 'case DEF_MSGFROM_LOGSERVER:'), 'login');
    const commands = keepInteresting(firstSwitchCases(common), 'common');
    const motions = keepInteresting(firstSwitchCases(motion), 'motion');
    return [...client, ...login, ...commands, ...motions];
}

export function parseOlympiaClientSends(clientSource) {
    const text = stripCppComments(clientSource);
    const send = extractFunction(text, 'bool CGame::bSendCommand');
    const top = send ? keepInteresting(firstSwitchCases(send), 'client-send') : [];
    const common = [];
    const seen = new Set();
    const re = /bSendCommand\s*\(\s*MSGID_COMMAND_COMMON\s*,\s*(DEF_COMMONTYPE_[A-Z0-9_]+)/g;
    let match;
    while ((match = re.exec(text))) {
        if (seen.has(match[1])) continue;
        seen.add(match[1]);
        common.push(match[1]);
    }
    return { top, common };
}

export function parseOutgoingSymbols(serverSource) {
    const text = stripCppComments(serverSource);
    const notify = new Set();
    const response = new Set();
    for (const match of text.matchAll(/DEF_NOTIFY_[A-Z0-9_]+/g)) notify.add(match[0]);
    for (const match of text.matchAll(/\*\s*[A-Za-z_][A-Za-z0-9_]*\s*=\s*(MSGID_[A-Z0-9_]+)/g)) {
        response.add(match[1]);
    }
    return {
        notify: [...notify].sort(),
        response: [...response].sort(),
    };
}

export function parseProtoOneofs(protoSource) {
    const text = stripCppComments(protoSource);
    return {
        client: parseOneof(text, 'ClientMessage'),
        server: parseOneof(text, 'ServerMessage'),
    };
}

function parseOneof(text, messageName) {
    const sig = `message ${messageName}`;
    const at = text.indexOf(sig);
    if (at < 0) throw new Error(`proto missing ${messageName}`);
    const oneof = text.indexOf('oneof payload', at);
    const brace = text.indexOf('{', oneof);
    let depth = 0;
    let i = brace;
    while (i < text.length) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') {
            depth--;
            if (depth === 0) break;
        }
        i++;
    }
    const body = text.slice(brace + 1, i);
    const fields = [];
    const re = /([A-Za-z_][A-Za-z0-9_]*)\s+([a-z][a-z0-9_]*)\s*=\s*(\d+)\s*;/g;
    let match;
    while ((match = re.exec(body))) {
        fields.push({
            type: match[1],
            field: match[2],
            number: Number(match[3]),
            camel: snakeToCamel(match[2]),
        });
    }
    return fields;
}

function snakeToCamel(name) {
    return name.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

export function extractServerHandledTypes(files) {
    const handled = new Set();
    const re = /ClientMessage\.PayloadOneofCase\.([A-Za-z0-9_]+)/g;
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = re.exec(text))) {
            if (match[1] !== 'None') handled.add(match[1]);
        }
    }
    return handled;
}

export function extractClientSends(files) {
    const sent = new Set();
    const re = /\$case:\s*['"]([A-Za-z0-9_]+)['"]/g;
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = re.exec(text))) sent.add(match[1]);
    }
    return sent;
}

export function extractClientHandles(files, serverFields) {
    const names = new Set(serverFields.map((field) => field.camel));
    const handled = new Set();
    const re = /['"]([A-Za-z][A-Za-z0-9_]*)['"]/g;
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        let match;
        while ((match = re.exec(text))) {
            if (names.has(match[1])) handled.add(match[1]);
        }
    }
    return handled;
}

function listFiles(dir, accept) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name === 'node_modules' || ent.name === 'generated' || ent.name === 'obj' || ent.name === 'bin') {
                continue;
            }
            out.push(...listFiles(full, accept));
        } else if (accept(ent.name, full)) out.push(full);
    }
    return out;
}

export function loadWiring(root) {
    const proto = parseProtoOneofs(fs.readFileSync(path.join(root, 'multiplayer/proto/network.proto'), 'utf8'));
    const serverFiles = listFiles(path.join(root, 'multiplayer/server'), (name) => {
        return name.endsWith('.cs') && name !== 'NetworkPriority.cs';
    });
    const clientFiles = listFiles(path.join(root, 'multiplayer/mp-client/src'), (name) => {
        return name.endsWith('.ts') && !name.endsWith('.test.ts');
    });
    const handledTypes = extractServerHandledTypes(serverFiles);
    const sends = extractClientSends(clientFiles);
    const clientHandles = extractClientHandles(clientFiles, proto.server);
    const byField = new Map(proto.client.map((field) => [field.field, field]));
    return { proto, handledTypes, sends, clientHandles, byField, serverFiles, clientFiles };
}

export function classify(olympiaCases, wiring, equivalents = EQUIVALENTS) {
    const byId = new Map(equivalents.map((row) => [row.id, row]));
    const usedFields = new Set(equivalents.flatMap((row) => row.ours));
    const rows = olympiaCases.map((olympia) => {
        const mapped = byId.get(olympia.id) ?? null;
        return {
            ...olympia,
            mapped,
            status: statusFor(olympia, mapped, wiring),
            feature: mapped?.feature ?? inferFeature(olympia.id),
            impact: mapped?.impact ?? 3,
            summary: mapped?.summary ?? 'No equivalence is recorded for this Olympia case.',
            ours: (mapped?.ours ?? []).map((field) => describeField(field, wiring)),
        };
    });
    const oursOnly = wiring.proto.client
        .filter((field) => !usedFields.has(field.field))
        .map((field) => ({
            field: field.field,
            type: field.type,
            camel: field.camel,
            number: field.number,
            feature: inferOursFeature(field.field),
            server: wiring.handledTypes.has(field.type),
            clientSends: wiring.sends.has(field.camel),
        }))
        .sort((a, b) => a.feature.localeCompare(b.feature) || a.field.localeCompare(b.field));
    const definedNotHandled = wiring.proto.client
        .filter((field) => !wiring.handledTypes.has(field.type))
        .map((field) => field.field);
    const handledNotSent = wiring.proto.client
        .filter((field) => wiring.handledTypes.has(field.type) && !wiring.sends.has(field.camel))
        .map((field) => field.field);
    const serverNotRead = wiring.proto.server
        .filter((field) => !wiring.clientHandles.has(field.camel))
        .map((field) => field.field);
    return { rows, oursOnly, definedNotHandled, handledNotSent, serverNotRead };
}

function describeField(field, wiring) {
    const proto = wiring.byField.get(field);
    return {
        field,
        type: proto?.type ?? null,
        camel: proto?.camel ?? snakeToCamel(field),
        known: Boolean(proto),
        server: proto ? wiring.handledTypes.has(proto.type) : false,
        clientSends: proto ? wiring.sends.has(proto.camel) : false,
    };
}

export function statusFor(olympia, mapped, wiring) {
    if (!mapped) return 'unmapped';
    if (mapped.coverage === 'dispatcher') return 'covered';
    if (olympia.stub && mapped.coverage === 'missing' && mapped.ours.length === 0) return 'olympia-stub';
    if (mapped.coverage === 'missing' || mapped.ours.length === 0 && mapped.coverage !== 'partial') {
        return olympia.stub ? 'olympia-stub' : 'missing';
    }
    const described = mapped.ours.map((field) => describeField(field, wiring));
    const handled = described.filter((field) => field.server);
    const sent = described.filter((field) => field.clientSends);
    if (mapped.coverage === 'partial') {
        if (mapped.ours.length === 0) return 'partial';
        if (handled.length === 0) return 'missing';
        return 'partial';
    }
    if (handled.length === 0) return 'missing';
    if (handled.length < described.length) return 'partial';
    if (sent.length === 0) return 'server-only';
    return 'covered';
}

function inferFeature(id) {
    const name = id.toLowerCase();
    if (name.includes('guild')) return 'guild';
    if (name.includes('exchange') || name.includes('sell') || name.includes('purchase') || name.includes('giveitem')) return 'trade';
    if (name.includes('party')) return 'party';
    if (name.includes('quest')) return 'quest';
    if (name.includes('magic') || name.includes('spell')) return 'magic';
    if (name.includes('crusade') || name.includes('heldenian') || name.includes('fight') || name.includes('occupy') || name.includes('hero')) return 'event';
    if (name.includes('item') || name.includes('repair') || name.includes('equip') || name.includes('enchant')) return 'item';
    if (name.includes('teleport') || name.includes('move') || name.includes('restart') || name.includes('panning')) return 'movement';
    if (name.includes('chat')) return 'chat';
    if (name.includes('login') || name.includes('account') || name.includes('character') || name.includes('password')) return 'login';
    if (name.includes('admin') || name.includes('bwm')) return 'admin';
    return 'command';
}

function inferOursFeature(field) {
    const name = field.toLowerCase();
    if (name.includes('auction') || name.includes('sell') || name.includes('buy_') || name.includes('cash')) return 'trade';
    if (name.includes('guild')) return 'guild';
    if (name.includes('party')) return 'party';
    if (name.includes('spell') || name.includes('magic')) return 'magic';
    if (name.includes('attack') || name.includes('damage') || name.includes('bow') || name.includes('resurrect')) return 'combat';
    if (name.includes('move_item') || name.includes('item') || name.includes('equip') || name.includes('bag') || name.includes('warehouse') || name.includes('enchant') || name.includes('bind') || name.includes('upgrade') || name.includes('siphon') || name.includes('cic_') || name.includes('pickup')) return 'item';
    if (name.includes('move') || name.includes('teleport') || name.includes('world_change') || name.includes('cell_occupied')) return 'movement';
    if (name.includes('chat')) return 'chat';
    if (name.includes('arena') || name.includes('stream') || name.includes('timed') || name.includes('hell') || name.includes('rebirth') || name.includes('beginner') || name.includes('training') || name.includes('milestone') || name.includes('weather')) return 'event';
    if (name.includes('auth') || name.includes('character') || name.includes('logout') || name.includes('ping')) return 'login';
    if (name.includes('anti_bot') || name.includes('summon') || name.includes('kill_all') || name.includes('create_item')) return 'admin';
    if (name.includes('skill') || name.includes('gather')) return 'skill';
    return 'command';
}

export function diffClientSends(clientSends, serverIds) {
    const server = new Set(serverIds);
    return clientSends.top
        .map((row) => row.id)
        .filter((id) => !server.has(id))
        .sort();
}

export function diffCommonSends(commonSends, serverCommonIds) {
    const server = new Set(serverCommonIds);
    return commonSends.filter((id) => !server.has(id)).sort();
}

function featureRank(feature) {
    const index = FEATURE_ORDER.indexOf(feature);
    return index === -1 ? FEATURE_ORDER.length : index;
}

export function rankedGaps(rows) {
    return rows
        .filter((row) => row.status === 'missing' || row.status === 'partial' || row.status === 'unmapped' || row.status === 'server-only')
        .slice()
        .sort((a, b) => {
            if (b.impact !== a.impact) return b.impact - a.impact;
            const status = STATUS_RANK[a.status] - STATUS_RANK[b.status];
            if (status !== 0) return status;
            const feature = featureRank(a.feature) - featureRank(b.feature);
            if (feature !== 0) return feature;
            return a.id.localeCompare(b.id);
        });
}

export function buildReport(result) {
    const lines = [];
    lines.push('# Message diff vs Helbreath Olympia');
    lines.push('');
    lines.push(`Run: ${result.generatedAt}.`);
    lines.push('');
    lines.push('Olympia packet names are the live `case` labels in `reference/Server.cpp`: the client switch inside `MsgProcess`, the login switch on that same function, `ClientCommonHandler`, and the first switch in `ClientMotionHandler`. Commented-out gate and log handlers are not counted. A case whose body never calls a function is an Olympia no-op.');
    lines.push('');
    lines.push('ChainLords messages are the `ClientMessage` and `ServerMessage` fields in `multiplayer/proto/network.proto`. "Our server handles" means a `ClientMessage.PayloadOneofCase` arm under `multiplayer/server`. `NetworkPriority.cs` only classifies priority, so it is ignored. "Our client sends" means a `$case` encode under `multiplayer/mp-client/src`, tests excluded. "Our client handles" means that server-message field name appears in the same client tree.');
    lines.push('');
    lines.push('Each Olympia ID is paired with protobuf fields in a table in `tools/messages-diff.mjs`. `partial` means a related player path exists for this request.');
    lines.push('');
    lines.push('## Counts');
    lines.push('');
    lines.push(`| | |`);
    lines.push(`| --- | ---: |`);
    lines.push(`| Olympia IDs the server dispatches | ${result.rows.length} |`);
    for (const status of ['covered', 'partial', 'missing', 'olympia-stub', 'server-only', 'unmapped']) {
        lines.push(`| ${status} | ${result.rows.filter((row) => row.status === status).length} |`);
    }
    lines.push(`| ChainLords client messages Olympia does not dispatch | ${result.oursOnly.length} |`);
    lines.push(`| Proto fields the server never switches on | ${result.definedNotHandled.length} |`);
    lines.push(`| Proto fields the player client never sends | ${result.handledNotSent.length} |`);
    lines.push(`| Server messages the player client never reads | ${result.serverNotRead.length} |`);
    lines.push('');
    lines.push('## Unhandled, ranked by player impact');
    lines.push('');
    lines.push('Missing: no ChainLords packet plays this role. Partial: a related action exists, and this Olympia request is still its own gap. Within one impact band, trade, guild, and party come before admin.');
    lines.push('');
    let lastImpact = null;
    let lastFeature = null;
    for (const gap of result.gaps) {
        if (gap.impact !== lastImpact) {
            lastImpact = gap.impact;
            lastFeature = null;
            lines.push(`### ${IMPACT_NAME[gap.impact] ?? gap.impact}`);
            lines.push('');
        }
        if (gap.feature !== lastFeature) {
            lastFeature = gap.feature;
            lines.push(`#### ${gap.feature}`);
            lines.push('');
        }
        const standIn = gap.ours.length === 0
            ? 'No ChainLords packet.'
            : gap.ours.map((field) => `\`${field.field}\` (server ${field.server ? 'yes' : 'no'}, client sends ${field.clientSends ? 'yes' : 'no'})`).join('; ');
        lines.push(`- **${gap.status}** \`${gap.id}\` — ${gap.summary} ${standIn}`);
    }
    lines.push('');
    lines.push('## Olympia no-ops');
    lines.push('');
    const stubs = result.rows.filter((row) => row.status === 'olympia-stub');
    if (stubs.length === 0) lines.push('None. Every dispatched case calls something, or the catalog still treats it as a real gap.');
    for (const stub of stubs) {
        lines.push(`- \`${stub.id}\` (${stub.feature}) — ${stub.summary}`);
    }
    lines.push('');
    lines.push('## ChainLords messages Olympia does not handle');
    lines.push('');
    lines.push('These `ClientMessage` fields are not the stand-in for any Olympia ID above. Auction, arena, rebirth, and wallet desks are in this list on purpose: they are our protocol, not a rename of an Olympia packet.');
    lines.push('');
    let feature = null;
    for (const row of result.oursOnly) {
        if (row.feature !== feature) {
            feature = row.feature;
            lines.push(`### ${feature}`);
            lines.push('');
        }
        lines.push(`- \`${row.field}\` (\`${row.type}\`) — server ${row.server ? 'handles' : 'does not handle'}, client ${row.clientSends ? 'sends' : 'does not send'}.`);
    }
    lines.push('');
    lines.push('## Wiring inside ChainLords');
    lines.push('');
    lines.push(`Server never switches on: ${listOrNone(result.definedNotHandled)}.`);
    lines.push('');
    lines.push(`Player client never sends: ${listOrNone(result.handledNotSent)}.`);
    lines.push('');
    lines.push(`Player client never reads: ${listOrNone(result.serverNotRead)}.`);
    lines.push('');
    lines.push('## Olympia client sends the server never dispatches');
    lines.push('');
    lines.push('Taken from `bSendCommand` in `reference/Client.cpp`, compared with the server switches. Common-command second arguments the server\'s `ClientCommonHandler` does not list are included.');
    lines.push('');
    lines.push('Top-level:');
    lines.push('');
    for (const id of result.clientOnlyTop) {
        lines.push(`- \`${id}\` — ${CLIENT_ONLY_NOTES[id] ?? 'Present in bSendCommand, absent from the server dispatch.'}`);
    }
    if (result.clientOnlyTop.length === 0) lines.push('- none');
    lines.push('');
    lines.push('Common commands:');
    lines.push('');
    for (const id of result.clientOnlyCommon) {
        lines.push(`- \`${id}\` — ${CLIENT_ONLY_NOTES[id] ?? 'The client passes this DEF_COMMONTYPE and ClientCommonHandler has no case.'}`);
    }
    if (result.clientOnlyCommon.length === 0) lines.push('- none');
    lines.push('');
    lines.push('## Could not be compared');
    lines.push('');
    lines.push(`- Numeric packet IDs. \`reference/\` has \`Server.cpp\` and \`Client.cpp\` and no NetMessages header, so \`0x........\` values are not in the tree. Comparison is by symbol.`);
    lines.push(`- Server-to-client pushes. The server emits ${result.outgoing.notify.length} \`DEF_NOTIFY_*\` names and writes ${result.outgoing.response.length} \`MSGID_*\` response or event IDs (\`${result.outgoing.response.join('`, `')}\`). Those are outgoing. They were not matched one-to-one onto \`ServerMessage\` fields, because the payloads and the dwords are a different protocol. Inventory, motion, and init on our side are snapshots (\`InitialGameWorldState\`, bag messages, \`PlayerMoved\`) rather than those notifies.`);
    lines.push('- Bytes inside a handled packet: chat channel, spell id, NPC reply code, and crusade duty number. The switch case is compared; the inner enum is not.');
    lines.push('- Commented gate-server and log-server switches in `MsgProcess`. They are not live in this tree.');
    lines.push('- `sp-client` as a second player client. Gameplay sends are `multiplayer/mp-client`. `sp-client/tools/client-simulator.ts` is a tool and is not counted.');
    lines.push('- The Olympia client\'s receive switch (what `Client.cpp` does with `MSGID_RESPONSE_*` and `MSGID_EVENT_*`). That is the old client, not ours.');
    lines.push('- Handler bodies past the `case` label. Two `reference` trees exist (`reference/` and `sp-client/reference/`). File sizes differ. The live switch IDs and no-op flags match, so this run reads `reference/` only and does not diff the function bodies.');
    lines.push('');
    lines.push('## Every Olympia ID');
    lines.push('');
    lines.push('| ID | Layer | Feature | Impact | Status |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const row of result.rows) {
        lines.push(`| \`${row.id}\` | ${row.layer} | ${row.feature} | ${IMPACT_NAME[row.impact] ?? row.impact} | ${row.status} |`);
    }
    lines.push('');
    return lines.join('\n');
}

function listOrNone(items) {
    if (!items.length) return 'none';
    return items.map((item) => `\`${item}\``).join(', ');
}

export function summarize(result) {
    const top = result.gaps.slice(0, 10).map((gap, index) => {
        return `${index + 1}. [${gap.status}] ${gap.id} (${gap.feature}, ${IMPACT_NAME[gap.impact]}): ${gap.summary}`;
    });
    return [
        `Olympia IDs ${result.rows.length}; covered ${count(result, 'covered')}; partial ${count(result, 'partial')}; missing ${count(result, 'missing')}; stubs ${count(result, 'olympia-stub')}; unmapped ${count(result, 'unmapped')}.`,
        `ChainLords-only client messages: ${result.oursOnly.length}.`,
        'Top gaps:',
        ...top,
    ].join('\n');
}

function count(result, status) {
    return result.rows.filter((row) => row.status === status).length;
}

export function run(options = {}) {
    const root = options.root ?? repoRoot;
    const serverPath = path.join(root, 'reference/Server.cpp');
    const clientPath = path.join(root, 'reference/Client.cpp');
    const serverSource = fs.readFileSync(serverPath, 'utf8');
    const olympia = parseOlympiaServer(serverSource);
    const wiring = loadWiring(root);
    const classified = classify(olympia, wiring, options.equivalents ?? EQUIVALENTS);
    const clientSends = fs.existsSync(clientPath)
        ? parseOlympiaClientSends(fs.readFileSync(clientPath, 'utf8'))
        : { top: [], common: [] };
    const serverTop = new Set(olympia.filter((row) => row.layer === 'client' || row.layer === 'login').map((row) => row.id));
    const serverCommon = new Set(olympia.filter((row) => row.layer === 'common').map((row) => row.id));
    const result = {
        generatedAt: options.now ?? new Date().toISOString(),
        rows: classified.rows,
        gaps: rankedGaps(classified.rows),
        oursOnly: classified.oursOnly,
        definedNotHandled: classified.definedNotHandled,
        handledNotSent: classified.handledNotSent,
        serverNotRead: classified.serverNotRead,
        clientOnlyTop: diffClientSends(clientSends, serverTop),
        clientOnlyCommon: diffCommonSends(clientSends.common, serverCommon),
        outgoing: parseOutgoingSymbols(serverSource),
        unmapped: classified.rows.filter((row) => row.status === 'unmapped').map((row) => row.id),
    };
    result.markdown = buildReport(result);
    result.summary = summarize(result);
    result.json = {
        generatedAt: result.generatedAt,
        counts: {
            olympia: result.rows.length,
            covered: count(result, 'covered'),
            partial: count(result, 'partial'),
            missing: count(result, 'missing'),
            olympiaStub: count(result, 'olympia-stub'),
            unmapped: result.unmapped.length,
            oursOnly: result.oursOnly.length,
        },
        gaps: result.gaps.map((gap) => ({
            id: gap.id,
            feature: gap.feature,
            impact: gap.impact,
            status: gap.status,
            summary: gap.summary,
        })),
        oursOnly: result.oursOnly,
        definedNotHandled: result.definedNotHandled,
        handledNotSent: result.handledNotSent,
        serverNotRead: result.serverNotRead,
        clientOnlyTop: result.clientOnlyTop,
        clientOnlyCommon: result.clientOnlyCommon,
        unmapped: result.unmapped,
        outgoing: {
            notifyCount: result.outgoing.notify.length,
            response: result.outgoing.response,
        },
    };
    return result;
}

function parseArgs(argv) {
    const options = { out: null };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--out') options.out = argv[++i];
        else if (arg === '--help') options.help = true;
    }
    return options;
}

function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        process.stdout.write('node tools/messages-diff.mjs [--out dir]\n');
        return;
    }
    const result = run();
    if (options.out) {
        fs.mkdirSync(options.out, { recursive: true });
        fs.writeFileSync(path.join(options.out, 'messages-diff.md'), result.markdown);
        fs.writeFileSync(path.join(options.out, 'messages-diff.json'), `${JSON.stringify(result.json, null, 2)}\n`);
    }
    process.stdout.write(`${result.summary}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
