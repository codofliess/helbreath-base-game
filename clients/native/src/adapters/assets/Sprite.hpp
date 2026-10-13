#pragma once

#include <cstdint>
#include <string>
#include <vector>

namespace cl::assets {

struct SpriteFrame {
    int left = 0;
    int top = 0;
    int width = 0;
    int height = 0;
    int pivotX = 0;
    int pivotY = 0;
};

struct SpriteSheet {
    int width = 0;
    int height = 0;
    std::vector<SpriteFrame> frames;
    std::vector<std::uint8_t> rgba;
};

struct SpriteFile {
    std::vector<SpriteSheet> sheets;
};

// .spr layout documented in sp-client/docs/SPRITE_FILE_FORMAT.md.
// Little-endian sheet count, then per sheet: frame count, png length, width,
// height, one skipped byte, 12-byte frames, then each sheet's png.
bool loadSpriteFile(const std::string& path, SpriteFile& out, std::string& error);

struct MapLoad {
    std::string name;
    int width = 0;
    int height = 0;
    int tileBytes = 0;
    struct Cell {
        std::int16_t groundSprite = 0;
        std::int16_t groundFrame = 0;
        std::int16_t objectSprite = 0;
        std::int16_t objectFrame = 0;
        std::uint8_t flags = 0;
        std::uint8_t uninterpreted = 0;
    };
    std::vector<Cell> cells;
};

bool loadAmdMap(const std::string& path, MapLoad& out, std::string& error);

bool writePng(const std::string& path, int width, int height, const unsigned char* rgba);

}  // namespace cl::assets
