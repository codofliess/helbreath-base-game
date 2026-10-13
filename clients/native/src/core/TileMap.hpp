#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace cl::core {

// One cell of an .amd map.
// Flag bits are the ones documented in sp-client/docs/MAP_RENDERING.md:
//   bit 7 (0x80) blocked, bit 6 (0x40) teleport, bit 5 (0x20) farming.
// bsmith_1.amd records TILESIZE = 10, so a tenth byte exists. This repo's map
// doc describes nine bytes. The extra byte is kept and not interpreted.
struct TileCell {
    std::int16_t groundSprite = 0;
    std::int16_t groundFrame = 0;
    std::int16_t objectSprite = 0;
    std::int16_t objectFrame = 0;
    std::uint8_t flags = 0;
    std::uint8_t uninterpreted = 0;

    bool blocksMovement() const { return (flags & 0x80) != 0; }
    bool isTeleport() const { return (flags & 0x40) != 0; }
    bool allowsFarming() const { return (flags & 0x20) != 0; }
};

struct TileMap {
    std::string name;
    int width = 0;
    int height = 0;
    int tileBytes = 0;
    std::vector<TileCell> cells;

    const TileCell* at(int x, int y) const {
        if (x < 0 || y < 0 || x >= width || y >= height) {
            return nullptr;
        }
        return &cells[static_cast<std::size_t>(y * width + x)];
    }

    bool contentBounds(int& x0, int& y0, int& x1, int& y1) const;
};

}  // namespace cl::core
