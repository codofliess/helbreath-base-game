# Moved: Vultr arena region is Santiago, not São Paulo

Elon cut the hybrid arena region to **Vultr Santiago (`scl`)**. São Paulo (`sao`) is **discarded** (region premium).

Canonical runbook: [`ops/migrate-to-vultr-scl-arena.md`](./migrate-to-vultr-scl-arena.md)

- World: keep Hetzner CX53 fsn1 (`OLD_IP=46.224.129.38`)
- Arena: hostname **`cl-arena-scl1`**, plan **`vc2-4c-8gb`** (~US$40), **no backups**, same SSH key
- Miami (`mia`) only if SCL has no stock
