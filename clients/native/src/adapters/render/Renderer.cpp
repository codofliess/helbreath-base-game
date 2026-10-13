#include "adapters/render/Renderer.hpp"

#include "adapters/render/HudFontData.inc"

#include <algorithm>

namespace cl::render {
namespace {

const char* kVs330 = R"GLSL(
#version 330 core
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
layout(location = 2) in vec4 aColor;
uniform mat4 uView;
out vec2 vUv;
out vec4 vColor;
void main() {
    vUv = aUv;
    vColor = aColor;
    gl_Position = uView * vec4(aPos, 0.0, 1.0);
}
)GLSL";

const char* kFs330 = R"GLSL(
#version 330 core
uniform sampler2D uTex;
in vec2 vUv;
in vec4 vColor;
out vec4 fragColor;
void main() {
    fragColor = texture(uTex, vUv) * vColor;
}
)GLSL";

const char* kVs130 = R"GLSL(
#version 130
in vec2 aPos;
in vec2 aUv;
in vec4 aColor;
uniform mat4 uView;
out vec2 vUv;
out vec4 vColor;
void main() {
    vUv = aUv;
    vColor = aColor;
    gl_Position = uView * vec4(aPos, 0.0, 1.0);
}
)GLSL";

const char* kFs130 = R"GLSL(
#version 130
uniform sampler2D uTex;
in vec2 vUv;
in vec4 vColor;
out vec4 fragColor;
void main() {
    fragColor = texture(uTex, vUv) * vColor;
}
)GLSL";

unsigned compile(GlApi& gl, GLenum type, const char* source, std::string& error) {
    const unsigned shader = gl.CreateShader(type);
    gl.ShaderSource(shader, 1, &source, nullptr);
    gl.CompileShader(shader);
    GLint ok = 0;
    gl.GetShaderiv(shader, GL_COMPILE_STATUS, &ok);
    if (!ok) {
        GLint length = 0;
        gl.GetShaderiv(shader, GL_INFO_LOG_LENGTH, &length);
        std::string log(static_cast<std::size_t>(std::max(length, 1)), '\0');
        gl.GetShaderInfoLog(shader, length, nullptr, log.data());
        error = log;
        gl.DeleteShader(shader);
        return 0;
    }
    return shader;
}

}  // namespace

bool Renderer::init(std::string& error) {
    if (!gl_.load(error)) {
        return false;
    }
    const unsigned char* version = gl_.GetString(GL_VERSION);
    const unsigned char* vendor = gl_.GetString(GL_VENDOR);
    const unsigned char* renderer = gl_.GetString(GL_RENDERER);
    description_ = std::string(version != nullptr ? reinterpret_cast<const char*>(version) : "unknown");
    if (vendor != nullptr) {
        description_ += " / ";
        description_ += reinterpret_cast<const char*>(vendor);
    }
    if (renderer != nullptr) {
        description_ += " / ";
        description_ += reinterpret_cast<const char*>(renderer);
    }
    GLint major = 0;
    GLint minor = 0;
    gl_.GetIntegerv(GL_MAJOR_VERSION, &major);
    gl_.GetIntegerv(GL_MINOR_VERSION, &minor);
    major_ = major;
    minor_ = minor;
    if (major_ < 3) {
        error = "OpenGL 3.0 is required, context reports " + description_;
        return false;
    }
    glsl330_ = major_ > 3 || (major_ == 3 && minor_ >= 3);

    const unsigned vs = compile(gl_, GL_VERTEX_SHADER, glsl330_ ? kVs330 : kVs130, error);
    if (vs == 0) {
        error = "vertex shader: " + error;
        return false;
    }
    const unsigned fs = compile(gl_, GL_FRAGMENT_SHADER, glsl330_ ? kFs330 : kFs130, error);
    if (fs == 0) {
        error = "fragment shader: " + error;
        gl_.DeleteShader(vs);
        return false;
    }
    program_ = gl_.CreateProgram();
    gl_.BindAttribLocation(program_, 0, "aPos");
    gl_.BindAttribLocation(program_, 1, "aUv");
    gl_.BindAttribLocation(program_, 2, "aColor");
    gl_.AttachShader(program_, vs);
    gl_.AttachShader(program_, fs);
    gl_.LinkProgram(program_);
    gl_.DeleteShader(vs);
    gl_.DeleteShader(fs);
    GLint linked = 0;
    gl_.GetProgramiv(program_, GL_LINK_STATUS, &linked);
    if (!linked) {
        GLint length = 0;
        gl_.GetProgramiv(program_, GL_INFO_LOG_LENGTH, &length);
        std::string log(static_cast<std::size_t>(std::max(length, 1)), '\0');
        gl_.GetProgramInfoLog(program_, length, nullptr, log.data());
        error = "program link: " + log;
        return false;
    }
    viewUniform_ = gl_.GetUniformLocation(program_, "uView");
    gl_.UseProgram(program_);
    gl_.Uniform1i(gl_.GetUniformLocation(program_, "uTex"), 0);

    gl_.GenVertexArrays(1, &vao_);
    gl_.BindVertexArray(vao_);
    gl_.GenBuffers(1, &vbo_);
    gl_.BindBuffer(GL_ARRAY_BUFFER, vbo_);
    constexpr int stride = 8 * static_cast<int>(sizeof(float));
    gl_.EnableVertexAttribArray(0);
    gl_.VertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, stride, reinterpret_cast<void*>(0));
    gl_.EnableVertexAttribArray(1);
    gl_.VertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, stride, reinterpret_cast<void*>(2 * sizeof(float)));
    gl_.EnableVertexAttribArray(2);
    gl_.VertexAttribPointer(2, 4, GL_FLOAT, GL_FALSE, stride, reinterpret_cast<void*>(4 * sizeof(float)));

    const std::uint8_t white[4] = {255, 255, 255, 255};
    white_ = uploadRgba(1, 1, white, true);
    uploadFont();

    gl_.Enable(GL_BLEND);
    gl_.BlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);
    gl_.PixelStorei(GL_UNPACK_ALIGNMENT, 1);
    gl_.ClearColor(0.07f, 0.08f, 0.11f, 1.f);
    return true;
}

