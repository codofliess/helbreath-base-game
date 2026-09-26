# Kit de recuperación (autocustodia)

Sitio estático local. **Phantom firma todo.** El kit no pide, no lee, no genera ni guarda claves ni seeds. No envía transacciones solo. No usa `.env`.

Destino de fondos: `2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy`.

## Cómo correrlo

```bash
cd tools/recovery-kit
npm i
npm run dev
```

Abrí `http://127.0.0.1:5173` con Phantom (mainnet). Opcional: RPC propio en el input (el público `api.mainnet-beta.solana.com` reintenta 429).

Tests: `npm test`. Dry-run (arma y simula, **no envía**):

```bash
npm run dry-run
# o: npm run dry-run -- --rpc=https://tu-rpc
```

## Qué wallet conectar

| Paso | Wallet en Phantom |
| --- | --- |
| A Squads (crear, votar 2a4b, execute, config rent) | `2a4bUA9ChQ3NZdrr8HTpB8zbDTv6EzJW1LMJYCY3djyy` (miembro) |
| A segundo voto | `62TB1RLxWeSYicULGAboYT97aEiuMfrAWhK3a8dwUUHk` **o** `6shBsBCuUZP7k7Xs81F8qHvidnGApG9KHvqwzGGHtYbA` (la otra cuenta; este kit no la firma) |
| B Creator claims | `65GhX7QsKfvdmbsaMBz4iEGgpcZZQnDRh4kgjTJbgT8q` (0 SOL: primero fondeá 0.001 desde 2a4b, o partial-sign) |
| C Rent 2a4b | 2a4b |
| C Rent 6shB / 97Ly / EW4o | el owner de cada ATA; si tiene 0 SOL, fondeá 0.001 desde 2a4b |
| D Opcional venta A8fN | `BTvNgC6MYNmbfxqakyCda32pBWxM7SbJPZKvTYPo4jSh` |

## Advertencias

- Fail-closed: primero **Simular**; el botón de firmar solo se habilita si `simulateTransaction` da OK. Al firmar se reconstruye con blockhash fresco y se vuelve a simular.
- **No hay `remove_liquidity`**. La retirada de LP DAMM está excluida a propósito.
- Los claims del vault no entran en UNA `vaultTransactionCreate` (límite 1232 B). El kit arma el mínimo (hoy 3: A8fN+4Sk2, 3gZV, DAMM+transfer SOL). `proposalCreate` es un paso aparte.
- Execute Squads exige umbral 2/3: voto de 2a4b **y** de 62TB o 6shB.
- tx1 Active: `proposalCancel` falla (InvalidProposalStatus). Usá **reject** (sim OK) y después, con `rentCollector` ya seteado, `vault_transaction_accounts_close`.
- Revisá siempre el delta de SOL de 2a4b en la simulación antes de aprobar en Phantom.
- Este código construye txs en el cliente. No pegues seeds. No exportes la wallet.
