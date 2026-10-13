#pragma once

#include "core/Projection.hpp"
#include "core/TileMap.hpp"
#include "core/nft/NftDropPort.hpp"

#include <cstdint>
#include <vector>

namespace cl::core {

// A sprite rectangle in world pixels, ready for a batch.
struct SpriteQuad {
    float x = 0.f;
    float y = 0.f;
    float w = 0.f;
    float h = 0.f;
    float u0 = 0.f;
    float v0 = 0.f;
    float u1 = 1.f;
    float v1 = 1.f;
    float r = 1.f;
    float g = 1.f;
    float b = 1.f;
    float a = 1.f;
    unsigned texture = 0;
    int layer = 0;
};

// Pixel rectangle inside a sheet. sourceScale is 1 for original sprites and 4
// for the Real-ESRGAN sheets from PR #126, whose frame rectangles are already ×4.
struct FrameView {
    unsigned texture = 0;
    float u0 = 0.f;
    float v0 = 0.f;
    float u1 = 1.f;
    float v1 = 1.f;
    int pixelW = 0;
    int pixelH = 0;
    int pivotX = 0;
    int pivotY = 0;
    int sourceScale = 1;
};

class FrameLookup {
public:
    virtual ~FrameLookup() = default;
    virtual const FrameView* find(int sprite, int frame) const = 0;
};

struct MonsterSprite {
    float anchorX = 0.f;
    float anchorY = 0.f;
    FrameView frame;
    bool visible = false;
};

// Ground, then objects sorted by foot row, then the monster, then NFT badges.
// Object and monster anchors sit on the cell center. Pivot shifts the bitmap
// the same way the existing client applies pivotX/pivotY from the .spr frame.
void appendIsoFrame(std::vector<SpriteQuad>& out,
                    const TileMap& map,
                    const FrameLookup& frames,
                    Projection projection,
                    const MonsterSprite* monster,
                    const std::vector<ServerMintDecision>* nftNotices);

}  // namespace cl::core
