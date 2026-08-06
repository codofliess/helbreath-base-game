#include "cl_arena/arena_maps.hpp"
#include "cl_arena/network.hpp"
#include "cl_arena/vfx_policy.hpp"

#include <iostream>
#include <memory>
#include <string>

namespace {

void PrintHelp() {
    std::cout
        << "Chain Lords Arena C++ — bootstrap (M0)\n"
        << "Usage:\n"
        << "  cl_arena_bootstrap [--help]\n"
        << "  cl_arena_bootstrap --check-world <worldId>\n"
        << "  cl_arena_bootstrap --list-vfx\n"
        << "  cl_arena_bootstrap --dry-connect\n"
        << "\n"
        << "Production path: Option B fork (Olympia motor + our wire/art/VFX).\n"
        << "World client remains web; this binary is arena-only.\n";
}

}  // namespace

int main(int argc, char** argv) {
    using namespace cl_arena;

    std::string cmd;
    std::string arg;
    if (argc >= 2) {
        cmd = argv[1];
    }
    if (argc >= 3) {
        arg = argv[2];
    }

    if (cmd == "--help" || cmd == "-h" || cmd.empty()) {
        PrintHelp();
        if (cmd.empty()) {
            // Default smoke: allowlist + vfx table
            const auto worlds = DefaultArenaWorlds();
            std::cout << "Arena worlds (" << worlds.size() << "):\n";
            for (const auto& w : worlds) {
                std::cout << "  " << w.id << " → " << w.map << " (" << w.size << ")\n";
            }
            std::cout << "VFX bindings: " << DefaultVfxTable().size() << " spells (CL art)\n";
            std::cout << "M0 OK — drop Olympia under vendor/olympia-client and run M1 wire.\n";
        }
        return 0;
    }

    if (cmd == "--check-world") {
        const bool ok = IsArenaWorldAllowed(arg, DefaultArenaWorlds());
        std::cout << arg << (ok ? " ALLOWED\n" : " BLOCKED (open-world — use web client)\n");
        return ok ? 0 : 2;
    }

    if (cmd == "--list-vfx") {
        for (const auto& [k, v] : DefaultVfxTable()) {
            std::cout << k << " → " << v.sheetPath << " origin=" << v.originMode << "\n";
        }
        return 0;
    }

    if (cmd == "--dry-connect") {
        auto ws = std::make_shared<NullWebSocket>();
        ArenaNetClient net(ws);
        net.SetEndpoints("ws://127.0.0.1:5080/ws", "http://127.0.0.1:3099");
        net.onLog = [](std::string_view m) { std::cout << m << "\n"; };
        if (!net.Connect()) {
            return 1;
        }
        net.AuthenticateWithWalletToken("DemoWallet111", "token-dev", "TestFighter", "colosseum",
                                        "{}");
        if (!IsArenaWorldAllowed("colosseum", DefaultArenaWorlds())) {
            return 2;
        }
        net.PactCreate("colosseum", true, "CL Arena smoke");
        net.PrizePledge("pact-demo", "HELL", 10000);
        net.PrizeConfirm("pact-demo");
        net.Tick();
        std::cout << "dry-connect OK (NullWebSocket — no real server)\n";
        return 0;
    }

    std::cerr << "Unknown command. Try --help\n";
    return 1;
}
