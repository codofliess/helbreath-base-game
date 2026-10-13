#include "core/nft/NftDropPort.hpp"

namespace cl::core {

bool NftDropPort::ingestServerNotice(ServerMintDecision decision, std::string& error) {
    if (decision.claimId.empty()) {
        error = "refusing an NFT notice with no server claim id";
        return false;
    }
    notices_.push_back(std::move(decision));
    return true;
}

bool NftDropPort::requestClaim(std::string_view claimId, std::string& error) {
    if (claimId.empty()) {
        error = "claim id is empty";
        return false;
    }
    for (const ServerMintDecision& notice : notices_) {
        if (notice.claimId == claimId) {
            claims_.push_back(ClaimRequest{std::string(claimId)});
            return true;
        }
    }
    error = "claim id is not one the server announced";
    return false;
}

}  // namespace cl::core
