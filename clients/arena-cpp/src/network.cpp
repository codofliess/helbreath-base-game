#include "cl_arena/network.hpp"

#include <cstring>
#include <iostream>

namespace cl_arena {

namespace {

void Log(ArenaNetClient* self, std::string_view msg) {
    if (self && self->onLog) {
        self->onLog(msg);
    } else {
        std::cerr << "[cl_arena] " << msg << "\n";
    }
}

// Length-prefix LE u32 + payload (same framing as multiplayer mp-client).
std::vector<uint8_t> FramePayload(const std::vector<uint8_t>& payload) {
    std::vector<uint8_t> out(4 + payload.size());
    const uint32_t n = static_cast<uint32_t>(payload.size());
    out[0] = static_cast<uint8_t>(n & 0xff);
    out[1] = static_cast<uint8_t>((n >> 8) & 0xff);
    out[2] = static_cast<uint8_t>((n >> 16) & 0xff);
    out[3] = static_cast<uint8_t>((n >> 24) & 0xff);
    if (!payload.empty()) {
        std::memcpy(out.data() + 4, payload.data(), payload.size());
    }
    return out;
}

}  // namespace

ArenaNetClient::ArenaNetClient(std::shared_ptr<IWebSocket> ws) : ws_(std::move(ws)) {
    if (!ws_) {
        return;
    }
    ws_->onBinary = [this](const uint8_t* data, size_t len) { OnServerFrame(data, len); };
    ws_->onError = [this](std::string_view err) {
        state_ = ConnState::Error;
        Log(this, err);
    };
    ws_->onOpen = [this]() {
        state_ = ConnState::Connected;
        Log(this, "WebSocket open");
    };
    ws_->onClose = [this]() {
        state_ = ConnState::Disconnected;
        Log(this, "WebSocket closed");
    };
}

void ArenaNetClient::SetEndpoints(std::string wsUrl, std::string middlewareAuthUrl) {
    wsUrl_ = std::move(wsUrl);
    middlewareAuthUrl_ = std::move(middlewareAuthUrl);
}

bool ArenaNetClient::Connect() {
    if (!ws_) {
        Log(this, "No WebSocket transport");
        return false;
    }
    state_ = ConnState::Connecting;
    Log(this, std::string("Connecting ") + wsUrl_);
    return ws_->Connect(wsUrl_);
}

void ArenaNetClient::Disconnect() {
    if (ws_) {
        ws_->Close();
    }
    state_ = ConnState::Disconnected;
}

void ArenaNetClient::Tick() {
    if (ws_) {
        ws_->Poll();
    }
}

bool ArenaNetClient::AuthenticateWithWalletToken(std::string_view wallet, std::string_view authToken,
                                                 std::string_view characterName,
                                                 std::string_view preferredWorldId,
                                                 std::string_view arenaKitJson) {
    // M1: encode mmorpg.network.ClientMessage { authenticate_request { … } }
    // M0: log intent and mark authenticated for local shell tests.
    Log(this, std::string("Auth wallet=") + std::string(wallet) + " char=" + std::string(characterName) +
                  " world=" + std::string(preferredWorldId) + " kit_len=" +
                  std::to_string(arenaKitJson.size()) + " token_len=" + std::to_string(authToken.size()));
    if (state_ == ConnState::Connected || state_ == ConnState::Authenticated) {
        state_ = ConnState::Authenticated;
        return true;
    }
    Log(this, "Authenticate skipped — not connected (wire M1)");
    return false;
}

bool ArenaNetClient::SendClientMessageBytes(const std::vector<uint8_t>& protoBytes) {
    if (!ws_ || state_ == ConnState::Disconnected || state_ == ConnState::Error) {
        return false;
    }
    const auto framed = FramePayload(protoBytes);
    return ws_->SendBinary(framed.data(), framed.size());
}

void ArenaNetClient::OnServerFrame(const uint8_t* data, size_t len) {
    if (len < 4) {
        return;
    }
    const uint32_t n = static_cast<uint32_t>(data[0]) | (static_cast<uint32_t>(data[1]) << 8) |
                       (static_cast<uint32_t>(data[2]) << 16) | (static_cast<uint32_t>(data[3]) << 24);
    if (4 + n > len) {
        return;
    }
    // M1: parse ServerMessage; extract ArenaPactState → lastMatch_ / onMatchState
    Log(this, std::string("RX frame payload bytes=") + std::to_string(n));
    (void)data;
}

bool ArenaNetClient::PactCreate(std::string_view mapWorldId, bool isPublic, std::string_view title) {
    Log(this, std::string("PactCreate world=") + std::string(mapWorldId) +
                  " public=" + (isPublic ? "1" : "0") + " title=" + std::string(title));
    // M1: serialize ArenaPactCreateRequest
    return state_ == ConnState::Authenticated || state_ == ConnState::InArena ||
           state_ == ConnState::Connected;
}

bool ArenaNetClient::PactInvite(std::string_view matchId, std::string_view targetCharacter) {
    Log(this, std::string("PactInvite match=") + std::string(matchId) +
                  " target=" + std::string(targetCharacter));
    return true;
}

bool ArenaNetClient::PactRespond(std::string_view matchId, std::string_view mode) {
    Log(this, std::string("PactRespond match=") + std::string(matchId) + " mode=" + std::string(mode));
    return true;
}

bool ArenaNetClient::PactReady(std::string_view matchId, bool ready) {
    Log(this, std::string("PactReady match=") + std::string(matchId) +
                  " ready=" + (ready ? "1" : "0"));
    return true;
}

bool ArenaNetClient::PactCancel(std::string_view matchId) {
    Log(this, std::string("PactCancel match=") + std::string(matchId));
    return true;
}

bool ArenaNetClient::PrizePledge(std::string_view matchId, std::string_view assetId, int64_t amount,
                                 std::string_view instanceId) {
    Log(this, std::string("PrizePledge match=") + std::string(matchId) + " asset=" +
                  std::string(assetId) + " amount=" + std::to_string(amount) +
                  " inst=" + std::string(instanceId));
    return true;
}

bool ArenaNetClient::PrizeConfirm(std::string_view matchId) {
    Log(this, std::string("PrizeConfirm match=") + std::string(matchId));
    return true;
}

bool ArenaNetClient::SignLoss(std::string_view matchId) {
    Log(this, std::string("SignLoss match=") + std::string(matchId));
    return true;
}

}  // namespace cl_arena
