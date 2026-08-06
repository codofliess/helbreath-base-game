#pragma once

#include <string>
#include <string_view>
#include <unordered_map>

namespace cl_arena {

/// Maps server spell ids / effect keys → Chain Lords VFX asset paths.
/// Olympia default effect art is NOT the source of truth — our sheets are.
struct VfxBinding {
    std::string spellKey;       // e.g. "bloody_shock_wave"
    std::string sheetPath;      // relative to assets/vfx
    std::string originMode;     // feet | chest | target | sky
    bool useChainLordsArt{true};
};

inline const std::unordered_map<std::string, VfxBinding>& DefaultVfxTable() {
    static const std::unordered_map<std::string, VfxBinding> kTable = {
        {"bloody_shock_wave",
         {"bloody_shock_wave", "vfx/bloody_shock_wave", "feet", true}},
        {"earth_shock_wave",
         {"earth_shock_wave", "vfx/earth_shock_wave", "feet", true}},
        {"energy_bolt", {"energy_bolt", "vfx/energy_bolt", "chest", true}},
        {"energy_strike", {"energy_strike", "vfx/energy_strike", "chest", true}},
        {"fire_ball", {"fire_ball", "vfx/fire_ball", "chest", true}},
        {"lightning_bolt", {"lightning_bolt", "vfx/lightning_bolt", "sky", true}},
        {"blizzard", {"blizzard", "vfx/blizzard", "target", true}},
        {"meteor_strike", {"meteor_strike", "vfx/meteor_strike", "sky", true}},
    };
    return kTable;
}

inline const VfxBinding* FindVfx(std::string_view spellKey) {
    const auto& t = DefaultVfxTable();
    auto it = t.find(std::string(spellKey));
    if (it == t.end()) {
        return nullptr;
    }
    return &it->second;
}

}  // namespace cl_arena
