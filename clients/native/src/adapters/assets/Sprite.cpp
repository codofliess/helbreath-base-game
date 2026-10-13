#include "adapters/assets/Sprite.hpp"

#include "adapters/assets/Binary.hpp"

#include <cstring>
#include <exception>
#include <filesystem>

namespace cl::assets {

bool decodePng(const std::uint8_t* bytes, int length, int& width, int& height, std::vector<std::uint8_t>& rgba, std::string& error);

namespace {

constexpr std::uint8_t kPngMagic[8] = {0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a};

}  // namespace

bool loadSpriteFile(const std::string& path, SpriteFile& out, std::string& error) {
    out = {};
    std::vector<std::uint8_t> bytes = readFile(path, error);
    if (!error.empty()) {
        return false;
    }
    try {
        ByteReader reader(std::move(bytes));
        const int sheetCount = reader.i16();
        if (sheetCount < 0 || sheetCount > 4096) {
            error = "sprite sheet count out of range in " + path;
            return false;
        }
        struct Meta {
            int pngLength = 0;
            std::vector<SpriteFrame> frames;
        };
        std::vector<Meta> metas;
        metas.reserve(static_cast<std::size_t>(sheetCount));
        for (int sheet = 0; sheet < sheetCount; ++sheet) {
            const int frameCount = reader.i16();
            const int pngLength = reader.i32();
            reader.i32();
            reader.i32();
            reader.u8();
            if (frameCount < 0 || frameCount > 8192 || pngLength < 8) {
                error = "bad sprite sheet header in " + path;
                return false;
            }
            Meta meta;
            meta.pngLength = pngLength;
            meta.frames.reserve(static_cast<std::size_t>(frameCount));
            for (int frame = 0; frame < frameCount; ++frame) {
                SpriteFrame item;
                item.left = reader.i16();
                item.top = reader.i16();
                item.width = reader.i16();
                item.height = reader.i16();
                item.pivotX = reader.i16();
                item.pivotY = reader.i16();
                meta.frames.push_back(item);
            }
            metas.push_back(std::move(meta));
        }
        out.sheets.reserve(metas.size());
        for (const Meta& meta : metas) {
            reader.i32();
            const std::vector<std::uint8_t> png = reader.take(static_cast<std::size_t>(meta.pngLength));
            if (png.size() < 8 || std::memcmp(png.data(), kPngMagic, 8) != 0) {
                error = "sprite sheet in " + path + " is not a PNG";
                return false;
            }
            SpriteSheet sheet;
            sheet.frames = meta.frames;
            if (!decodePng(png.data(), static_cast<int>(png.size()), sheet.width, sheet.height, sheet.rgba, error)) {
                return false;
            }
            out.sheets.push_back(std::move(sheet));
        }
    } catch (const std::exception& ex) {
        error = std::string(ex.what()) + " (" + path + ")";
        return false;
    }
    return true;
}

bool loadAmdMap(const std::string& path, MapLoad& out, std::string& error) {
    out = {};
    std::vector<std::uint8_t> bytes = readFile(path, error);
    if (!error.empty()) {
        return false;
    }
    if (bytes.size() < 256) {
        error = "map header is shorter than 256 bytes: " + path;
        return false;
    }
    std::string header(bytes.begin(), bytes.begin() + 256);
    for (char& ch : header) {
        if (ch == '\0') {
            ch = ' ';
        }
    }
    int width = 0;
    int height = 0;
    int tileBytes = 0;
    std::string token;
    std::string previous;
    std::string beforeThat;
    auto apply = [&](const std::string& key, const std::string& value) {
        try {
            const int number = std::stoi(value);
            if (key == "MAPSIZEX") width = number;
            else if (key == "MAPSIZEY") height = number;
            else if (key == "TILESIZE") tileBytes = number;
        } catch (const std::exception&) {
        }
    };
    for (std::size_t i = 0; i <= header.size(); ++i) {
        if (i == header.size() || header[i] == ' ' || header[i] == '\n' || header[i] == '\r' || header[i] == '\t') {
            if (!token.empty()) {
                if (beforeThat == "MAPSIZEX" || beforeThat == "MAPSIZEY" || beforeThat == "TILESIZE") {
                    apply(beforeThat, token);
                }
                beforeThat = previous;
                previous = token;
                token.clear();
            }
        } else {
            token.push_back(header[i]);
        }
    }
    if (width <= 0 || height <= 0 || tileBytes < 9) {
        error = "map header is missing MAPSIZEX, MAPSIZEY, or TILESIZE in " + path;
        return false;
    }
    const std::uint64_t need = 256ull + static_cast<std::uint64_t>(width) * static_cast<std::uint64_t>(height) * static_cast<std::uint64_t>(tileBytes);
    if (bytes.size() < need) {
        error = "map file is shorter than its header claims: " + path;
        return false;
    }
    out.name = std::filesystem::path(path).stem().string();
    out.width = width;
    out.height = height;
    out.tileBytes = tileBytes;
    out.cells.resize(static_cast<std::size_t>(width * height));
    std::size_t offset = 256;
    for (MapLoad::Cell& cell : out.cells) {
        auto read16 = [&]() {
            std::uint16_t value = 0;
            std::memcpy(&value, bytes.data() + offset, 2);
            offset += 2;
            return static_cast<std::int16_t>(value);
        };
        cell.groundSprite = read16();
        cell.groundFrame = read16();
        cell.objectSprite = read16();
        cell.objectFrame = read16();
        cell.flags = bytes[offset];
        if (tileBytes >= 10) {
            cell.uninterpreted = bytes[offset + 1];
        }
        offset += static_cast<std::size_t>(tileBytes - 8);
    }
    return true;
}

}  // namespace cl::assets
