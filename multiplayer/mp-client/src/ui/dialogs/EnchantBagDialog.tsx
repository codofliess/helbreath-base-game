import { useEffect, useMemo } from 'react';
import { useStore } from '@tanstack/react-store';
import { OlympiaDialogShell, stopOlympiaPointer } from '../components/OlympiaDialogShell';
import {
    ENCHANT_TIERS,
    countOwnedSpecies,
    enchantBagDialogStore,
    getOwnedCount,
    getRequiredCountForUpgrade,
    getSpeciesForTab,
    setEnchantBagDialogOpen,
    setEnchantBagSelection,
    setEnchantBagStatusMessage,
    setEnchantBagTab,
    setEnchantMaterials,
    type EnchantSpeciesDef,
} from '../store/EnchantBagDialog.store';
import { EventBus } from '../../game/EventBus';
import {
    ENCHANT_MATERIALS_STATE_RECEIVED,
    ENCHANT_RESULT_RECEIVED,
    IN_UI_ENCHANT_MATERIAL_UPGRADE,
    IN_UI_GET_ENCHANT_MATERIALS,
} from '../../constants/EventNames';
import type { IRefPhaserGame } from '../../PhaserGame';
import { getNetworkManager } from '../../utils/RegistryUtils';

interface EnchantBagDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    phaserRef?: React.RefObject<IRefPhaserGame | null>;
}

/**
 * Olympia Enchanting Bag layout (Ctrl+E):
 * - Columns = species (PsnRes, HitP, DefRatio… / Crit, Poison…)
 * - Rows = tiers 1–15
 * - Cell number = how many you own
 * - NO vortex / purity “Gem +8” column
 *
 * Tabs: Gemas de armas · Gemas de ropa (escudos = ropa).
 */
