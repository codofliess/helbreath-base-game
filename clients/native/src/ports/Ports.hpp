#pragma once

#include <string>
#include <string_view>

namespace cl::ports {

struct InputFrame {
    bool panLeft = false;
    bool panRight = false;
    bool panUp = false;
    bool panDown = false;
    bool zoomIn = false;
    bool zoomOut = false;
    bool quit = false;
    bool screenshot = false;
    float wheel = 0.f;
};

class IInput {
public:
    virtual ~IInput() = default;
    virtual InputFrame poll() = 0;
};

class IAudio {
public:
    virtual ~IAudio() = default;
    virtual void play(std::string_view cue) = 0;
};

class NullAudio final : public IAudio {
public:
    void play(std::string_view) override {}
};

// Socket lifecycle. Decoding lives on the protobuf adapter, which does not mint.
class INetworkSession {
public:
    virtual ~INetworkSession() = default;
    virtual bool connect(std::string_view url, std::string& error) = 0;
    virtual void disconnect() = 0;
    virtual bool isConnected() const = 0;
};

}  // namespace cl::ports