void Renderer::shutdown() {
    if (program_ != 0) {
        gl_.DeleteProgram(program_);
        program_ = 0;
    }
    if (vbo_ != 0) {
        gl_.DeleteBuffers(1, &vbo_);
        vbo_ = 0;
    }
    if (vao_ != 0) {
        gl_.DeleteVertexArrays(1, &vao_);
        vao_ = 0;
    }
}

void Renderer::resize(int width, int height) {
    viewportW_ = width > 0 ? width : 1;
    viewportH_ = height > 0 ? height : 1;
    gl_.Viewport(0, 0, viewportW_, viewportH_);
}

unsigned Renderer::uploadRgba(int width, int height, const std::uint8_t* rgba, bool nearest) {
    unsigned texture = 0;
    gl_.GenTextures(1, &texture);
    gl_.BindTexture(GL_TEXTURE_2D, texture);
    const int filter = nearest ? GL_NEAREST : GL_NEAREST;
    gl_.TexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, filter);
    gl_.TexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, filter);
    gl_.TexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    gl_.TexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    gl_.TexImage2D(GL_TEXTURE_2D, 0, GL_RGBA, width, height, 0, GL_RGBA, GL_UNSIGNED_BYTE, rgba);
    return texture;
}

void Renderer::uploadFont() {
    const int width = 95 * kHudGlyphW;
    const int height = kHudGlyphH;
    std::vector<std::uint8_t> rgba(static_cast<std::size_t>(width * height * 4), 0);
    for (int glyph = 0; glyph < 95; ++glyph) {
        for (int y = 0; y < kHudGlyphH; ++y) {
            const unsigned char row = kHudGlyphs[glyph][y];
            for (int x = 0; x < kHudGlyphW; ++x) {
                const bool on = (row & (1u << (kHudGlyphW - 1 - x))) != 0;
                std::uint8_t* px = rgba.data() + (static_cast<std::size_t>(y * width + glyph * kHudGlyphW + x) * 4u);
                px[0] = 255;
                px[1] = 255;
                px[2] = 255;
                px[3] = on ? 255 : 0;
            }
        }
    }
    font_ = uploadRgba(width, height, rgba.data(), true);
}

void Renderer::setOrtho(const cl::core::Camera& camera) {
    float left = 0.f;
    float right = 0.f;
    float top = 0.f;
    float bottom = 0.f;
    camera.visible(left, right, top, bottom);
    float matrix[16];
    cl::core::orthoYDown(left, right, top, bottom, matrix);
    gl_.UseProgram(program_);
    gl_.UniformMatrix4fv(viewUniform_, 1, GL_FALSE, matrix);
}

void Renderer::flush(unsigned texture) {
    if (vertices_.empty()) {
        boundTexture_ = texture;
        return;
    }
    gl_.ActiveTexture(GL_TEXTURE0);
    gl_.BindTexture(GL_TEXTURE_2D, boundTexture_);
    gl_.BindVertexArray(vao_);
    gl_.BindBuffer(GL_ARRAY_BUFFER, vbo_);
    gl_.BufferData(GL_ARRAY_BUFFER, static_cast<GLsizeiptr>(vertices_.size() * sizeof(float)), vertices_.data(), GL_DYNAMIC_DRAW);
    gl_.DrawArrays(GL_TRIANGLES, 0, static_cast<GLsizei>(vertices_.size() / 8));
    vertices_.clear();
    boundTexture_ = texture;
}

