import { idleEntitySheetIndices } from './entitySheetFilter';

/** Look used to decode only the live character's body/hair/underwear idle sheets. */
export type WorldEnterAppearanceLook = {
    humanSpriteName: string;
    hairSpriteName: string;
    underwearSpriteName: string;
    hairStyleIndex: number;
    underwearColorIndex: number;
};

/** Idle (+ walk) local sheets for one occupied look — never all 10 SELECTCHAR packs. */
export function worldEnterAppearanceSheetJobs(
    look: WorldEnterAppearanceLook,
): Array<{ name: string; sheets: number[] }> {
    const hairStyle = Math.max(0, Math.min(7, look.hairStyleIndex));
    const underwearColor = Math.max(0, Math.min(7, look.underwearColorIndex));
    const jobs: Array<{ name: string; sheets: number[] }> = [
        { name: look.humanSpriteName, sheets: [...idleEntitySheetIndices()].sort((a, b) => a - b) },
    ];
    if (hairStyle !== 2) {
        const hairIdle = hairStyle * 12;
        jobs.push({ name: look.hairSpriteName, sheets: [hairIdle, hairIdle + 2] });
    }
    const underwearIdle = underwearColor * 12;
    jobs.push({ name: look.underwearSpriteName, sheets: [underwearIdle, underwearIdle + 2] });
    return jobs;
}
