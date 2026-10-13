#include "adapters/assets/SampleAssets.hpp"

#include <algorithm>
#include <filesystem>

namespace cl::assets {
namespace {

namespace fs = std::filesystem;

bool isFile(const fs::path& path) { return fs::is_regular_file(path); }

void blit(std::vector<std::uint8_t>& dst, int dstW, int dx, int dy, const std::uint8_t* src, int srcW, int sx, int sy, int w, int h) {
    for (int y = 0; y < h; ++y) {
        const std::uint8_t* from = src + (static_cast<std::size_t>(sy + y) * static_cast<std::size_t>(srcW) + static_cast<std::size_t>(sx)) * 4u;
        std::uint8_t* to = dst.data() + (static_cast<std::size_t>(dy + y) * static_cast<std::size_t>(dstW) + static_cast<std::size_t>(dx)) * 4u;
        std::copy(from, from + static_cast<std::size_t>(w) * 4u, to);
    }
}

struct Shelf {
    int width = 1024;
    int height = 1024;
    int x = 0;
    int y = 0;
    int rowH = 0;
    std::vector<std::uint8_t> rgba;

    explicit Shelf(int size) : width(size), height(size), rgba(static_cast<std::size_t>(size * size * 4), 0) {}

    bool grow() {
        if (width >= 4096) {
            return false;
        }
        const int next = width * 2;
        std::vector<std::uint8_t> bigger(static_cast<std::size_t>(next * next * 4), 0);
        for (int row = 0; row < height; ++row) {
            std::copy(rgba.begin() + static_cast<std::ptrdiff_t>(row * width * 4),
                      rgba.begin() + static_cast<std::ptrdiff_t>((row * width + width) * 4),
                      bigger.begin() + static_cast<std::ptrdiff_t>(row * next * 4));
        }
        width = next;
        height = next;
        rgba.swap(bigger);
        return true;
    }