void Renderer::push(const cl::core::SpriteQuad& quad) {
    const float x0 = quad.x;
    const float y0 = quad.y;
    const float x1 = quad.x + quad.w;
    const float y1 = quad.y + quad.h;
    const float corners[6][2] = {{x0, y0}, {x1, y0}, {x1, y1}, {x0, y0}, {x1, y1}, {x0, y1}};
    const float uvs[6][2] = {{quad.u0, quad.v0}, {quad.u1, quad.v0}, {quad.u1, quad.v1},
                             {quad.u0, quad.v0}, {quad.u1, quad.v1}, {quad.u0, quad.v1}};
    for (int i = 0; i < 6; ++i) {
        vertices_.push_back(corners[i][0]);
        vertices_.push_back(corners[i][1]);
        vertices_.push_back(uvs[i][0]);
        vertices_.push_back(uvs[i][1]);
        vertices_.push_back(quad.r);
        vertices_.push_back(quad.g);
        vertices_.push_back(quad.b);
        vertices_.push_back(quad.a);
    }
}

void Renderer::draw(const std::vector<cl::core::SpriteQuad>& world,
                    const cl::core::Camera& camera,
                    unsigned atlas,
                    unsigned monster,
                    unsigned shadow,
                    const std::string& hud) {
    gl_.Viewport(0, 0, viewportW_, viewportH_);
    gl_.Clear(GL_COLOR_BUFFER_BIT);
    setOrtho(camera);
    vertices_.clear();
    boundTexture_ = 0;
    auto resolve = [&](unsigned texture) {
        if (texture == 1) return atlas;
        if (texture == 3) return monster;
        if (texture == 4) return shadow;
        return white_;
    };
    for (const cl::core::SpriteQuad& quad : world) {
        const unsigned texture = resolve(quad.texture);
        if (!vertices_.empty() && texture != boundTexture_) {
            flush(texture);
        }
        boundTexture_ = texture;
        push(quad);
    }
    flush(0);
    drawHud(hud);
}

void Renderer::drawHud(const std::string& hud) {
    cl::core::Camera screen;
    screen.viewportW = viewportW_;
    screen.viewportH = viewportH_;
    screen.zoom = 1.f;
    screen.centerX = static_cast<float>(viewportW_) * 0.5f;
    screen.centerY = static_cast<float>(viewportH_) * 0.5f;
    setOrtho(screen);

    const float scale = 2.f;
    const float textW = static_cast<float>(hud.size()) * kHudGlyphW * scale;
    cl::core::SpriteQuad bar;
    bar.x = 8.f;
    bar.y = 8.f;
    bar.w = textW + 16.f;
    bar.h = kHudGlyphH * scale + 12.f;
    bar.r = 0.02f;
    bar.g = 0.02f;
    bar.b = 0.03f;
    bar.a = 0.72f;
    bar.texture = 0;
    vertices_.clear();
    boundTexture_ = white_;
    push(bar);
    flush(font_);

    float x = 16.f;
    const float y = 14.f;
    const float atlasW = static_cast<float>(95 * kHudGlyphW);
    for (unsigned char ch : hud) {
        int index = static_cast<int>(ch) - kHudGlyphFirst;
        if (index < 0 || index >= 95) {
            x += kHudGlyphW * scale;
            continue;
        }
        cl::core::SpriteQuad glyph;
        glyph.x = x;
        glyph.y = y;
        glyph.w = kHudGlyphW * scale;
        glyph.h = kHudGlyphH * scale;
        glyph.u0 = static_cast<float>(index * kHudGlyphW) / atlasW;
        glyph.u1 = static_cast<float>((index + 1) * kHudGlyphW) / atlasW;
        glyph.v0 = 0.f;
        glyph.v1 = 1.f;
        glyph.texture = 0;
        boundTexture_ = font_;
        push(glyph);
        x += glyph.w;
    }
    flush(0);
}

bool Renderer::readRgba(std::vector<std::uint8_t>& rgba, int width, int height) {
    rgba.assign(static_cast<std::size_t>(width * height * 4), 0);
    std::vector<std::uint8_t> flipped(rgba.size());
    gl_.PixelStorei(GL_PACK_ALIGNMENT, 1);
    gl_.ReadPixels(0, 0, width, height, GL_RGBA, GL_UNSIGNED_BYTE, flipped.data());
    for (int y = 0; y < height; ++y) {
        const std::uint8_t* from = flipped.data() + static_cast<std::size_t>(height - 1 - y) * static_cast<std::size_t>(width) * 4u;
        std::uint8_t* to = rgba.data() + static_cast<std::size_t>(y) * static_cast<std::size_t>(width) * 4u;
        std::copy(from, from + static_cast<std::size_t>(width) * 4u, to);
    }
    return true;
}

}  // namespace cl::render
