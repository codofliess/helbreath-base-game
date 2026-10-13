#include "adapters/assets/SampleAssets.hpp"
#include "adapters/assets/Sprite.hpp"
#include "adapters/input/SfmlInput.hpp"
#include "adapters/net/ProtobufSession.hpp"
#include "adapters/render/Renderer.hpp"
#include "core/Camera.hpp"
#include "core/IsoFrame.hpp"
#include "core/Projection.hpp"
#include "core/SpriteAnim.hpp"
#include "core/economy/Rules.hpp"
#include "core/nft/NftDropPort.hpp"
#include "ports/Ports.hpp"

#include <SFML/System/Clock.hpp>
#include <SFML/Window/ContextSettings.hpp>
#include <SFML/Window/VideoMode.hpp>
#include <SFML/Window/Window.hpp>
#include <SFML/Window/WindowEnums.hpp>

#include <algorithm>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <unordered_map>

namespace cl::app {
namespace {

namespace fs = std::filesystem;

struct Options {
    int width = 1280;
    int height = 720;
    std::string screenshot;
    std::string repo;
    std::string rules;
    cl::core::Projection projection = cl::core::Projection::AuthoredGrid;
    float time = 0.35f;
    bool interactive = true;
};

void printHelp() {
    std::cout
        << "chainlords-native\n"
        << "  --screenshot <png>   draw one frame and exit\n"
        << "  --width <px>         window width (default 1280)\n"
        << "  --height <px>        window height (default 720)\n"
        << "  --repo <path>        repo root that contains sp-client/public/assets\n"
        << "  --rules <path>       economy rules file (default: clients/native/economy/unavailable.rules)\n"
        << "  --projection grid|diamond\n"
        << "  --time <seconds>     monster animation time for the still frame\n"
        << "Keys: WASD or arrows pan, Q/E or wheel zoom, F12 screenshot, Esc quit\n";
}

bool parseArgs(int argc, char** argv, Options& options) {
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        auto need = [&](std::string& out) {
            if (i + 1 >= argc) {
                std::cerr << "missing value for " << arg << "\n";
                return false;
            }
            out = argv[++i];
            return true;
        };
        if (arg == "--help" || arg == "-h") {
            printHelp();
            return false;
        }
        if (arg == "--screenshot") {
            if (!need(options.screenshot)) return false;
            options.interactive = false;
        } else if (arg == "--width") {
            std::string value;
            if (!need(value)) return false;
            options.width = std::stoi(value);
        } else if (arg == "--height") {
            std::string value;
            if (!need(value)) return false;
            options.height = std::stoi(value);
        } else if (arg == "--repo") {
            if (!need(options.repo)) return false;
        } else if (arg == "--rules") {
            if (!need(options.rules)) return false;
        } else if (arg == "--time") {
            std::string value;
            if (!need(value)) return false;
            options.time = std::stof(value);
        } else if (arg == "--projection") {
            std::string value;
            if (!need(value)) return false;
            if (value == "diamond") {
                options.projection = cl::core::Projection::Diamond;
            } else if (value == "grid") {
                options.projection = cl::core::Projection::AuthoredGrid;
            } else {
                std::cerr << "projection must be grid or diamond\n";
                return false;
            }
        } else {
            std::cerr << "unknown argument " << arg << "\n";
            printHelp();
            return false;
        }
    }
    return true;
}

std::string findRepo(const std::string& given) {
    if (!given.empty()) {
        return given;
    }
    if (const char* env = std::getenv("CHAINLORDS_REPO")) {
        return env;
    }
#ifdef CHAINLORDS_REPO_ROOT
    const fs::path compiled(CHAINLORDS_REPO_ROOT);
    if (fs::exists(compiled / "sp-client" / "public" / "assets" / "maps" / "bsmith_1.amd")) {
        return compiled.string();
    }
#endif
    fs::path cursor = fs::current_path();
    for (int i = 0; i < 8; ++i) {
        if (fs::exists(cursor / "sp-client" / "public" / "assets" / "maps" / "bsmith_1.amd")) {
            return cursor.string();
        }
        if (!cursor.has_parent_path() || cursor == cursor.parent_path()) {
            break;
        }
        cursor = cursor.parent_path();
    }
    return fs::current_path().string();
}

class Catalog final : public cl::core::FrameLookup {
public:
    explicit Catalog(const std::unordered_map<std::uint64_t, cl::core::FrameView>& frames) : frames_(&frames) {}

