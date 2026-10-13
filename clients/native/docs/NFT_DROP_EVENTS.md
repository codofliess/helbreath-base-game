# NFT drop events

An important drop becomes an NFT only when the server and the middleware decide that and mint it. The client shows the notice, a badge, and a claim action. It does not decide importance, it does not mint, and it does not invent a claim id or an asset id.

`mint.js` is not in this repository. The playtest door treats `HELL_MINT` as a live-mint switch and refuses to start when that variable is set. That is the boundary this client copies: minting is outside the process.

## Client port

`NftDropPort` (`src/core/nft/NftDropPort.hpp`):

- `ingestServerNotice` stores a `ServerMintDecision`. The claim id must already be set. An empty claim id is rejected, so a local drop cannot be promoted by filling one in.
- `requestClaim` forwards a claim id that is already in the visible list. It does not allocate an asset id. The outbound list is what a future socket send would carry.
- `visible()` is what the renderer reads. Each notice draws a small badge on that tile. With an empty port, the sample frame has no badge.

There is no client function that mints, and no client function that marks an item important.

## What the network adapter does today

`network.proto` has `GroundItemEntry` on `GroundStatesEnteredRange`. That is ordinary loot. `ProtobufSession::decodeServerFrame` counts those items. `applyGameplayFrame` is the only function that receives both the decoded frame and the NFT port, and it does not call `ingestServerNotice`. A unit test serializes a ground item and checks the port stays empty.

A future server message, added in `network.proto` by the server owners, would carry the decision the middleware already made. The client would copy fields and stop. Suggested shape, not added to the proto in this change:

- `item_uid`, `item_id` — the drop the server already tracks
- `world_id`, `loc` — where to draw the badge
- `claim_id` — opaque id issued with the mint, required
- `asset_id` — cNFT id from the middleware, possibly empty until the mint is confirmed

The client would not send a mint transaction. Claim sends `claim_id` back. The server or middleware performs the claim.

The websocket itself is not linked in this skeleton. `connect` fails with an explanation. When it is linked, one binary websocket frame is one `ClientMessage` or `ServerMessage`, which is how `multiplayer/mp-client` and `Server.cs` already frame the protobuf. The default port in `multiplayer/server/Config/Settings.json` is 1337, path `/ws`.
