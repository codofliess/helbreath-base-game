#pragma once

#include "core/nft/NftDropPort.hpp"
#include "ports/Ports.hpp"

#include <cstdint>
#include <optional>
#include <span>
#include <string>

namespace cl::net {

// multiplayer/server/Config/Settings.json field "port".
inline constexpr int kDocumentedDefaultServerPort = 1337;

// One websocket binary frame is one protobuf ClientMessage or ServerMessage.
// The browser client decodes event.data directly (NetworkManager.ts). The server
// parses the same way (Server.cs, ClientMessage.Parser.ParseFrom).
struct DecodedServerFrame {
    int payloadCase = 0;
    int groundItemCount = 0;
};

// Ground loot is not an NFT. This function is the only bridge from a decoded
// gameplay frame to the drop port, and it does not announce a mint.
inline void applyGameplayFrame(const DecodedServerFrame& frame, cl::core::NftDropPort& nft) {
    (void)frame;
    (void)nft;
}

class ProtobufSession final : public cl::ports::INetworkSession {
public:
    bool connect(std::string_view url, std::string& error) override;
    void disconnect() override;
    bool isConnected() const override { return false; }

    std::optional<DecodedServerFrame> decodeServerFrame(std::span<const std::uint8_t> bytes, std::string& error) const;
};

}  // namespace cl::net
