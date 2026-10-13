#include "core/IsoFrame.hpp"

#include <algorithm>

namespace cl::core {
namespace {

SpriteQuad quadFromFrame(float anchorX, float anchorY, const FrameView& frame, int layer) {
    const float scale = frame.sourceScale > 0 ? static_cast<float>(frame.sourceScale) : 1.f;
    SpriteQuad quad;
    quad.w = static_cast<float>(frame.pixelW) / scale;
    quad.h = static_cast<float>(frame.pixelH) / scale;
    quad.x = anchorX + static_cast<float>(frame.pivotX) / scale;
    quad.y = anchorY + static_cast<float>(frame.pivotY) / scale;
    quad.u0 = frame.u0;
    quad.v0 = frame.v0;
    quad.u1 = frame.u1;
    quad.v1 = frame.v1;
    quad.texture = frame.texture;
    quad.layer = layer;
    return quad;
}

}  // namespace

void appendIsoFrame(std::vector<SpriteQuad>& out,
                    const TileMap& map,
                    const FrameLookup& frames,
                    Projection projection,
                    const MonsterSprite* monster,
                    const std::vector<ServerMintDecision>* nftNotices) {
    int x0 = 0;
    int y0 = 0;
    int x1 = map.width - 1;
    int y1 = map.height - 1;
    map.contentBounds(x0, y0, x1, y1);

    for (int y = y0; y <= y1; ++y) {
        for (int x = x0; x <= x1; ++x) {
            const TileCell* cell = map.at(x, y);
            if (cell == nullptr || cell->groundSprite <= 0) {
                continue;
            }
            const FrameView* frame = frames.find(cell->groundSprite, cell->groundFrame);
            if (frame == nullptr) {
                continue;
            }
            const Vec2 origin = projectTile(projection, x, y);
            SpriteQuad quad = quadFromFrame(origin.x, origin.y, *frame, 0);
            // Ground tiles are authored against the cell corner, with a zero pivot.
            if (frame->pivotX == 0 && frame->pivotY == 0) {
                quad.x = origin.x;
                quad.y = origin.y;
            }
            out.push_back(quad);
        }
    }

    struct ObjectDraw {
        int y;
        int x;
        SpriteQuad quad;
    };
    std::vector<ObjectDraw> objects;
    for (int y = y0; y <= y1; ++y) {
        for (int x = x0; x <= x1; ++x) {
            const TileCell* cell = map.at(x, y);
            if (cell == nullptr || cell->objectSprite <= 0) {
                continue;
            }
            const FrameView* frame = frames.find(cell->objectSprite, cell->objectFrame);
            if (frame == nullptr) {
                continue;
            }
            const Vec2 origin = projectTile(projection, x, y);
            const float anchorX = origin.x + kCellPixels * 0.5f;
            const float anchorY = origin.y + kCellPixels * 0.5f;
            objects.push_back(ObjectDraw{y, x, quadFromFrame(anchorX, anchorY, *frame, 1)});
        }
    }
    std::sort(objects.begin(), objects.end(), [](const ObjectDraw& a, const ObjectDraw& b) {
        if (a.y != b.y) {
            return a.y < b.y;
        }
        return a.x < b.x;
    });
    for (const ObjectDraw& object : objects) {
        out.push_back(object.quad);
    }

    if (monster != nullptr && monster->visible && monster->frame.pixelW > 0) {
        out.push_back(quadFromFrame(monster->anchorX, monster->anchorY, monster->frame, 2));
    }

    if (nftNotices != nullptr) {
        for (const ServerMintDecision& notice : *nftNotices) {
            const Vec2 origin = projectTile(projection, notice.tileX, notice.tileY);
            SpriteQuad badge;
            badge.x = origin.x + kCellPixels * 0.5f - 6.f;
            badge.y = origin.y - 10.f;
            badge.w = 12.f;
            badge.h = 12.f;
            badge.r = 0.95f;
            badge.g = 0.78f;
            badge.b = 0.25f;
            badge.a = 1.f;
            badge.texture = 0;
            badge.layer = 3;
            out.push_back(badge);
        }
    }
}

}  // namespace cl::core
