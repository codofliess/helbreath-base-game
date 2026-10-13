#pragma once

#include "adapters/assets/Sprite.hpp"
#include "core/IsoFrame.hpp"
#include "core/TileMap.hpp"

#include <string>
#include <unordered_map>
#include <vector>

namespace cl::assets {

struct SampleLoad {
    cl::core::TileMap map;
    // Ground and object frames, keyed by sprite<<32 | frame. Texture ids are filled later.
    std::unordered_map<std::uint64_t, cl::core::FrameView> frames;
    std::vector<std::uint8_t> atlas;
    int atlasW = 0;
    int atlasH = 0;
    // One RGBA image per monster sheet. The sample plays idle, sheets 0-7.
    std::vector<SpriteSheet> monsterSheets;
    int monsterScale = 1;
    int monsterSheetBase = 0;
    bool placeholder = false;
    bool usedUpscaleExperiment = false;
    std::vector<std::string> notes;
    std::string monsterName;
};

// Prefers experiments/upscale-2026-10-04/after when those files from PR #126 are
// present. Otherwise loads the original blacksmith map and slime.
bool loadSample(const std::string& repoRoot, SampleLoad& out, std::string& error);

inline std::uint64_t frameKey(int sprite, int frame) {
    return (static_cast<std::uint64_t>(static_cast<std::uint32_t>(sprite)) << 32) |
           static_cast<std::uint32_t>(frame);
}

}  // namespace cl::assets
