#pragma once

#include <cstdint>
#include <functional>
#include <memory>
#include <string>
#include <string_view>
#include <vector>

namespace cl_arena {

/// Binary frame = [u32 LE length][protobuf bytes] matching mp-client NetworkManager.
struct WireFrame {
    std::vector<uint8_t> payload;
};

enum class ConnState {
    Disconnected,
    Connecting,
    Connected,
    Authenticated,
    InArena,
    Error,
};

/// Prize bag line (mirrors ArenaPactPrizeLine / Phase 1).
struct PrizeLine {
    std::string assetId;
    int64_t amount{0};
    std::string captainName;
    int team{0};
    std::string instanceId;
};

struct ArenaMatchView {
    std::string matchId;
    std::string status;  // scheduled|ready_window|…|live|dc_grace|done
    std::string mapId;
    std::string hostName;
    std::string message;
    int secondsLeft{0};
    std::string prizeBagState;
    std::string prizeSummary;
    std::vector<PrizeLine> prizeLines;
    std::string dcCharacterName;
    int64_t dcGraceEndsAtMs{0};
};

/// Abstract transport — implement with IXWebSocket / Boost.Beast / WinHTTP.
class IWebSocket {
public:
    virtual ~IWebSocket() = default;
    virtual bool Connect(std::string_view url) = 0;
    virtual void Close() = 0;
    virtual bool SendBinary(const uint8_t* data, size_t len) = 0;
    virtual void Poll() = 0;
    virtual ConnState State() const = 0;

    std::function<void(const uint8_t*, size_t)> onBinary;
    std::function<void(std::string_view)> onError;
    std::function<void()> onOpen;
    std::function<void()> onClose;
};

/// High-level game API used by the C++ arena shell (wraps protobuf encode/decode).
class ArenaNetClient {
public:
    explicit ArenaNetClient(std::shared_ptr<IWebSocket> ws);

    void SetEndpoints(std::string wsUrl, std::string middlewareAuthUrl);
    bool Connect();
    void Disconnect();
    void Tick();

    /// HTTP middleware: challenge → wallet sign → token (M1).
    bool AuthenticateWithWalletToken(std::string_view wallet, std::string_view authToken,
                                     std::string_view characterName,
                                     std::string_view preferredWorldId,
                                     std::string_view arenaKitJson);

    // —— ArenaPact ——
    bool PactCreate(std::string_view mapWorldId, bool isPublic, std::string_view title);
    bool PactInvite(std::string_view matchId, std::string_view targetCharacter);
    bool PactRespond(std::string_view matchId, std::string_view mode /*accept|decline|honor*/);
    bool PactReady(std::string_view matchId, bool ready);
    bool PactCancel(std::string_view matchId);

    // —— Prize bag (Phase 1 wire) ——
    bool PrizePledge(std::string_view matchId, std::string_view assetId, int64_t amount,
                     std::string_view instanceId = {});
    bool PrizeConfirm(std::string_view matchId);
    bool SignLoss(std::string_view matchId);

    ConnState State() const { return state_; }
    const ArenaMatchView& LastMatch() const { return lastMatch_; }

    std::function<void(const ArenaMatchView&)> onMatchState;
    std::function<void(std::string_view)> onLog;

private:
    bool SendClientMessageBytes(const std::vector<uint8_t>& protoBytes);
    void OnServerFrame(const uint8_t* data, size_t len);

    std::shared_ptr<IWebSocket> ws_;
    std::string wsUrl_;
    std::string middlewareAuthUrl_;
    ConnState state_{ConnState::Disconnected};
    ArenaMatchView lastMatch_{};
};

/// Null transport for compile/link without real sockets (M0).
class NullWebSocket final : public IWebSocket {
public:
    bool Connect(std::string_view) override {
        state_ = ConnState::Connected;
        if (onOpen) {
            onOpen();
        }
        return true;
    }
    void Close() override { state_ = ConnState::Disconnected; }
    bool SendBinary(const uint8_t*, size_t) override { return state_ == ConnState::Connected; }
    void Poll() override {}
    ConnState State() const override { return state_; }

private:
    ConnState state_{ConnState::Disconnected};
};

}  // namespace cl_arena
