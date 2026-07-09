import { useStore } from '@tanstack/react-store';
import { appStore } from '../store/App.store';
import {
    HUD_ICON_PANEL_BG,
    HUD_ICON_CHARACTER,
    HUD_ICON_INVENTORY,
    HUD_ICON_MAGIC,
    HUD_ICON_SKILLS,
    HUD_ICON_CHAT,
    HUD_ICON_SYSTEM,
} from '../../constants/SpriteKeys';
import { togglePlayerDialog } from '../store/PlayerDialog.store';
import { toggleInventoryDialog } from '../store/InventoryDialog.store';
import { toggleCastDialog } from '../store/CastDialog.store';
import { toggleControlsDialog } from '../store/ControlsDialog.store';

type HudIcon = {
    key: string;
    label: string;
    title: string;
    fKey: string;
    onClick: () => void;
};

const HUD_ICONS: HudIcon[] = [
    { key: HUD_ICON_CHARACTER, label: 'Char', title: 'Character (F5)', fKey: 'F5', onClick: togglePlayerDialog },
    { key: HUD_ICON_INVENTORY, label: 'Bag', title: 'Bag / Item Drops (F6)', fKey: 'F6', onClick: toggleInventoryDialog },
    { key: HUD_ICON_MAGIC, label: 'Magic', title: 'Magic Book (F7)', fKey: 'F7', onClick: toggleCastDialog },
    { key: HUD_ICON_SKILLS, label: 'Skill', title: 'Skills (F8)', fKey: 'F8', onClick: toggleControlsDialog },
    { key: HUD_ICON_CHAT, label: 'Chat', title: 'Chat (F9)', fKey: 'F9', onClick: () => console.log('[HotkeyBar] Chat — pending') },
    { key: HUD_ICON_SYSTEM, label: 'Sys', title: 'System Menu (F12)', fKey: 'F12', onClick: toggleControlsDialog },
];

const F_KEY_STRIP: Array<{ key: string; label: string }> = [
    { key: 'F1', label: 'F1' },
    { key: 'F2', label: 'F2' },
    { key: 'F3', label: 'F3' },
    { key: 'F4', label: 'F4' },
    { key: 'F5', label: 'F5' },
    { key: 'F6', label: 'F6' },
    { key: 'F7', label: 'F7' },
    { key: 'F8', label: 'F8' },
    { key: 'F9', label: 'F9' },
    { key: 'F10', label: 'F10' },
    { key: 'F11', label: 'F11' },
    { key: 'F12', label: 'F12' },
];

function SpriteIcon({ frameKey, alt, size = 32 }: { frameKey: string; alt: string; size?: number }) {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const src = spriteFrameMap.get(frameKey);
    if (!src) {
        return (
            <div
                style={{
                    width: size,
                    height: size,
                    background: '#2a1810',
                    border: '1px solid #5c4033',
                    borderRadius: 2,
                }}
                title={`${alt} (sprite loading…)`}
            />
        );
    }
    return (
        <img
            src={src}
            alt={alt}
            width={size}
            height={size}
            style={{ imageRendering: 'pixelated', display: 'block' }}
        />
    );
}

export function HotkeyBar() {
    const spriteFrameMap = useStore(appStore, (s) => s.spriteFrameMap);
    const panelBg = spriteFrameMap.get(HUD_ICON_PANEL_BG);

    return (
        <div
            style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 9998,
                pointerEvents: 'auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                paddingBottom: 4,
            }}
        >
            {/* F1–F12 strip — Olympia keyboard row */}
            <div
                style={{
                    display: 'flex',
                    gap: 2,
                    marginBottom: 4,
                    padding: '4px 8px',
                    background: 'linear-gradient(180deg, #1a1208 0%, #0d0906 100%)',
                    border: '2px solid #5c4033',
                    borderRadius: 4,
                    boxShadow: '0 0 12px rgba(160, 255, 128, 0.15)',
                }}
            >
                {F_KEY_STRIP.map(({ key, label }) => (
                    <div
                        key={key}
                        title={key === 'F11' ? 'F11 — in-game (Alt+F11: dialog transparency)' : key}
                        style={{
                            width: 36,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 10,
                            fontFamily: 'Courier New, monospace',
                            color: '#a0ff80',
                            background: '#222',
                            border: '1px solid #5c4033',
                            borderRadius: 2,
                        }}
                    >
                        {label}
                    </div>
                ))}
            </div>

            {/* Bottom icon panel — gamedialog2.spr when loaded, CSS fallback otherwise */}
            <div
                style={{
                    position: 'relative',
                    minWidth: 520,
                    height: 52,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '4px 16px',
                    background: panelBg
                        ? `url(${panelBg}) repeat-x center / auto 52px`
                        : 'linear-gradient(180deg, #3d2817 0%, #2a1810 50%, #1a1008 100%)',
                    border: panelBg ? 'none' : '3px solid #5c4033',
                    borderRadius: panelBg ? 0 : 6,
                    boxShadow: '0 -4px 20px rgba(0,0,0,0.6)',
                }}
            >
                {HUD_ICONS.map((icon) => (
                    <button
                        key={icon.key}
                        type="button"
                        title={icon.title}
                        onClick={icon.onClick}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: 4,
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(160, 255, 128, 0.12)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                        }}
                    >
                        <SpriteIcon frameKey={icon.key} alt={icon.label} size={28} />
                        <span style={{
                            fontSize: 9,
                            color: '#ffd700',
                            fontFamily: 'Courier New, monospace',
                        }}>
                            {icon.fKey}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}