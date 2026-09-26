import React, { useCallback, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";
import { PublicKey, SystemProgram, VersionedTransaction } from "@solana/web3.js";
import BN from "bn.js";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
  BTVN,
  CREATOR,
  DEFAULT_RPC,
  DEST,
  FUND_CREATOR_LAMPORTS,
  MEMBER_62TB,
  MEMBER_6SHB,
  MEMBER_2A4B,
  MULTISIG,
  RENT_OWNERS,
  SLIPPAGE_BPS_DEFAULT,
  VAULT,
  eq,
  short,
} from "./constants";
import { createConnection, lamportsToSol, uiSol } from "./rpc";
import { fetchLive, solFromLamports, type LiveSnapshot } from "./live";
import { compileV0, expectedDelta, freshBlockhash, simulateV0, type SimResult } from "./tx";
import { packVaultBundles, buildVaultInnerGroups, approveIx, executeIxs, configSetRentCollectorIxs, configExecuteIx, cancelProposalIx, rejectProposalIx, closeLegacyTxIxs, nextTxIndex } from "./builders/squads";
import { dbcCreatorClaimIxs } from "./builders/dbc";
import { batchAccounts, closeAccountIxs } from "./builders/rent";
import { btvnSellIxs } from "./builders/swap";

function pk(w: PublicKey | null): string {
  return w ? w.toBase58() : "(sin conectar)";
}

type ActionSim = {
  label: string;
  feePayer: PublicKey;
  required: PublicKey[];
  sim: SimResult;
  destDelta: string | null;
  vaultDelta: string | null;
  notes: string[];
};

function needWallet(connected: PublicKey | null, want: PublicKey): string | null {
  if (!connected) return "Conectá Phantom.";
  if (!connected.equals(want)) return `Conectá ${want.toBase58()} (ahora ${connected.toBase58()}).`;
  return null;
}

