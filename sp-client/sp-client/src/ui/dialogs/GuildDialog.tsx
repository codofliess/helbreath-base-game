import React, { useState } from 'react';
import { DialogProps } from './DialogProps';

export const GuildDialog: React.FC<DialogProps> = ({ position, onClose, zIndex, onBringToFront }) => {
    const [activeTab, setActiveTab] = useState<'tax' | 'status' | 'warehouse'>('tax');

    // Estados de Tax
    const [goldTax, setGoldTax] = useState(10);
    const [partyGoldTax, setPartyGoldTax] = useState(15);
    const [questRewardTax, setQuestRewardTax] = useState(20);
    const [firstEKToGuild, setFirstEKToGuild] = useState(true);
    const [firstMajesticToGuild, setFirstMajesticToGuild] = useState(true);
    const [weeklyContributionToGuild, setWeeklyContributionToGuild] = useState(true);

    const isGuildMaster = true; // Cambiar a false cuando sea miembro normal

    const handleSave = async () => {
        const payload = {
            goldTax,
            partyGoldTax,
            questRewardTax,
            firstEKToGuild,
            firstMajesticToGuild,
            weeklyContributionToGuild,
            guildId: 1, // futuro: se obtendrá del jugador
        };

        try {
            const response = await fetch('http://localhost:3001/guild/tax', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ Configuración de Tax guardada correctamente en el servidor');
                console.log('💾 Guardado:', data);
            } else {
                alert('❌ Error al guardar: ' + (data.error || 'Desconocido'));
            }
        } catch (err) {
            console.error(err);
            alert('❌ Error de conexión con el middleware');
        }
    };

    return (
        <div style={{
            position: 'absolute',
            left: position.x,
            top: position.y,
            zIndex: zIndex,
            backgroundColor: '#111111',
            color: '#ffffff',
            padding: '20px',
            border: '4px solid #00cc00',
            borderRadius: '10px',
            width: '920px',
            minHeight: '620px',
            boxShadow: '0 0 40px #00ff00',
            fontFamily: 'Segoe UI, sans-serif',
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                <h2 style={{ color: '#00ff00', margin: 0 }}>🛡️ Panel de Guild Master</h2>
                <button onClick={onClose} style={{ background: '#aa0000', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}>
                    Cerrar
                </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #00cc00' }}>
                <button onClick={() => setActiveTab('tax')} style={{ background: activeTab === 'tax' ? '#00cc00' : '#222', color: activeTab === 'tax' ? 'black' : 'white', padding: '10px 20px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>
                    Tax y Contribuciones
                </button>
                <button onClick={() => setActiveTab('status')} style={{ background: activeTab === 'status' ? '#00cc00' : '#222', color: activeTab === 'status' ? 'black' : 'white', padding: '10px 20px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>
                    Estados Activos
                </button>
                <button onClick={() => setActiveTab('warehouse')} style={{ background: activeTab === 'warehouse' ? '#00cc00' : '#222', color: activeTab === 'warehouse' ? 'black' : 'white', padding: '10px 20px', border: 'none', borderRadius: '6px 6px 0 0', cursor: 'pointer' }}>
                    Guild Warehouse
                </button>
            </div>

            {/* TAB TAX */}
            {activeTab === 'tax' && (
                <div>
                    <h3>Reglas de Tax y Contribuciones</h3>
                    {isGuildMaster && <p style={{ color: '#00ff00' }}>✏️ Solo el Guild Master puede editar estas reglas</p>}

                    <p><strong>% de Oro normal:</strong> 
                        <input type="number" value={goldTax} onChange={(e) => setGoldTax(Number(e.target.value))} disabled={!isGuildMaster} style={{ width: '80px', marginLeft: '10px' }} /> %
                    </p>
                    <p><strong>% de Oro en Party:</strong> 
                        <input type="number" value={partyGoldTax} onChange={(e) => setPartyGoldTax(Number(e.target.value))} disabled={!isGuildMaster} style={{ width: '80px', marginLeft: '10px' }} /> %
                    </p>
                    <p><strong>% de Rewards de Quests:</strong> 
                        <input type="number" value={questRewardTax} onChange={(e) => setQuestRewardTax(Number(e.target.value))} disabled={!isGuildMaster} style={{ width: '80px', marginLeft: '10px' }} /> %
                    </p>

                    <label>
                        <input type="checkbox" checked={firstEKToGuild} onChange={(e) => setFirstEKToGuild(e.target.checked)} disabled={!isGuildMaster} />
                        Primer EK del día va al Guild
                    </label><br/>

                    <label>
                        <input type="checkbox" checked={firstMajesticToGuild} onChange={(e) => setFirstMajesticToGuild(e.target.checked)} disabled={!isGuildMaster} />
                        Primer Majestic de la semana va al Guild
                    </label><br/>

                    <label>
                        <input type="checkbox" checked={weeklyContributionToGuild} onChange={(e) => setWeeklyContributionToGuild(e.target.checked)} disabled={!isGuildMaster} />
                        Primera contribución semanal va al Guild
                    </label><br/><br/>

                    {isGuildMaster && (
                        <button onClick={handleSave} style={{ background: '#00aa00', color: 'white', padding: '12px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                            💾 Guardar Configuración de Tax
                        </button>
                    )}
                </div>
            )}

            {activeTab === 'status' && (
                <div>
                    <h3>Estados Activos</h3>
                    <p><strong>ACTIVE TRAINER:</strong> +10% EXP / +10% Drop a cambio de tax</p>
                    <p><strong>ACTIVE KILLER:</strong> +5% Daño / +5% Absorción a cambio del primer EK del día</p>
                </div>
            )}

            {activeTab === 'warehouse' && (
                <div>
                    <h3>Guild Warehouse</h3>
                    <p>Aquí aparecerán los drops especiales que caen directamente al almacén del guild.</p>
                </div>
            )}

            <div style={{ marginTop: '40px', textAlign: 'center', color: '#00ff88', fontSize: '14px' }}>
                Estas configuraciones son visibles para todos los miembros del guild en el menú F5
            </div>
        </div>
    );
};