    const cl::core::FrameView* find(int sprite, int frame) const override {
        const auto it = frames_->find(cl::assets::frameKey(sprite, frame));
        if (it == frames_->end()) {
            return nullptr;
        }
        return &it->second;
    }

private:
    const std::unordered_map<std::uint64_t, cl::core::FrameView>* frames_;
};

bool pickAnchor(const cl::core::TileMap& map, int& tileX, int& tileY) {
    int x0 = 0;
    int y0 = 0;
    int x1 = 0;
    int y1 = 0;
    if (!map.contentBounds(x0, y0, x1, y1)) {
        return false;
    }
    const int cx = (x0 + x1) / 2;
    const int cy = (y0 + y1) / 2;
    int best = 1 << 30;
    bool found = false;
    for (int y = y0; y <= y1; ++y) {
        for (int x = x0; x <= x1; ++x) {
            const cl::core::TileCell* cell = map.at(x, y);
            if (cell == nullptr || cell->groundSprite <= 0 || cell->blocksMovement()) {
                continue;
            }
            const int score = std::abs(x - cx) + std::abs(y - cy);
            if (score < best) {
                best = score;
                tileX = x;
                tileY = y;
                found = true;
            }
        }
    }
    return found;
}

void includeCell(cl::core::Projection projection, int tileX, int tileY, float& minX, float& minY, float& maxX, float& maxY, bool& any) {
    const cl::core::Vec2 origin = cl::core::projectTile(projection, tileX, tileY);
    const float xs[2] = {origin.x, origin.x + cl::core::kCellPixels};
    const float ys[2] = {origin.y, origin.y + cl::core::kCellPixels};
    for (float x : xs) {
        for (float y : ys) {
            if (!any) {
                minX = maxX = x;
                minY = maxY = y;
                any = true;
            } else {
                minX = std::min(minX, x);
                minY = std::min(minY, y);
                maxX = std::max(maxX, x);
                maxY = std::max(maxY, y);
            }
        }
    }
}

std::vector<std::uint8_t> makeShadow() {
    constexpr int w = 48;
    constexpr int h = 16;
    std::vector<std::uint8_t> rgba(static_cast<std::size_t>(w * h * 4), 0);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            const float nx = (static_cast<float>(x) + 0.5f) / static_cast<float>(w) * 2.f - 1.f;
            const float ny = (static_cast<float>(y) + 0.5f) / static_cast<float>(h) * 2.f - 1.f;
            const float d = nx * nx + ny * ny;
            if (d <= 1.f) {
                std::uint8_t* px = rgba.data() + (static_cast<std::size_t>(y * w + x) * 4u);
                px[0] = 0;
                px[1] = 0;
                px[2] = 0;
                px[3] = static_cast<std::uint8_t>((1.f - d) * 140.f);
            }
        }
    }
    return rgba;
}

std::string readText(const fs::path& path) {
    std::ifstream file(path);
    if (!file) {
        return {};
    }
    std::ostringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

bool interestingFrame(const std::vector<std::uint8_t>& rgba) {
    int count = 0;
    for (std::size_t i = 0; i + 3 < rgba.size(); i += 4) {
        if (rgba[i] > 40 || rgba[i + 1] > 45 || rgba[i + 2] > 50) {
            ++count;
        }
    }
    return count > 1000;
}

}  // namespace

