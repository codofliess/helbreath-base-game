#pragma once

namespace cl::core {

// How a tile coordinate becomes a world pixel.
// AuthoredGrid matches the 32px cells the existing maps were drawn for.
// Diamond is the 2:1 layout for sheets that are baked as diamond footprints.
enum class Projection {
    AuthoredGrid = 0,
    Diamond = 1,
};

struct Vec2 {
    float x = 0.f;
    float y = 0.f;
};

// sp-client documents TILE_SIZE as 32. Ground frames in tile406-421.spr are 32x32.
inline constexpr float kCellPixels = 32.f;

inline Vec2 projectTile(Projection projection, int tileX, int tileY, float cell = kCellPixels) {
    if (projection == Projection::Diamond) {
        return {(tileX - tileY) * (cell * 0.5f), (tileX + tileY) * (cell * 0.25f)};
    }
    return {tileX * cell, tileY * cell};
}

}  // namespace cl::core
