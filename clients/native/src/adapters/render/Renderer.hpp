#pragma once

#include "adapters/render/GlApi.hpp"
#include "core/Camera.hpp"
#include "core/IsoFrame.hpp"

#include <string>
#include <vector>

namespace cl::render {

class Renderer {
public:
    bool init(std::string& error);
    void shutdown();
    void resize(int width, int height);

    unsigned uploadRgba(int width, int height, const std::uint8_t* rgba, bool nearest);
    void uploadFont();

    void draw(const std::vector<cl::core::SpriteQuad>& world,
              const cl::core::Camera& camera,
              unsigned atlas,
              unsigned monster,
              unsigned shadow,
              const std::string& hud);

    bool readRgba(std::vector<std::uint8_t>& rgba, int width, int height);

    int glMajor() const { return major_; }
    int glMinor() const { return minor_; }
    const std::string& glDescription() const { return description_; }
    unsigned whiteTexture() const { return white_; }

private:
    void setOrtho(const cl::core::Camera& camera);
    void flush(unsigned texture);
    void push(const cl::core::SpriteQuad& quad);
    void drawHud(const std::string& hud);

    GlApi gl_{};
    unsigned program_ = 0;
    int viewUniform_ = -1;
    unsigned vao_ = 0;
    unsigned vbo_ = 0;
    unsigned white_ = 0;
    unsigned font_ = 0;
    int viewportW_ = 1;
    int viewportH_ = 1;
    int major_ = 0;
    int minor_ = 0;
    bool glsl330_ = false;
    std::string description_;
    std::vector<float> vertices_;
    unsigned boundTexture_ = 0;
};

}  // namespace cl::render
