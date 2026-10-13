#pragma once

namespace cl::core {

// Orthographic camera in world pixels, y growing downward.
struct Camera {
    float centerX = 0.f;
    float centerY = 0.f;
    float zoom = 1.f;
    int viewportW = 1;
    int viewportH = 1;

    void pan(float worldDx, float worldDy) {
        centerX += worldDx;
        centerY += worldDy;
    }

    void zoomAt(float factor) {
        zoom *= factor;
        if (zoom < 0.25f) {
            zoom = 0.25f;
        }
        if (zoom > 8.f) {
            zoom = 8.f;
        }
    }

    // Visible world rectangle. top is the smaller y (y grows down).
    void visible(float& left, float& right, float& top, float& bottom) const {
        const float halfW = static_cast<float>(viewportW) / (2.f * zoom);
        const float halfH = static_cast<float>(viewportH) / (2.f * zoom);
        left = centerX - halfW;
        right = centerX + halfW;
        top = centerY - halfH;
        bottom = centerY + halfH;
    }

    void fit(float minX, float minY, float maxX, float maxY, float margin) {
        const float width = (maxX - minX) * margin;
        const float height = (maxY - minY) * margin;
        centerX = (minX + maxX) * 0.5f;
        centerY = (minY + maxY) * 0.5f;
        const float zoomX = width > 0.f ? static_cast<float>(viewportW) / width : 1.f;
        const float zoomY = height > 0.f ? static_cast<float>(viewportH) / height : 1.f;
        zoom = zoomX < zoomY ? zoomX : zoomY;
        if (zoom < 0.25f) {
            zoom = 0.25f;
        }
        if (zoom > 8.f) {
            zoom = 8.f;
        }
    }
};

// Column-major orthographic matrix for a y-down world.
inline void orthoYDown(float left, float right, float top, float bottom, float out[16]) {
    for (int i = 0; i < 16; ++i) {
        out[i] = 0.f;
    }
    out[0] = 2.f / (right - left);
    out[5] = 2.f / (top - bottom);
    out[10] = -1.f;
    out[12] = -(right + left) / (right - left);
    out[13] = -(top + bottom) / (top - bottom);
    out[15] = 1.f;
}

}  // namespace cl::core
