#include "adapters/assets/Binary.hpp"

#include <fstream>

namespace cl::assets {

std::vector<std::uint8_t> readFile(const std::string& path, std::string& error) {
    std::ifstream file(path, std::ios::binary);
    if (!file) {
        error = "cannot open " + path;
        return {};
    }
    file.seekg(0, std::ios::end);
    const std::streamoff length = file.tellg();
    if (length < 0) {
        error = "cannot size " + path;
        return {};
    }
    file.seekg(0, std::ios::beg);
    std::vector<std::uint8_t> bytes(static_cast<std::size_t>(length));
    if (length > 0 && !file.read(reinterpret_cast<char*>(bytes.data()), length)) {
        error = "cannot read " + path;
        return {};
    }
    return bytes;
}

}  // namespace cl::assets
