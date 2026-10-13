#include "core/TileMap.hpp"

namespace cl::core {

bool TileMap::contentBounds(int& x0, int& y0, int& x1, int& y1) const {
    bool any = false;
    for (int y = 0; y < height; ++y) {
        for (int x = 0; x < width; ++x) {
            const TileCell& cell = cells[static_cast<std::size_t>(y * width + x)];
            if (cell.groundSprite <= 0 && cell.objectSprite <= 0) {
                continue;
            }
            if (!any) {
                x0 = x1 = x;
                y0 = y1 = y;
                any = true;
            } else {
                if (x < x0) x0 = x;
                if (y < y0) y0 = y;
                if (x > x1) x1 = x;
                if (y > y1) y1 = y;
            }
        }
    }
    return any;
}

}  // namespace cl::core