    bool place(int w, int h, int& dx, int& dy) {
        if (w > width || h > height) {
            return false;
        }
        for (;;) {
            if (x + w <= width && y + h <= height) {
                dx = x;
                dy = y;
                x += w;
                if (h > rowH) {
                    rowH = h;
                }
                return true;
            }
            if (y + rowH + h <= height) {
                x = 0;
                y += rowH;
                rowH = 0;
                continue;
            }
            if (!grow()) {
                return false;
            }
        }
    }
};

// Pixel origins are recorded first. UVs are written after the shelf stops growing.
bool packGroundStable(const SpriteFile& tiles, int indexBase, int sourceScale, const cl::core::TileMap& map, SampleLoad& out, std::string& error) {
    struct Placed {
        std::uint64_t key;
        int dx, dy, w, h, pivotX, pivotY;
    };
    Shelf shelf(sourceScale > 1 ? 2048 : 1024);
    std::vector<Placed> placed;
    for (int y = 0; y < map.height; ++y) {
        for (int x = 0; x < map.width; ++x) {
            const cl::core::TileCell& cell = map.cells[static_cast<std::size_t>(y * map.width + x)];
            const int sprites[2] = {cell.groundSprite, cell.objectSprite};
            const int frames[2] = {cell.groundFrame, cell.objectFrame};
            for (int part = 0; part < 2; ++part) {
                if (sprites[part] <= 0) {
                    continue;
                }
                const std::uint64_t key = frameKey(sprites[part], frames[part]);
                bool seen = false;
                for (const Placed& item : placed) {
                    if (item.key == key) {
                        seen = true;
                        break;
                    }
                }
                if (seen) {
                    continue;
                }
                const int sheetIndex = sprites[part] - indexBase;
                if (sheetIndex < 0 || sheetIndex >= static_cast<int>(tiles.sheets.size())) {
                    continue;
                }
                const SpriteSheet& sheet = tiles.sheets[static_cast<std::size_t>(sheetIndex)];
                if (frames[part] < 0 || frames[part] >= static_cast<int>(sheet.frames.size())) {
                    continue;
                }
                const SpriteFrame& frame = sheet.frames[static_cast<std::size_t>(frames[part])];
                if (frame.width <= 0 || frame.height <= 0 || frame.left < 0 || frame.top < 0 ||
                    frame.left + frame.width > sheet.width || frame.top + frame.height > sheet.height) {
                    continue;
                }
                int dx = 0;
                int dy = 0;
                if (!shelf.place(frame.width, frame.height, dx, dy)) {
                    error = "tile atlas ran out of room";
                    return false;
                }
                blit(shelf.rgba, shelf.width, dx, dy, sheet.rgba.data(), sheet.width, frame.left, frame.top, frame.width, frame.height);
                placed.push_back(Placed{key, dx, dy, frame.width, frame.height, frame.pivotX, frame.pivotY});
            }
        }
    }
    out.atlasW = shelf.width;
    out.atlasH = shelf.height;
    out.atlas = std::move(shelf.rgba);
    for (const Placed& item : placed) {
        cl::core::FrameView view;
        view.texture = 1;
        view.pixelW = item.w;
        view.pixelH = item.h;
        view.pivotX = item.pivotX;
        view.pivotY = item.pivotY;
        view.sourceScale = sourceScale;
        view.u0 = static_cast<float>(item.dx) / static_cast<float>(out.atlasW);
        view.v0 = static_cast<float>(item.dy) / static_cast<float>(out.atlasH);
        view.u1 = static_cast<float>(item.dx + item.w) / static_cast<float>(out.atlasW);
        view.v1 = static_cast<float>(item.dy + item.h) / static_cast<float>(out.atlasH);
        out.frames.emplace(item.key, view);
    }
    return true;
}

void fillCell(std::vector<std::uint8_t>& image, int imageW, int x, int y, int w, int h, std::uint8_t r, std::uint8_t g, std::uint8_t b) {
    for (int row = 0; row < h; ++row) {
        for (int col = 0; col < w; ++col) {
            std::uint8_t* px = image.data() + (static_cast<std::size_t>(y + row) * static_cast<std::size_t>(imageW) + static_cast<std::size_t>(x + col)) * 4u;
            px[0] = r;
            px[1] = g;
            px[2] = b;
            px[3] = 255;
        }
    }
}

void makePlaceholder(SampleLoad& out) {
    out.placeholder = true;
    out.map.name = "placeholder";
    out.map.width = 8;
    out.map.height = 8;
    out.map.tileBytes = 0;
    out.map.cells.resize(64);
    out.atlasW = 64;
    out.atlasH = 32;
    out.atlas.assign(static_cast<std::size_t>(out.atlasW * out.atlasH * 4), 0);
    fillCell(out.atlas, out.atlasW, 0, 0, 32, 32, 70, 110, 70);
    fillCell(out.atlas, out.atlasW, 32, 0, 32, 32, 90, 130, 80);
    for (int y = 0; y < 8; ++y) {
        for (int x = 0; x < 8; ++x) {
            cl::core::TileCell& cell = out.map.cells[static_cast<std::size_t>(y * 8 + x)];
            cell.groundSprite = 1;
            cell.groundFrame = ((x + y) & 1);
            cell.flags = 0;
        }
    }
    cl::core::FrameView a;
    a.texture = 1;
    a.pixelW = 32;
    a.pixelH = 32;
    a.sourceScale = 1;
    a.u0 = 0.f;
    a.u1 = 0.5f;
    a.v0 = 0.f;
    a.v1 = 1.f;
    cl::core::FrameView b = a;
    b.u0 = 0.5f;
    b.u1 = 1.f;
    out.frames.emplace(frameKey(1, 0), a);
    out.frames.emplace(frameKey(1, 1), b);

    SpriteSheet sheet;
    sheet.width = 32 * 4;
    sheet.height = 32;
    sheet.rgba.assign(static_cast<std::size_t>(sheet.width * sheet.height * 4), 0);
    for (int frame = 0; frame < 4; ++frame) {
        const int radius = 8 + frame * 2;
        const int cx = frame * 32 + 16;
        const int cy = 20;
        for (int y = 0; y < 32; ++y) {
            for (int x = 0; x < 32; ++x) {
                const int dx = frame * 32 + x - cx;
                const int dy = y - cy;
                if (dx * dx + dy * dy <= radius * radius) {
                    std::uint8_t* px = sheet.rgba.data() + (static_cast<std::size_t>(y) * static_cast<std::size_t>(sheet.width) + static_cast<std::size_t>(frame * 32 + x)) * 4u;
                    px[0] = 40;
                    px[1] = static_cast<std::uint8_t>(160 + frame * 20);
                    px[2] = 50;
                    px[3] = 255;
                }
            }
        }
        sheet.frames.push_back(SpriteFrame{frame * 32, 0, 32, 32, -16, -20});
    }
    out.monsterSheets.push_back(std::move(sheet));
    out.monsterScale = 1;
    out.monsterName = "placeholder-blob";
    out.notes.push_back("repo map or monster sprite was not found; drawing a placeholder grid and blob");
}

cl::core::TileMap toMap(const MapLoad& loaded) {
    cl::core::TileMap map;
    map.name = loaded.name;
    map.width = loaded.width;
    map.height = loaded.height;
    map.tileBytes = loaded.tileBytes;
    map.cells.resize(loaded.cells.size());
    for (std::size_t i = 0; i < loaded.cells.size(); ++i) {
        map.cells[i].groundSprite = loaded.cells[i].groundSprite;
        map.cells[i].groundFrame = loaded.cells[i].groundFrame;
        map.cells[i].objectSprite = loaded.cells[i].objectSprite;
        map.cells[i].objectFrame = loaded.cells[i].objectFrame;
        map.cells[i].flags = loaded.cells[i].flags;
        map.cells[i].uninterpreted = loaded.cells[i].uninterpreted;
    }
    return map;
}

}  // namespace

bool loadSample(const std::string& repoRoot, SampleLoad& out, std::string& error) {
    out = {};
    const fs::path root(repoRoot);
    const fs::path upscale = root / "experiments" / "upscale-2026-10-04" / "after";
    const fs::path upscaledTiles = upscale / "bsmith-tile418-421-x4.spr";
    const fs::path upscaledMap = upscale / "bsmith_1.amd";
    const fs::path upscaledSlime = upscale / "slm.spr";
    const fs::path originalMap = root / "sp-client" / "public" / "assets" / "maps" / "bsmith_1.amd";
    const fs::path originalTiles = root / "sp-client" / "public" / "assets" / "sprites" / "tile406-421.spr";
    const fs::path originalSlime = root / "sp-client" / "public" / "assets" / "sprites" / "slm.spr";

    fs::path mapPath = originalMap;
    fs::path tilePath = originalTiles;
    fs::path slimePath = originalSlime;
    int tileBase = 406;
    int tileScale = 1;
    int monsterScale = 1;
    if (isFile(upscaledMap) && isFile(upscaledTiles)) {
        mapPath = upscaledMap;
        tilePath = upscaledTiles;
        tileBase = 418;
        tileScale = 4;
        out.usedUpscaleExperiment = true;
        out.notes.push_back("ground tiles from experiments/upscale-2026-10-04/after (PR #126), drawn at 1/4 so the 32px grid holds");
    } else {
        out.notes.push_back("PR #126 upscaled tiles are not on this checkout; using original tile406-421.spr");
    }
    if (isFile(upscaledSlime)) {
        slimePath = upscaledSlime;
        monsterScale = 4;
        out.usedUpscaleExperiment = true;
        out.notes.push_back("slime from experiments/upscale-2026-10-04/after/slm.spr, drawn at 1/4");
    } else {
        out.notes.push_back("PR #126 upscaled slm.spr is not on this checkout; using original slm.spr (4 frames per direction sheet, not 32)");
    }

    if (!isFile(mapPath) || !isFile(tilePath) || !isFile(slimePath)) {
        out.notes.push_back("missing " + mapPath.string());
        out.notes.push_back("missing " + tilePath.string());
        out.notes.push_back("missing " + slimePath.string());
        makePlaceholder(out);
        return true;
    }

    MapLoad loaded;
    if (!loadAmdMap(mapPath.string(), loaded, error)) {
        return false;
    }
    SpriteFile tiles;
    if (!loadSpriteFile(tilePath.string(), tiles, error)) {
        return false;
    }
    SpriteFile slime;
    if (!loadSpriteFile(slimePath.string(), slime, error)) {
        return false;
    }
    out.map = toMap(loaded);
    out.monsterSheets = std::move(slime.sheets);
    out.monsterScale = monsterScale;
    out.monsterName = "slm";
    if (!packGroundStable(tiles, tileBase, tileScale, out.map, out, error)) {
        return false;
    }
    out.notes.push_back("map " + out.map.name + " cells " + std::to_string(out.map.width) + "x" + std::to_string(out.map.height));
    out.notes.push_back("packed ground frames " + std::to_string(out.frames.size()));
    out.notes.push_back("monster sheets " + std::to_string(out.monsterSheets.size()));
    return true;
}

}  // namespace cl::assets
