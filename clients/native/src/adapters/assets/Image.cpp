#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

#define STB_IMAGE_IMPLEMENTATION
#define STBI_ONLY_PNG
#define STBI_NO_STDIO
#define STBI_NO_LINEAR
#define STBI_NO_HDR
#include "stb_image.h"

#define STB_IMAGE_WRITE_IMPLEMENTATION
#define STBI_WRITE_NO_STDIO
#include "stb_image_write.h"

namespace cl::assets {

bool decodePng(const std::uint8_t* bytes, int length, int& width, int& height, std::vector<std::uint8_t>& rgba, std::string& error) {
    int channels = 0;
    stbi_uc* pixels = stbi_load_from_memory(bytes, length, &width, &height, &channels, 4);
    if (pixels == nullptr) {
        error = stbi_failure_reason() != nullptr ? stbi_failure_reason() : "png decode failed";
        return false;
    }
    if (width <= 0 || height <= 0) {
        stbi_image_free(pixels);
        error = "png has an empty image";
        return false;
    }
    const std::size_t count = static_cast<std::size_t>(width) * static_cast<std::size_t>(height) * 4u;
    rgba.assign(pixels, pixels + count);
    stbi_image_free(pixels);
    return true;
}

bool writePng(const std::string& path, int width, int height, const unsigned char* rgba) {
    int length = 0;
    unsigned char* encoded = stbi_write_png_to_mem(rgba, width * 4, width, height, 4, &length);
    if (encoded == nullptr || length <= 0) {
        return false;
    }
    FILE* file = std::fopen(path.c_str(), "wb");
    if (file == nullptr) {
        STBIW_FREE(encoded);
        return false;
    }
    const std::size_t wrote = std::fwrite(encoded, 1, static_cast<std::size_t>(length), file);
    std::fclose(file);
    STBIW_FREE(encoded);
    return wrote == static_cast<std::size_t>(length);
}

}  // namespace cl::assets
