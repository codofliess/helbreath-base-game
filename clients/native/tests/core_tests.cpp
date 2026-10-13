#include "adapters/assets/SampleAssets.hpp"
#include "adapters/assets/Sprite.hpp"
#include "adapters/net/ProtobufSession.hpp"
#include "core/IsoFrame.hpp"
#include "core/economy/Rules.hpp"
#include "core/nft/NftDropPort.hpp"

#include "network.pb.h"

#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <sstream>
#include <unordered_map>

namespace {

int gFailures = 0;

void expect(bool condition, const char* message) {
    if (!condition) {
        std::cerr << "FAIL " << message << "\n";
        ++gFailures;
    }
}

std::string readFile(const std::filesystem::path& path) {
    std::ifstream file(path);
    std::ostringstream buffer;
    buffer << file.rdbuf();
    return buffer.str();
}

class MapFrames final : public cl::core::FrameLookup {
public:
    explicit MapFrames(std::unordered_map<std::uint64_t, cl::core::FrameView> frames) : frames_(std::move(frames)) {}

    const cl::core::FrameView* find(int sprite, int frame) const override {
        const auto it = frames_.find((static_cast<std::uint64_t>(static_cast<std::uint32_t>(sprite)) << 32) |
                                      static_cast<std::uint32_t>(frame));
        if (it == frames_.end()) {
            return nullptr;
        }
        return &it->second;
    }

private:
    std::unordered_map<std::uint64_t, cl::core::FrameView> frames_;
};

cl::core::FrameView cellFrame(int scale) {
    cl::core::FrameView frame;
    frame.texture = 1;
    frame.pixelW = 32 * scale;
    frame.pixelH = 32 * scale;
    frame.sourceScale = scale;
    return frame;
}

void testEconomy() {
    const std::filesystem::path rules =
#ifdef CHAINLORDS_RULES_FILE
        CHAINLORDS_RULES_FILE;
#else
        "economy/unavailable.rules";
#endif
    cl::core::EconomyCatalog catalog;
    std::string error;
    expect(cl::core::loadEconomyRules(readFile(rules), catalog, error), "rules file parses");
    expect(error.empty(), "rules file has no error");
    expect(catalog.marketRates.empty(), "no market rate was invented");
    expect(catalog.hellParameters.empty(), "no hell parameter was invented");
    expect(catalog.unavailableSources.size() >= 4, "missing economy sources are listed");
    cl::core::CatalogMarket market(catalog);
    cl::core::CatalogHell hell(catalog);
    expect(market.quote("anything") == nullptr, "market quote is empty");
    expect(hell.parameter("anything") == nullptr, "hell parameter is empty");

    std::string bad;
    cl::core::EconomyCatalog rejected;
    expect(!cl::core::loadEconomyRules("rate gold 1 2\n", rejected, bad), "a rate without a source is rejected");
}

void testNft() {
    cl::core::NftDropPort port;
    std::string error;
    cl::core::ServerMintDecision missing;
    missing.itemUid = 5;
    expect(!port.ingestServerNotice(missing, error), "notice without a claim id is refused");
    expect(port.empty(), "refused notice is not shown");

    cl::core::ServerMintDecision notice;
    notice.itemUid = 9;
    notice.itemId = 3;
    notice.claimId = "server-claim-1";
    notice.assetId = "cnft-from-middleware";
    notice.tileX = 4;
    notice.tileY = 5;
    expect(port.ingestServerNotice(notice, error), "server notice is accepted");
    expect(port.visible().size() == 1, "one badge");
    expect(port.visible()[0].assetId == "cnft-from-middleware", "asset id is the one the server sent");
    expect(!port.requestClaim("local-mint", error), "unknown claim is not forwarded");
    expect(port.requestClaim("server-claim-1", error), "known claim is forwarded");
    expect(port.outboundClaims().size() == 1, "one outbound claim");
    expect(port.outboundClaims()[0].claimId == "server-claim-1", "outbound claim keeps the server id");
}

void testGroundItemIsNotNft() {
    mmorpg::network::ServerMessage message;
    auto* entered = message.mutable_ground_states_entered_range();
    auto* cell = entered->add_states();
    cell->mutable_loc()->set_x(41);
    cell->mutable_loc()->set_y(31);
    cell->mutable_ground_item()->set_item_id(7);
    cell->mutable_ground_item()->set_item_uid(99);
    std::string bytes;
    expect(message.SerializeToString(&bytes), "ground item frame serializes");

    cl::net::ProtobufSession session;
    std::string error;
    const auto decoded = session.decodeServerFrame(
        std::span<const std::uint8_t>(reinterpret_cast<const std::uint8_t*>(bytes.data()), bytes.size()), error);
    expect(decoded.has_value(), "ground item frame parses");
    expect(decoded && decoded->groundItemCount == 1, "the ground item was seen");

    cl::core::NftDropPort port;
    if (decoded) {
        cl::net::applyGameplayFrame(*decoded, port);
    }
    expect(port.empty(), "a ground item does not become an NFT notice");
}

void testIsoGrid() {
    cl::core::TileMap map;
    map.width = 2;
    map.height = 2;
    map.cells.resize(4);
    for (int i = 0; i < 4; ++i) {
        map.cells[static_cast<std::size_t>(i)].groundSprite = 1;
        map.cells[static_cast<std::size_t>(i)].groundFrame = 0;
    }
    std::unordered_map<std::uint64_t, cl::core::FrameView> frames;
    frames.emplace(1ull << 32, cellFrame(1));
    MapFrames lookup(std::move(frames));
    std::vector<cl::core::SpriteQuad> quads;
    cl::core::appendIsoFrame(quads, map, lookup, cl::core::Projection::AuthoredGrid, nullptr, nullptr);
    expect(quads.size() == 4, "four ground quads");
    expect(quads.size() == 4 && quads[0].x == 0.f && quads[0].y == 0.f, "origin cell");
    expect(quads.size() == 4 && quads[1].x == 32.f && quads[1].y == 0.f, "cell to the right");
    expect(quads.size() == 4 && quads[2].x == 0.f && quads[2].y == 32.f, "cell below");
}

void testDiamondAndScale() {
    cl::core::TileMap map;
    map.width = 2;
    map.height = 1;
    map.cells.resize(2);
    map.cells[0].groundSprite = 1;
    map.cells[1].groundSprite = 1;
    std::unordered_map<std::uint64_t, cl::core::FrameView> frames;
    frames.emplace(1ull << 32, cellFrame(4));
    MapFrames lookup(frames);
    std::vector<cl::core::SpriteQuad> quads;
    cl::core::appendIsoFrame(quads, map, lookup, cl::core::Projection::Diamond, nullptr, nullptr);
    expect(quads.size() == 2, "two diamond cells");
    expect(quads.size() == 2 && quads[0].w == 32.f && quads[0].h == 32.f, "x4 frame draws at the 32px cell");
    expect(quads.size() == 2 && quads[1].x > quads[0].x && quads[1].y > quads[0].y, "diamond steps down-right");

    cl::core::MonsterSprite monster;
    monster.visible = true;
    monster.anchorX = 100.f;
    monster.anchorY = 80.f;
    monster.frame = cellFrame(1);
    monster.frame.pixelW = 40;
    monster.frame.pixelH = 25;
    monster.frame.pivotX = -20;
    monster.frame.pivotY = -13;
    quads.clear();
    cl::core::TileMap empty;
    empty.width = 1;
    empty.height = 1;
    empty.cells.resize(1);
    cl::core::appendIsoFrame(quads, empty, lookup, cl::core::Projection::AuthoredGrid, &monster, nullptr);
    bool found = false;
    for (const cl::core::SpriteQuad& quad : quads) {
        if (quad.layer == 2) {
            found = quad.x == 80.f && quad.y == 67.f && quad.w == 40.f;
        }
    }
    expect(found, "monster pivot places the bitmap on the anchor");
}

void testRealAssets() {
    const std::filesystem::path root =
#ifdef CHAINLORDS_REPO_ROOT
        CHAINLORDS_REPO_ROOT;
#else
        std::filesystem::current_path();
#endif
    const auto mapPath = root / "sp-client" / "public" / "assets" / "maps" / "bsmith_1.amd";
    const auto slimePath = root / "sp-client" / "public" / "assets" / "sprites" / "slm.spr";
    if (!std::filesystem::exists(mapPath) || !std::filesystem::exists(slimePath)) {
        std::cout << "skip real asset parse, files not next to the test\n";
        return;
    }
    cl::assets::MapLoad map;
    std::string error;
    expect(cl::assets::loadAmdMap(mapPath.string(), map, error), "bsmith_1.amd parses");
    expect(map.width == 100 && map.height == 100 && map.tileBytes == 10, "bsmith header");
    cl::assets::SpriteFile slime;
    expect(cl::assets::loadSpriteFile(slimePath.string(), slime, error), "slm.spr parses");
    expect(slime.sheets.size() == 40, "slime has 40 sheets");
    expect(!slime.sheets.empty() && slime.sheets[0].frames.size() == 4, "slime idle sheet has 4 frames");
}

}  // namespace

int main() {
    testEconomy();
    testNft();
    testGroundItemIsNotNft();
    testIsoGrid();
    testDiamondAndScale();
    testRealAssets();
    if (gFailures != 0) {
        std::cerr << gFailures << " failed\n";
        return 1;
    }
    std::cout << "core tests passed\n";
    return 0;
}