function Kit() {
  const wallet = useWallet();
  const [rpc, setRpc] = useState(DEFAULT_RPC);
  const connection = useMemo(() => createConnection(rpc), [rpc]);
  const [live, setLive] = useState<LiveSnapshot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lastSim, setLastSim] = useState<ActionSim | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const [sig, setSig] = useState<string | null>(null);
  const [splitNote, setSplitNote] = useState<string | null>(null);
  const [vaultIndexes, setVaultIndexes] = useState<bigint[]>([]);
  const [configIndex, setConfigIndex] = useState<bigint | null>(null);
  const [slippage, setSlippage] = useState(SLIPPAGE_BPS_DEFAULT);
  const [creatorPartial, setCreatorPartial] = useState<Uint8Array | null>(null);

  const connected = wallet.publicKey;

  const refresh = useCallback(async () => {
    setBusy("Leyendo montos on-chain…");
    setErr(null);
    try {
      setLive(await fetchLive(connection));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }, [connection]);

  async function runSim(
    id: string,
    feePayer: PublicKey,
    ixs: Parameters<typeof compileV0>[0]["ixs"],
    required: PublicKey[],
    notes: string[] = []
  ) {
    const blockhash = await freshBlockhash(connection);
    const vtx = compileV0({ payer: feePayer, blockhash, ixs });
    const destBefore = live?.destLamports ?? 0;
    const vaultBefore = live?.vaultLamports ?? 0;
    const sim = await simulateV0(connection, vtx, [DEST, VAULT, feePayer]);
    const destAfter = sim.accounts.find((a) => a.pubkey === DEST.toBase58())?.lamports;
    const vaultAfter = sim.accounts.find((a) => a.pubkey === VAULT.toBase58())?.lamports;
    const action: ActionSim = {
      label: id,
      feePayer,
      required,
      sim,
      destDelta: expectedDelta(destBefore, destAfter),
      vaultDelta: expectedDelta(vaultBefore, vaultAfter),
      notes,
    };
    setLastSim(action);
    setArmed(sim.ok ? id : null);
    if (!sim.ok) setErr(`Simulación falló (fail-closed): ${sim.err}`);
    return { vtx, action };
  }

  async function sendArmed(
    id: string,
    build: () => Promise<{ feePayer: PublicKey; ixs: Parameters<typeof compileV0>[0]["ixs"]; required: PublicKey[] }>
  ) {
    setErr(null);
    setSig(null);
    setBusy("Reconstruyendo + simulando…");
    try {
      const { feePayer, ixs, required } = await build();
      for (const r of required) {
        const msg = needWallet(connected, r);
        if (msg) throw new Error(msg);
      }
      const { vtx, action } = await runSim(id, feePayer, ixs, required);
      if (!action.sim.ok) return;
      setBusy("Esperando aprobación en Phantom…");
      if (!wallet.sendTransaction) throw new Error("Phantom no expone sendTransaction.");
      const s = await wallet.sendTransaction(vtx, connection, { skipPreflight: false });
      setSig(s);
      setArmed(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const summary = live
    ? (() => {
        const partner = live.dbc.reduce((a, r) => a + r.partnerQuote, 0n);
        const creator = live.dbc.reduce((a, r) => a + r.creatorQuote, 0n);
        const dammSol = live.damm ? live.damm.feeB : 0n; // HELL/SOL pool: quote usually token B = SOL; shown raw
        const rent = Object.values(live.rentByOwner).reduce(
          (a, o) => a + o.empty.reduce((s, t) => s + t.lamports, 0),
          0
        );
        const squadsRent = live.squads.tx1Lamports + live.squads.tx2Lamports;
        const vaultSend = Math.max(0, live.vaultLamports - live.rentExemptMin - 5_000_000);
        return { partner, creator, dammSol, rent, squadsRent, vaultSend };
      })()
    : null;

  return (
    <div className="wrap">
      <h1>Kit de recuperación autocustodia</h1>
      <p className="muted">
        El dueño firma todo en Phantom. Este sitio no pide, no lee, no genera ni guarda claves/seeds.
        Nunca envía solo: cada acción exige clic + aprobación de Phantom. Destino fijo:{" "}
        <span className="mono">{DEST.toBase58()}</span>
      </p>
      <div className="banner">
        Fail-closed: el botón de firmar se habilita solo si <code>simulateTransaction</code> (sigVerify=false)
        termina OK y ves el delta de SOL esperado. No hay envío automático. No se usa <code>.env</code>.
        <b> No hay remove_liquidity</b> (excluido).
      </div>

      <div className="card wallet">
        <div>
          <div className="muted">RPC mainnet (por defecto público; reintenta 429)</div>
          <input type="text" value={rpc} onChange={(e) => setRpc(e.target.value)} />
        </div>
        <div>
          <WalletMultiButton />
          <div className="muted">Conectada: {pk(connected)}</div>
        </div>
        <button className="secondary" onClick={refresh} disabled={!!busy}>
          Releer montos live
        </button>
      </div>

      {busy && <p className="warn">{busy}</p>}
      {err && <p className="bad">{err}</p>}
      {sig && (
        <p className="ok">
          Firma enviada: <span className="mono">{sig}</span>
        </p>
      )}

      {live && summary && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Resumen live</h2>
          <table>
            <thead>
              <tr>
                <th>Paso</th>
                <th>Wallet</th>
                <th>Claimable / rent</th>
              </tr>
            </thead>
            <tbody>
              {live.dbc.map((r) => (
                <tr key={r.pool.toBase58()}>
                  <td>A partner DBC {r.label}</td>
                  <td>Squads vault {short(VAULT)} (miembro 2a4b)</td>
                  <td>
                    {solFromLamports(r.partnerQuote).toFixed(6)} SOL quote
                    {r.partnerBase > 0n ? ` + base ${r.partnerBase.toString()}` : ""}
                  </td>
                </tr>
              ))}
              {live.dbc.map((r) => (
                <tr key={"c" + r.pool.toBase58()}>
                  <td>B creator DBC {r.label}</td>
                  <td>65Gh (fee 2a4b)</td>
                  <td>
                    {solFromLamports(r.creatorQuote).toFixed(6)} SOL quote
                    {r.creatorBase > 0n ? ` + base ${r.creatorBase.toString()}` : ""}
                  </td>
                </tr>
              ))}
              <tr>
                <td>A DAMM v2 fees</td>
                <td>Squads</td>
                <td>
                  {live.damm
                    ? `feeA ${live.damm.feeA.toString()} / feeB ${live.damm.feeB.toString()} (pool ${live.damm.pool.toBase58()})`
                    : "no se pudo leer"}
                </td>
              </tr>
              <tr>
                <td>A SOL vault (menos rent)</td>
                <td>Squads</td>
                <td>{lamportsToSol(summary.vaultSend)} transferible (aprox.)</td>
              </tr>
              <tr>
                <td>C rent ATAs vacías</td>
                <td>2a4b / 6shB / 97Ly / EW4o</td>
                <td>{lamportsToSol(summary.rent)}</td>
              </tr>
              <tr>
                <td>A rent tx1+tx2 Squads</td>
                <td>Squads config + close</td>
                <td>{lamportsToSol(summary.squadsRent)}</td>
              </tr>
              <tr>
                <td>D opcional A8fN BTvN</td>
                <td>BTvN</td>
                <td>{live.btvnA8fnRaw.toString()} raw</td>
              </tr>
              <tr>
                <td>
                  <b>Total quote partner+creator</b>
                </td>
                <td />
                <td>
                  <b>
                    {solFromLamports(summary.partner + summary.creator).toFixed(6)} SOL fees DBC + vault{" "}
                    {uiSol(summary.vaultSend)} + rent ATAs {uiSol(summary.rent)}
                  </b>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="muted">
            Multisig {MULTISIG.toBase58()} · umbral {live.squads.threshold} · txIndex {live.squads.txIndex.toString()} ·
            rentCollector {live.squads.rentCollector?.toBase58() ?? "null"} · miembros:{" "}
            {live.squads.members.map((m) => short(m)).join(", ")}
          </p>
        </div>
      )}

      {lastSim && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Última simulación: {lastSim.label}</h2>
          <p>
            Estado: {lastSim.sim.ok ? <span className="ok">OK</span> : <span className="bad">FAIL</span>} ·
            units {lastSim.sim.units ?? "?"} · fee payer {lastSim.feePayer.toBase58()}
          </p>
          <p>
            Delta 2a4b: <b>{lastSim.destDelta ?? "(sin cuenta en sim)"}</b> · Delta vault:{" "}
            <b>{lastSim.vaultDelta ?? "(n/a)"}</b>
          </p>
          {lastSim.notes.map((n) => (
            <p key={n} className="warn">
              {n}
            </p>
          ))}
          <pre>{(lastSim.sim.logs || []).slice(-40).join("\n") || lastSim.sim.err}</pre>
        </div>
      )}

      <h2>A) Squads — conectar 2a4b (miembro)</h2>
      <div className="card">
        <p className="muted">
          Crea vault tx + proposal. Inner: DBC claim_trading_fee partner de 3 pools, DAMM claim_position_fee (NFT de
          A782), unwrap WSOL, transfer SOL (deja rent-exempt) hacia 2a4b. Sin remove_liquidity.
        </p>
        {splitNote && <p className="warn">{splitNote}</p>}
        {vaultIndexes.length > 0 && (
          <p className="ok">Índices vault creados/previstos: {vaultIndexes.map(String).join(", ")}</p>
        )}
        <div className="row">
          <button
            disabled={!!busy || !live}
            onClick={async () => {
              setBusy("Armando inner ixs…");
              setErr(null);
              try {
                if (!live) throw new Error("Releé montos.");
                const groups = await buildVaultInnerGroups(
                  connection,
                  live.damm,
                  live.vaultLamports,
                  live.rentExemptMin
                );
                const bundles = await packVaultBundles(connection, MEMBER_2A4B, groups);
                setVaultIndexes(bundles.map((b) => b.index));
                setSplitNote(
                  bundles.length > 1 || bundles.some((b) => b.splitReason)
                    ? bundles.map((b) => `tx ${b.index}: ${b.memo}${b.splitReason ? " — " + b.splitReason : ""}`).join(" | ")
                    : "Cabe en UNA vault transaction + proposal."
                );
                const first = bundles[0];
                await runSim("squads-create-0", MEMBER_2A4B, first.createIxs, [MEMBER_2A4B], [
                  `Wallet requerida: ${MEMBER_2A4B.toBase58()}`,
                  `Claimable partner live: ${live.dbc.map((r) => r.label + "=" + solFromLamports(r.partnerQuote).toFixed(6)).join(", ")}`,
                ]);
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            Simular crear vault tx #1
          </button>
          <button
            disabled={armed !== "squads-create-0" || !!busy}
            onClick={() =>
              sendArmed("squads-create-0", async () => {
                if (!live) throw new Error("Sin live");
                const groups = await buildVaultInnerGroups(
                  connection,
                  live.damm,
                  live.vaultLamports,
                  live.rentExemptMin
                );
                const bundles = await packVaultBundles(connection, MEMBER_2A4B, groups);
                setVaultIndexes(bundles.map((b) => b.index));
                return { feePayer: MEMBER_2A4B, ixs: bundles[0].createIxs, required: [MEMBER_2A4B] };
              })
            }
          >
            Firmar crear #1 en Phantom
          </button>
        </div>
        <p className="muted">
          vaultTransactionCreate y proposalCreate van en txs distintas (el mensaje inner no entra junto al proposal).
          Si hay más de una vault tx, repetí crear/proponer para cada índice.
        </p>
        <div className="row">
          <button
            disabled={!!busy || vaultIndexes.length === 0}
            onClick={async () => {
              if (!live) return;
              const groups = await buildVaultInnerGroups(
                connection,
                live.damm,
                live.vaultLamports,
                live.rentExemptMin
              );
              const bundles = await packVaultBundles(connection, MEMBER_2A4B, groups);
              await runSim("squads-propose-0", MEMBER_2A4B, bundles[0].proposeIxs, [MEMBER_2A4B]);
            }}
          >
            Simular proposalCreate #1
          </button>
          <button
            disabled={armed !== "squads-propose-0" || !!busy}
            onClick={() =>
              sendArmed("squads-propose-0", async () => {
                if (!live) throw new Error("Sin live");
                const groups = await buildVaultInnerGroups(
                  connection,
                  live.damm,
                  live.vaultLamports,
                  live.rentExemptMin
                );
                const bundles = await packVaultBundles(connection, MEMBER_2A4B, groups);
                return { feePayer: MEMBER_2A4B, ixs: bundles[0].proposeIxs, required: [MEMBER_2A4B] };
              })
            }
          >
            Firmar proposalCreate
          </button>
        </div>
        <div className="row">
          <button
            disabled={!!busy || vaultIndexes.length === 0}
            onClick={async () => {
              const idx = vaultIndexes[0];
              await runSim("squads-approve", MEMBER_2A4B, [approveIx(idx, MEMBER_2A4B)], [MEMBER_2A4B], [
                `Voto 1/2 de 2a4b sobre índice ${idx}. Falta un SEGUNDO miembro: ${MEMBER_62TB.toBase58()} o ${MEMBER_6SHB.toBase58()} (en la otra wallet).`,
              ]);
            }}
          >
            Simular approve (2a4b)
          </button>
          <button
            disabled={armed !== "squads-approve" || !!busy}
            onClick={() =>
              sendArmed("squads-approve", async () => ({
                feePayer: MEMBER_2A4B,
                ixs: [approveIx(vaultIndexes[0], MEMBER_2A4B)],
                required: [MEMBER_2A4B],
              }))
            }
          >
            Firmar approve
          </button>
        </div>
        <div className="banner">
          Segundo voto: conectá {MEMBER_62TB.toBase58()} o {MEMBER_6SHB.toBase58()} en Phantom (otra cuenta) y usá
          approve sobre el mismo índice. Este kit no firma esa wallet por vos.
        </div>
        <div className="row">
          <button
            disabled={!!busy || vaultIndexes.length === 0}
            onClick={async () => {
              const idx = vaultIndexes[0];
              const ixs = await executeIxs(connection, idx, MEMBER_2A4B);
              await runSim("squads-execute", MEMBER_2A4B, ixs, [MEMBER_2A4B], [
                "Execute solo funciona si el proposal ya está Approved (2 votos).",
              ]);
            }}
          >
            Simular execute
          </button>
          <button
            disabled={armed !== "squads-execute" || !!busy}
            onClick={() =>
              sendArmed("squads-execute", async () => ({
                feePayer: MEMBER_2A4B,
                ixs: await executeIxs(connection, vaultIndexes[0], MEMBER_2A4B),
                required: [MEMBER_2A4B],
              }))
            }
          >
            Firmar execute
          </button>
        </div>

        <h3>Config opcional: rentCollector → 2a4b y cerrar tx 1 / tx 2</h3>
        <p className="muted">
          Primero SetRentCollector (config tx + votos + execute). Tx1 está Active (1 voto, fallaría): cancelarla para
          poder cerrar. Tx2 executed se cierra con vault_transaction_accounts_close. Rent a 2a4b.
        </p>
        <div className="row">
          <button
            disabled={!!busy || !live}
            onClick={async () => {
              const idx = await nextTxIndex(connection);
              setConfigIndex(idx);
              await runSim(
                "squads-config",
                MEMBER_2A4B,
                configSetRentCollectorIxs({ index: idx, creator: MEMBER_2A4B, newCollector: DEST }),
                [MEMBER_2A4B]
              );
            }}
          >
            Simular set rentCollector
          </button>
          <button
            disabled={armed !== "squads-config" || !!busy || configIndex == null}
            onClick={() =>
              sendArmed("squads-config", async () => {
                const idx = await nextTxIndex(connection);
                setConfigIndex(idx);
                return {
                  feePayer: MEMBER_2A4B,
                  ixs: configSetRentCollectorIxs({ index: idx, creator: MEMBER_2A4B, newCollector: DEST }),
                  required: [MEMBER_2A4B],
                };
              })
            }
          >
            Firmar set rentCollector
          </button>
        </div>
        <div className="row">
          <button
            disabled={!!busy || configIndex == null}
            onClick={async () => {
              await runSim("squads-cfg-approve", MEMBER_2A4B, [approveIx(configIndex!, MEMBER_2A4B)], [MEMBER_2A4B]);
            }}
          >
            Simular approve config
          </button>
          <button
            disabled={armed !== "squads-cfg-approve" || !!busy || configIndex == null}
            onClick={() =>
              sendArmed("squads-cfg-approve", async () => ({
                feePayer: MEMBER_2A4B,
                ixs: [approveIx(configIndex!, MEMBER_2A4B)],
                required: [MEMBER_2A4B],
              }))
            }
          >
            Firmar approve config
          </button>
          <button
            disabled={!!busy || configIndex == null}
            onClick={async () => {
              await runSim("squads-cfg-exec", MEMBER_2A4B, [configExecuteIx(configIndex!, MEMBER_2A4B)], [MEMBER_2A4B]);
            }}
          >
            Simular execute config
          </button>
          <button
            disabled={armed !== "squads-cfg-exec" || !!busy || configIndex == null}
            onClick={() =>
              sendArmed("squads-cfg-exec", async () => ({
                feePayer: MEMBER_2A4B,
                ixs: [configExecuteIx(configIndex!, MEMBER_2A4B)],
                required: [MEMBER_2A4B],
              }))
            }
          >
            Firmar execute config
          </button>
        </div>
        <div className="row">
          <button
            disabled={!!busy}
            onClick={async () => {
              await runSim("squads-cancel-1", MEMBER_2A4B, [cancelProposalIx(1n, MEMBER_2A4B)], [MEMBER_2A4B]);
            }}
          >
            Simular cancelar tx1
          </button>
          <button
            disabled={armed !== "squads-cancel-1" || !!busy}
            onClick={() =>
              sendArmed("squads-cancel-1", async () => ({
                feePayer: MEMBER_2A4B,
                ixs: [cancelProposalIx(1n, MEMBER_2A4B)],
                required: [MEMBER_2A4B],
              }))
            }
          >
            Firmar cancelar tx1
          </button>
          <button
            disabled={!!busy}
            onClick={async () => {
              await runSim("squads-reject-1", MEMBER_2A4B, [rejectProposalIx(1n, MEMBER_2A4B)], [MEMBER_2A4B], [
                "Cancel falló en dry-run (InvalidProposalStatus). Reject es el plan B para invalidar tx1.",
              ]);
            }}
          >
            Simular reject tx1
          </button>
          <button
            disabled={armed !== "squads-reject-1" || !!busy}
            onClick={() =>
              sendArmed("squads-reject-1", async () => ({
                feePayer: MEMBER_2A4B,
                ixs: [rejectProposalIx(1n, MEMBER_2A4B)],
                required: [MEMBER_2A4B],
              }))
            }
          >
            Firmar reject tx1
          </button>
          <button
            disabled={!!busy}
            onClick={async () => {
              await runSim("squads-close-12", MEMBER_2A4B, closeLegacyTxIxs(DEST), [MEMBER_2A4B], [
                "Requiere rentCollector = 2a4b ya ejecutado. Tx1 debe estar Cancelled/stale; tx2 Executed.",
              ]);
            }}
          >
            Simular close tx1+tx2
          </button>
          <button
            disabled={armed !== "squads-close-12" || !!busy}
            onClick={() =>
              sendArmed("squads-close-12", async () => ({
                feePayer: MEMBER_2A4B,
                ixs: closeLegacyTxIxs(DEST),
                required: [MEMBER_2A4B],
              }))
            }
          >
            Firmar close tx1+tx2
          </button>
        </div>
      </div>

      <h2>B) Creator — conectar 65Gh</h2>
      <div className="card">
        <p className="muted">
          claim_creator_trading_fee de los 3 pools → 2a4b. 65Gh tiene 0 SOL. Flujo simple: 2a4b envía 0.001 SOL a 65Gh
          y después 65Gh paga y firma. Alternativa: 65Gh hace signTransaction (feePayer 2a4b) y 2a4b envía.
        </p>
        <p>
          Live 65Gh: {live ? lamportsToSol(live.creatorLamports) : "?"} · conectá {CREATOR.toBase58()}
        </p>
        <div className="row">
          <button
            disabled={!!busy}
            onClick={async () => {
              const ix = SystemProgram.transfer({
                fromPubkey: DEST,
                toPubkey: CREATOR,
                lamports: FUND_CREATOR_LAMPORTS,
              });
              await runSim("fund-65gh", DEST, [ix], [DEST]);
            }}
          >
            Simular enviar 0.001 SOL a 65Gh
          </button>
          <button
            disabled={armed !== "fund-65gh" || !!busy}
            onClick={() =>
              sendArmed("fund-65gh", async () => ({
                feePayer: DEST,
                ixs: [
                  SystemProgram.transfer({
                    fromPubkey: DEST,
                    toPubkey: CREATOR,
                    lamports: FUND_CREATOR_LAMPORTS,
                  }),
                ],
                required: [DEST],
              }))
            }
          >
            Firmar fondeo
          </button>
        </div>
        <div className="row">
          <button
            disabled={!!busy}
            onClick={async () => {
              const groups = await dbcCreatorClaimIxs(connection, {
                creator: CREATOR,
                payer: CREATOR,
                receiver: DEST,
              });
              await runSim(
                "creator-claim",
                CREATOR,
                groups.flatMap((g) => g.ixs),
                [CREATOR],
                live
                  ? live.dbc.map((r) => `creator ${r.label}: ${solFromLamports(r.creatorQuote).toFixed(6)} SOL`)
                  : []
              );
            }}
          >
            Simular claims creator (65Gh fee payer)
          </button>
          <button
            disabled={armed !== "creator-claim" || !!busy}
            onClick={() =>
              sendArmed("creator-claim", async () => {
                const groups = await dbcCreatorClaimIxs(connection, {
                  creator: CREATOR,
                  payer: CREATOR,
                  receiver: DEST,
                });
                return { feePayer: CREATOR, ixs: groups.flatMap((g) => g.ixs), required: [CREATOR] };
              })
            }
          >
            Firmar claims creator
          </button>
        </div>
        <div className="row">
          <button
            disabled={!!busy || !wallet.signTransaction}
            onClick={async () => {
              setBusy("Partial sign 65Gh…");
              try {
                const groups = await dbcCreatorClaimIxs(connection, {
                  creator: CREATOR,
                  payer: DEST,
                  receiver: DEST,
                });
                const ixs = groups.flatMap((g) => g.ixs);
                const { action } = await runSim("creator-partial", DEST, ixs, [CREATOR, DEST]);
                if (!action.sim.ok) return;
                const blockhash = await freshBlockhash(connection);
                const vtx = compileV0({ payer: DEST, blockhash, ixs });
                if (!eq(connected, CREATOR)) throw new Error("Conectá 65Gh para firmar primero.");
                const signed = await wallet.signTransaction!(vtx);
                setCreatorPartial(signed.serialize());
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            65Gh: signTransaction (feePayer 2a4b)
          </button>
          <button
            disabled={!creatorPartial || !!busy}
            onClick={async () => {
              setBusy("2a4b enviando tx parcial…");
              try {
                if (!eq(connected, DEST)) throw new Error("Conectá 2a4b para enviar.");
                const vtx = VersionedTransaction.deserialize(creatorPartial!);
                const sim = await simulateV0(connection, vtx, [DEST, CREATOR]);
                setLastSim({
                  label: "creator-partial-send",
                  feePayer: DEST,
                  required: [DEST],
                  sim,
                  destDelta: expectedDelta(live?.destLamports ?? 0, sim.accounts[0]?.lamports ?? null),
                  vaultDelta: null,
                  notes: [],
                });
                if (!sim.ok) throw new Error("Sim falló: " + sim.err);
                const s = await wallet.sendTransaction(vtx, connection);
                setSig(s);
                setCreatorPartial(null);
              } catch (e) {
                setErr(e instanceof Error ? e.message : String(e));
              } finally {
                setBusy(null);
              }
            }}
          >
            2a4b: enviar tx ya firmada por 65Gh
          </button>
        </div>
      </div>

      <h2>C) Rent — ATAs vacías (no frozen, balance 0)</h2>
      <div className="card">
        {!live && <p className="muted">Releé montos para listar cuentas.</p>}
        {live &&
          RENT_OWNERS.map((o) => {
            const row = live.rentByOwner[o.label];
            const batches = batchAccounts(row.empty);
            return (
              <div key={o.label}>
                <h3>
                  {o.label} · {o.pubkey.toBase58()} · SOL {lamportsToSol(row.lamports)}
                </h3>
                <p className="muted">
                  Cerrar {row.empty.length} vacías ({lamportsToSol(row.empty.reduce((s, t) => s + t.lamports, 0))}).
                  Saltadas frozen: {row.skippedFrozen.map((t) => t.pubkey.toBase58()).join(", ") || "ninguna"}. Con
                  balance&gt;0: {row.skippedBalanced.length}.
                </p>
                <ul>
                  {row.empty.map((t) => (
                    <li key={t.pubkey.toBase58()} className="mono">
                      {t.pubkey.toBase58()} mint {t.mint.toBase58()} {t.lamports} lamports
                    </li>
                  ))}
                </ul>
                {batches.map((batch, i) => {
                  const id = `rent-${o.label}-${i}`;
                  const feePayer = row.lamports > 50_000 ? o.pubkey : DEST;
                  const extra =
                    feePayer.equals(DEST) && !o.pubkey.equals(DEST)
                      ? [DEST, o.pubkey]
                      : [o.pubkey];
                  return (
                    <div className="row" key={id}>
                      <button
                        disabled={!!busy}
                        onClick={() => runSim(id, feePayer, closeAccountIxs(batch), extra)}
                      >
                        Simular close {o.label} lote {i + 1}/{batches.length}
                      </button>
                      <button
                        disabled={armed !== id || !!busy}
                        onClick={() =>
                          sendArmed(id, async () => ({
                            feePayer,
                            ixs: closeAccountIxs(batch),
                            required: extra.length === 2 ? [o.pubkey] : [o.pubkey],
                          }))
                        }
                      >
                        Firmar lote {i + 1}
                      </button>
                      {extra.length === 2 && (
                        <span className="muted">
                          6shB/EW4o/97Ly sin SOL: fee payer 2a4b. Conectá el owner para signTransaction; si Phantom
                          solo firma una wallet, fondeá ~0.001 SOL al owner primero (misma idea que 65Gh).
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
      </div>

      <h2>D) Opcional — BTvN vende A8fN en DBC 4HQX8</h2>
      <div className="card">
        <p className="warn">Opcional. Slippage cap en bps. Cierra la ATA después del swap. Destino SOL: 2a4b.</p>
        <p className="mono">Wallet {BTVN.toBase58()} · ATA eGWSfKZQLsbcEVfCv6PmTdiLfNQp4z7ZE8VoBMQ2A3j</p>
        <div className="row">
          <label>
            slippage bps{" "}
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(Number(e.target.value))}
              style={{ minWidth: 80 }}
            />
          </label>
          <button
            disabled={!!busy || !live || live.btvnA8fnRaw === 0n}
            onClick={async () => {
              const built = await btvnSellIxs(connection, {
                owner: BTVN,
                payer: DEST,
                amountIn: new BN(live!.btvnA8fnRaw.toString()),
                slippageBps: slippage,
              });
              await runSim("btvn-sell", DEST, built.ixs, [BTVN, DEST], [
                `minOut ${built.minOut.toString()} lamports · expected ${built.expectedOut.toString()}`,
                "BTvN no tiene rent para ATA WSOL: fee payer 2a4b. Conectá BTvN para firmar el swap, o fondeá BTvN y cambiá el flujo.",
              ]);
            }}
          >
            Simular swap+close
          </button>
          <button
            disabled={armed !== "btvn-sell" || !!busy}
            onClick={() =>
              sendArmed("btvn-sell", async () => {
                if (!live) throw new Error("sin live");
                const built = await btvnSellIxs(connection, {
                  owner: BTVN,
                  payer: DEST,
                  amountIn: new BN(live.btvnA8fnRaw.toString()),
                  slippageBps: slippage,
                });
                return { feePayer: DEST, ixs: built.ixs, required: [BTVN] };
              })
            }
          >
            Firmar swap opcional
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);
  const connectionEl = React.createElement(
    ConnectionProvider as unknown as React.FC<{ endpoint: string; children?: React.ReactNode }>,
    { endpoint: DEFAULT_RPC },
    React.createElement(
      WalletProvider as unknown as React.FC<{
        wallets: PhantomWalletAdapter[];
        autoConnect: boolean;
        children?: React.ReactNode;
      }>,
      { wallets, autoConnect: false },
      React.createElement(
        WalletModalProvider as unknown as React.FC<{ children?: React.ReactNode }>,
        null,
        React.createElement(Kit)
      )
    )
  );
  return connectionEl;
}
