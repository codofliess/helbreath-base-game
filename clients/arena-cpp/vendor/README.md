# Vendor drop zone

Place a **compiling** Olympia / Helbreath-lineage client tree here:

```
vendor/olympia-client/
  … sources, project files, local asset pointers …
```

Rules:
- Do not commit multi‑GB `.spr` packs without LFS.
- Strip non-arena maps before linking to production binary.
- Replace networking with `cl_arena::ArenaNetClient` (our protobuf WS).
- Keep Chain Lords art/VFX as source of truth (`assets/`).
