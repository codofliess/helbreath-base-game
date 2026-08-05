import { Store } from '@tanstack/react-store';
import { SKILL_MAX_LEVEL } from '../../constants/OlympiaSkills';

interface SkillDialogState {
    isOpen: boolean;
    scrollOffset: number;
    /** Selected skill id for the detail panel; undefined until the player clicks a row. */
    selectedSkillId: number | undefined;
    /**
     * Live mastery % by skill id (server sync). When missing, UI falls back to
     * {@link OLYMPIA_SKILLS} stub levels.
     */
    levelsById: Record<number, number>;
}

export const skillDialogStore = new Store<SkillDialogState>({
    isOpen: false,
    scrollOffset: 0,
    selectedSkillId: undefined,
    levelsById: {},
});

export function toggleSkillDialog(): void {
    skillDialogStore.setState((s) => ({ ...s, isOpen: !s.isOpen }));
}

export function setSkillDialogOpen(value: boolean): void {
    skillDialogStore.setState((s) => ({ ...s, isOpen: value }));
}

export function setSkillScrollOffset(offset: number): void {
    skillDialogStore.setState((s) => ({ ...s, scrollOffset: Math.max(0, offset) }));
}

export function setSelectedSkillId(id: number | undefined): void {
    skillDialogStore.setState((s) => ({ ...s, selectedSkillId: id }));
}

export function getSkillLevel(skillId: number, fallbackLevel: number): number {
    const live = skillDialogStore.state.levelsById[skillId];
    return live !== undefined ? live : fallbackLevel;
}

export function setSkillLevel(skillId: number, level: number): void {
    const clamped = Math.max(0, Math.min(SKILL_MAX_LEVEL, Math.floor(level)));
    skillDialogStore.setState((s) => ({
        ...s,
        levelsById: { ...s.levelsById, [skillId]: clamped },
    }));
}

export function setSkillLevels(levelsById: Record<number, number>): void {
    const next: Record<number, number> = {};
    for (const [key, value] of Object.entries(levelsById)) {
        const id = Number(key);
        if (!Number.isFinite(id)) {
            continue;
        }
        next[id] = Math.max(0, Math.min(SKILL_MAX_LEVEL, Math.floor(value)));
    }
    skillDialogStore.setState((s) => ({
        ...s,
        levelsById: { ...s.levelsById, ...next },
    }));
}

/** Playwright / console helpers — same module instance as App (static import from main). */
export function installSkillDialogDevHooks(): void {
    const w = window as Window & {
        __helbreathDevSetSkillLevels?: (levelsById: Record<number, number>) => void;
        __helbreathDevOpenSkillDialog?: () => void;
    };
    w.__helbreathDevSetSkillLevels = (levelsById) => setSkillLevels(levelsById);
    w.__helbreathDevOpenSkillDialog = () => setSkillDialogOpen(true);
}
