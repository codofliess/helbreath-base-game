#pragma once

#include <algorithm>
#include <cctype>
#include <fstream>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

// Minimal JSON-ish allowlist reader (no nlohmann dependency in M0).
// For production M1+, swap to nlohmann/json or simdjson.

namespace cl_arena {

struct ArenaWorld {
    std::string id;
    std::string map;
    std::string size;
    bool pactArena{true};
};

inline std::string ToLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

/// Returns true if worldId is on the arena allowlist (hard gate for C++ client).
inline bool IsArenaWorldAllowed(std::string_view worldId,
                                const std::vector<ArenaWorld>& worlds) {
    const auto id = ToLower(std::string(worldId));
    for (const auto& w : worlds) {
        if (ToLower(w.id) == id && w.pactArena) {
            return true;
        }
    }
    // Built-in fallback if config missing
    static const char* kFallback[] = {
        "colosseum", "arena-duel-s", "arena-duel-m", "arena-duel-l",
        "arena-tourney", "arena-btfield",
    };
    for (const char* f : kFallback) {
        if (id == f) {
            return true;
        }
    }
    return false;
}

inline std::vector<ArenaWorld> DefaultArenaWorlds() {
    return {
        {"colosseum", "fightzone1", "medium", true},
        {"arena-duel-s", "fightzone4", "small", true},
        {"arena-duel-m", "fightzone1", "medium", true},
        {"arena-duel-l", "fightzone5", "large", true},
        {"arena-tourney", "fightzone8", "large", true},
        {"arena-btfield", "btfield", "xlarge", true},
    };
}

}  // namespace cl_arena
