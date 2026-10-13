#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace cl::core {

// A mint decision that already happened on the server / middleware.
// The client displays it. It does not decide importance and it does not mint.
struct ServerMintDecision {
    std::int64_t itemUid = 0;
    std::int32_t itemId = 0;
    std::string worldId;
    int tileX = 0;
    int tileY = 0;
    std::string claimId;
    std::string assetId;
};

struct ClaimRequest {
    std::string claimId;
};

class NftDropPort {
public:
    // Rejects a notice that has no server-issued claim id, so the client cannot
    // fill one in and treat a local drop as minted.
    bool ingestServerNotice(ServerMintDecision decision, std::string& error);

    // Forwards an existing claim id. Does not create an asset id.
    bool requestClaim(std::string_view claimId, std::string& error);

    const std::vector<ServerMintDecision>& visible() const { return notices_; }
    const std::vector<ClaimRequest>& outboundClaims() const { return claims_; }
    bool empty() const { return notices_.empty(); }

private:
    std::vector<ServerMintDecision> notices_;
    std::vector<ClaimRequest> claims_;
};

}  // namespace cl::core
