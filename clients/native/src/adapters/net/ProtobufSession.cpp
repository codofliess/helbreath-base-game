#include "adapters/net/ProtobufSession.hpp"

#include "network.pb.h"

namespace cl::net {

bool ProtobufSession::connect(std::string_view url, std::string& error) {
    error = "WebSocket transport is not linked yet. Protobuf frames are decoded locally. url=" + std::string(url);
    return false;
}

void ProtobufSession::disconnect() {}

std::optional<DecodedServerFrame> ProtobufSession::decodeServerFrame(std::span<const std::uint8_t> bytes, std::string& error) const {
    mmorpg::network::ServerMessage message;
    if (!message.ParseFromArray(bytes.data(), static_cast<int>(bytes.size()))) {
        error = "ServerMessage did not parse";
        return std::nullopt;
    }
    DecodedServerFrame frame;
    frame.payloadCase = static_cast<int>(message.payload_case());
    if (message.payload_case() == mmorpg::network::ServerMessage::kGroundStatesEnteredRange) {
        const auto& entered = message.ground_states_entered_range();
        for (const auto& cell : entered.states()) {
            if (cell.has_ground_item()) {
                ++frame.groundItemCount;
            }
        }
    }
    // A ground item stays a ground item. mint.js / the server would have to send
    // a separate notice with a claim id before NftDropPort will show a badge.
    return frame;
}

}  // namespace cl::net