export function EnchantBagDialog({
    position,
    zIndex,
    onBringToFront,
    onPositionChange,
    phaserRef,
}: EnchantBagDialogProps) {
    const isOpen = useStore(enchantBagDialogStore, (s) => s.isOpen);
    const materials = useStore(enchantBagDialogStore, (s) => s.materials);
    const tab = useStore(enchantBagDialogStore, (s) => s.tab);
    const selectedType = useStore(enchantBagDialogStore, (s) => s.selectedType);
    const selectedLevel = useStore(enchantBagDialogStore, (s) => s.selectedLevel);
    const statusMessage = useStore(enchantBagDialogStore, (s) => s.statusMessage);

    const isWeapon = tab === 0;
    const species = useMemo(() => getSpeciesForTab(tab), [tab]);
    const weaponOwned = countOwnedSpecies(materials, true);
    const armorOwned = countOwnedSpecies(materials, false);

    const selectedSpecies: EnchantSpeciesDef | undefined = useMemo(
        () => species.find((s) => s.type === selectedType),
        [species, selectedType],
    );

    const selectedCount =
        selectedType != null && selectedLevel != null
            ? getOwnedCount(materials, isWeapon, selectedType, selectedLevel)
            : 0;

    const need =
        selectedLevel != null && selectedLevel > 0 ? getRequiredCountForUpgrade(selectedLevel) : 0;
    const canCombine =
        selectedType != null &&
        selectedLevel != null &&
        selectedLevel < 15 &&
        selectedCount >= need &&
        need > 0;

    useEffect(() => {
        const onMaterials = (data: {
            materials?: Array<{
                isShard: boolean;
                type: number;
                level: number;
                count: number;
                name: string;
            }>;
        }) => {
            setEnchantMaterials(data?.materials ?? []);
        };
        const onResult = (data: { success: boolean; message: string }) => {
            if (data?.message) {
                setEnchantBagStatusMessage(data.message);
            }
            EventBus.emit(IN_UI_GET_ENCHANT_MATERIALS);
        };
        EventBus.on(ENCHANT_MATERIALS_STATE_RECEIVED, onMaterials);
        EventBus.on(ENCHANT_RESULT_RECEIVED, onResult);
        return () => {
            EventBus.off(ENCHANT_MATERIALS_STATE_RECEIVED, onMaterials);
            EventBus.off(ENCHANT_RESULT_RECEIVED, onResult);
        };
    }, []);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        EventBus.emit(IN_UI_GET_ENCHANT_MATERIALS);
        const game = phaserRef?.current?.game;
        getNetworkManager(game)?.requestEnchantMaterialsState();
        setEnchantBagStatusMessage(
            'Como Olympia: columnas = especie, filas = tier. Sin gemas vortex.',
        );
    }, [isOpen, phaserRef]);

    if (!isOpen) {
        return null;
    }

    const requestUpgrade = (all: boolean) => {
        if (selectedType == null || selectedLevel == null || !canCombine) {
            return;
        }
        const kind = isWeapon ? 0 : 1;
        const mode = isWeapon ? (all ? 2 : 0) : all ? 3 : 1;
        EventBus.emit(IN_UI_ENCHANT_MATERIAL_UPGRADE, {
            kind,
            type: selectedType,
            level: selectedLevel,
            mode,
        });
        const game = phaserRef?.current?.game;
        getNetworkManager(game)?.requestEnchantMaterialUpgrade(
            kind,
            selectedType,
            selectedLevel,
            mode,
        );
    };

    return (
        <OlympiaDialogShell
            id="enchant-bag-dialog"
            position={position}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onPositionChange={onPositionChange}
            onContextMenu={(e) => {
                e.preventDefault();
                setEnchantBagDialogOpen(false);
            }}
            width={760}
            minHeight={460}
            rootClassName="enchant-bag-dialog"
        >
            <div className="enchant-bag-inner" onPointerDown={stopOlympiaPointer}>
                <div className="enchant-bag-header">
                    <span className="enchant-bag-title">Bolsa de gemas</span>
                    <span className="enchant-bag-shortcut">Ctrl+E</span>
                    <button
                        type="button"
                        className="enchant-bag-close"
                        title="Cerrar"
                        onClick={() => setEnchantBagDialogOpen(false)}
                    >
                        ×
                    </button>
                </div>

                <div className="enchant-bag-tabs">
                    <button
                        type="button"
                        className={tab === 0 ? 'enchant-bag-tab active' : 'enchant-bag-tab'}
                        onClick={() => setEnchantBagTab(0)}
                        title="Magic primary — armas"
                    >
                        Gemas de armas
                        {weaponOwned > 0 ? ` · ${weaponOwned}` : ''}
                    </button>
                    <button
                        type="button"
                        className={tab === 1 ? 'enchant-bag-tab active' : 'enchant-bag-tab'}
                        onClick={() => setEnchantBagTab(1)}
                        title="Magic secondary — ropa, escudos, cascos, botas, capas"
                    >
                        Gemas de ropa
                        {armorOwned > 0 ? ` · ${armorOwned}` : ''}
                    </button>
                </div>

                {/*
                  Olympia orientation:
                  thead = species names (PsnRes, HitP, DefRatio…)
                  tbody rows = tier 1..15 with yellow numbers in cells you own
                  NO “Gem” vortex column
                */}
                <div className="enchant-bag-matrix-wrap">
                    <table className="enchant-bag-matrix olympia-orient">
                        <thead>
                            <tr>
                                <th className="enchant-bag-tier-head" title="Tier / nivel">
                                    #
                                </th>
                                {species.map((sp) => (
                                    <th
                                        key={sp.type}
                                        className="enchant-bag-species-head"
                                        title={sp.fullName}
                                    >
                                        {sp.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {ENCHANT_TIERS.map((tier) => (
                                <tr key={tier}>
                                    <td className="enchant-bag-tier-cell">{tier}</td>
                                    {species.map((sp) => {
                                        const count = getOwnedCount(
                                            materials,
                                            isWeapon,
                                            sp.type,
                                            tier,
                                        );
                                        const selected =
                                            selectedType === sp.type && selectedLevel === tier;
                                        const canUp =
                                            tier < 15 && count >= getRequiredCountForUpgrade(tier);
                                        return (
                                            <td key={sp.type} className="enchant-bag-cell-td">
                                                <button
                                                    type="button"
                                                    className={[
                                                        'enchant-bag-cell',
                                                        count > 0 ? 'has' : 'empty',
                                                        selected ? 'selected' : '',
                                                        canUp ? 'ready' : '',
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' ')}
                                                    title={
                                                        count > 0
                                                            ? `${sp.fullName} T${tier}: ×${count}`
                                                            : `${sp.fullName} T${tier}`
                                                    }
                                                    onClick={() =>
                                                        setEnchantBagSelection(sp.type, tier)
                                                    }
                                                >
                                                    {count > 0 ? count : ''}
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="enchant-bag-detail">
                    {selectedSpecies && selectedLevel != null ? (
                        <>
                            <div className="enchant-bag-detail-name">
                                {selectedSpecies.fullName} · T{selectedLevel}
                            </div>
                            <div className="enchant-bag-detail-meta">
                                Tenés <b>{selectedCount}</b>
                                {selectedLevel < 15 ? (
                                    <>
                                        {' '}
                                        · Combinar: <b>{need}</b>× T{selectedLevel} → 1× T
                                        {selectedLevel + 1}
                                    </>
                                ) : (
                                    <> · Nivel máximo</>
                                )}
                            </div>
                            <div className="enchant-bag-actions">
                                <button
                                    type="button"
                                    className="enchant-bag-btn"
                                    disabled={!canCombine}
                                    onClick={() => requestUpgrade(false)}
                                >
                                    Combinar ×1
                                </button>
                                <button
                                    type="button"
                                    className="enchant-bag-btn"
                                    disabled={!canCombine}
                                    onClick={() => requestUpgrade(true)}
                                >
                                    Combinar todo
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="enchant-bag-detail-meta">
                            Click en una celda con número para combinar al tier siguiente.
                        </div>
                    )}
                </div>

                {statusMessage ? (
                    <div className="enchant-bag-status">{statusMessage}</div>
                ) : null}

                <div className="enchant-bag-hint">
                    Sin columna Gem/vortex · Armas → gemas de armas · Ropa/escudo → gemas de ropa
                </div>
            </div>
        </OlympiaDialogShell>
    );
}