int run(int argc, char** argv) {
    Options options;
    if (!parseArgs(argc, argv, options)) {
        return argc > 1 && std::string(argv[1]) == "--help" ? 0 : 1;
    }
    if (options.width < 320 || options.height < 240) {
        std::cerr << "window is too small\n";
        return 1;
    }

    const std::string repo = findRepo(options.repo);
    cl::assets::SampleLoad sample;
    std::string error;
    if (!cl::assets::loadSample(repo, sample, error)) {
        std::cerr << error << "\n";
        return 1;
    }
    for (const std::string& note : sample.notes) {
        std::cout << note << "\n";
    }

    fs::path rulesPath = options.rules;
    if (rulesPath.empty()) {
        rulesPath = fs::path(repo) / "clients" / "native" / "economy" / "unavailable.rules";
    }
    cl::core::EconomyCatalog economy;
    const std::string rulesText = readText(rulesPath);
    if (rulesText.empty()) {
        std::cout << "economy rules file not read: " << rulesPath << "\n";
    } else if (!cl::core::loadEconomyRules(rulesText, economy, error)) {
        std::cerr << error << "\n";
        return 1;
    } else {
        std::cout << "economy rates " << economy.marketRates.size() << ", hell parameters " << economy.hellParameters.size()
                  << ", unavailable sources " << economy.unavailableSources.size() << "\n";
    }
    cl::core::CatalogMarket market(economy);
    cl::core::CatalogHell hell(economy);
    (void)market;
    (void)hell;

    cl::core::NftDropPort nft;
    cl::net::ProtobufSession session;
    std::string connectError;
    session.connect("ws://127.0.0.1:" + std::to_string(cl::net::kDocumentedDefaultServerPort) + "/ws", connectError);
    std::cout << connectError << "\n";

    int anchorX = 0;
    int anchorY = 0;
    if (!pickAnchor(sample.map, anchorX, anchorY)) {
        anchorX = 1;
        anchorY = 1;
    }

    cl::core::SpriteAnim anim;
    anim.time = options.time;
    if (!sample.monsterSheets.empty() && !sample.monsterSheets[0].frames.empty()) {
        anim.framesInSheet = static_cast<int>(sample.monsterSheets[0].frames.size());
    }

    sf::ContextSettings settings;
    settings.depthBits = 24;
    settings.majorVersion = 3;
    settings.minorVersion = 3;
    settings.attributeFlags = sf::ContextSettings::Core;
    sf::Window window(sf::VideoMode(sf::Vector2u{static_cast<unsigned>(options.width), static_cast<unsigned>(options.height)}),
                      "ChainLords",
                      sf::Style::Titlebar | sf::Style::Close,
                      sf::State::Windowed,
                      settings);
    if (!window.setActive(true)) {
        std::cerr << "OpenGL context could not be activated\n";
        return 1;
    }
    const sf::ContextSettings actual = window.getSettings();
    std::cout << "OpenGL context requested 3.3 core, created " << actual.majorVersion << "." << actual.minorVersion << "\n";
    if (actual.majorVersion < 3) {
        std::cerr << "OpenGL 3.0 minimum was not created\n";
        return 1;
    }

    cl::render::Renderer renderer;
    if (!renderer.init(error)) {
        std::cerr << error << "\n";
        return 1;
    }
    std::cout << "gl " << renderer.glDescription() << "\n";
    renderer.resize(options.width, options.height);

    const unsigned atlas = renderer.uploadRgba(sample.atlasW, sample.atlasH, sample.atlas.data(), true);
    const std::vector<std::uint8_t> shadowPixels = makeShadow();
    const unsigned shadow = renderer.uploadRgba(48, 16, shadowPixels.data(), true);
    unsigned monsterTexture = 0;
    int uploadedSheet = -1;

    cl::core::Camera camera;
    camera.viewportW = options.width;
    camera.viewportH = options.height;
    int x0 = 0;
    int y0 = 0;
    int x1 = sample.map.width - 1;
    int y1 = sample.map.height - 1;
    sample.map.contentBounds(x0, y0, x1, y1);
    float minX = 0.f;
    float minY = 0.f;
    float maxX = 0.f;
    float maxY = 0.f;
    bool any = false;
    includeCell(options.projection, x0, y0, minX, minY, maxX, maxY, any);
    includeCell(options.projection, x1, y0, minX, minY, maxX, maxY, any);
    includeCell(options.projection, x0, y1, minX, minY, maxX, maxY, any);
    includeCell(options.projection, x1, y1, minX, minY, maxX, maxY, any);
    camera.fit(minX, minY, maxX, maxY, 1.08f);

    cl::input::SfmlInput input(window);
    cl::ports::NullAudio audio;
    audio.play("silent");
    Catalog catalog(sample.frames);

    auto drawFrame = [&](const std::string& shotPath) {
        const int sheetCount = static_cast<int>(sample.monsterSheets.size());
        int sheetIndex = anim.sheetIndex();
        if (sheetCount <= 0) {
            sheetIndex = 0;
        } else if (sheetIndex >= sheetCount) {
            sheetIndex = sheetIndex % sheetCount;
        }
        const cl::assets::SpriteSheet& sheet = sample.monsterSheets[static_cast<std::size_t>(sheetIndex)];
        if (sheetIndex != uploadedSheet) {
            monsterTexture = renderer.uploadRgba(sheet.width, sheet.height, sheet.rgba.data(), true);
            uploadedSheet = sheetIndex;
            anim.framesInSheet = static_cast<int>(sheet.frames.size());
        }
        const int frameIndex = anim.frameIndex();
        const cl::assets::SpriteFrame& frame = sheet.frames[static_cast<std::size_t>(frameIndex)];
        cl::core::MonsterSprite monster;
        const cl::core::Vec2 origin = cl::core::projectTile(options.projection, anchorX, anchorY);
        monster.anchorX = origin.x + cl::core::kCellPixels * 0.5f;
        monster.anchorY = origin.y + cl::core::kCellPixels * 0.5f;
        monster.visible = true;
        monster.frame.texture = 3;
        monster.frame.pixelW = frame.width;
        monster.frame.pixelH = frame.height;
        monster.frame.pivotX = frame.pivotX;
        monster.frame.pivotY = frame.pivotY;
        monster.frame.sourceScale = sample.monsterScale;
        monster.frame.u0 = static_cast<float>(frame.left) / static_cast<float>(sheet.width);
        monster.frame.v0 = static_cast<float>(frame.top) / static_cast<float>(sheet.height);
        monster.frame.u1 = static_cast<float>(frame.left + frame.width) / static_cast<float>(sheet.width);
        monster.frame.v1 = static_cast<float>(frame.top + frame.height) / static_cast<float>(sheet.height);

        std::vector<cl::core::SpriteQuad> quads;
        const auto& notices = nft.visible();
        cl::core::appendIsoFrame(quads, sample.map, catalog, options.projection, &monster, &notices);
        cl::core::SpriteQuad shadowQuad;
        shadowQuad.texture = 4;
        shadowQuad.x = monster.anchorX - 18.f;
        shadowQuad.y = monster.anchorY - 6.f;
        shadowQuad.w = 36.f;
        shadowQuad.h = 12.f;
        shadowQuad.a = 0.85f;
        for (auto it = quads.begin(); it != quads.end(); ++it) {
            if (it->layer >= 2) {
                quads.insert(it, shadowQuad);
                break;
            }
        }

        std::ostringstream hud;
        hud << "GL " << renderer.glMajor() << "." << renderer.glMinor() << "  " << sample.map.name << "  " << sample.monsterName
            << " f" << frameIndex << "  zoom " << camera.zoom;
        if (sample.placeholder) {
            hud << "  PLACEHOLDER";
        }
        if (options.projection == cl::core::Projection::Diamond) {
            hud << "  diamond";
        }
        renderer.draw(quads, camera, atlas, monsterTexture, shadow, hud.str());
        if (!shotPath.empty()) {
            std::vector<std::uint8_t> pixels;
            renderer.readRgba(pixels, options.width, options.height);
            const fs::path parent = fs::path(shotPath).parent_path();
            if (!parent.empty()) {
                fs::create_directories(parent);
            }
            if (!cl::assets::writePng(shotPath, options.width, options.height, pixels.data())) {
                std::cerr << "failed to write " << shotPath << "\n";
                return false;
            }
            if (!interestingFrame(pixels)) {
                std::cerr << "screenshot is empty\n";
                return false;
            }
            std::cout << "wrote " << shotPath << "\n";
        }
        return true;
    };

    if (!options.interactive) {
        if (!drawFrame(options.screenshot)) {
            return 1;
        }
        window.display();
        renderer.shutdown();
        return 0;
    }

    sf::Clock clock;
    std::string pendingShot;
    while (window.isOpen()) {
        const cl::ports::InputFrame frame = input.poll();
        if (frame.quit) {
            break;
        }
        float dt = clock.restart().asSeconds();
        if (dt > 0.1f) {
            dt = 0.1f;
        }
        anim.advance(dt);
        const float speed = 280.f / camera.zoom;
        if (frame.panLeft) camera.pan(-speed * dt, 0.f);
        if (frame.panRight) camera.pan(speed * dt, 0.f);
        if (frame.panUp) camera.pan(0.f, -speed * dt);
        if (frame.panDown) camera.pan(0.f, speed * dt);
        if (frame.zoomIn) camera.zoomAt(1.f + dt);
        if (frame.zoomOut) camera.zoomAt(1.f - dt * 0.8f);
        if (frame.wheel != 0.f) camera.zoomAt(frame.wheel > 0.f ? 1.1f : 0.9f);
        if (frame.screenshot) {
            pendingShot = "chainlords-native.png";
        }
        const sf::Vector2u size = window.getSize();
        camera.viewportW = static_cast<int>(size.x);
        camera.viewportH = static_cast<int>(size.y);
        renderer.resize(camera.viewportW, camera.viewportH);
        options.width = camera.viewportW;
        options.height = camera.viewportH;
        if (!drawFrame(pendingShot)) {
            return 1;
        }
        pendingShot.clear();
        window.display();
    }
    renderer.shutdown();
    window.close();
    return 0;
}

}  // namespace cl::app
