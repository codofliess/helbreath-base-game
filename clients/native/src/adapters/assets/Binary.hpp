#pragma once

#include <cstdint>
#include <cstring>
#include <stdexcept>
#include <string>
#include <vector>

namespace cl::assets {

class ByteReader {
public:
    explicit ByteReader(std::vector<std::uint8_t> bytes) : bytes_(std::move(bytes)) {}

    std::size_t size() const { return bytes_.size(); }
    std::size_t tell() const { return cursor_; }
    const std::uint8_t* data() const { return bytes_.data(); }

    void seek(std::size_t offset) {
        if (offset > bytes_.size()) {
            throw std::runtime_error("sprite or map read past end of file");
        }
        cursor_ = offset;
    }

    void skip(std::size_t count) { seek(cursor_ + count); }

    std::uint8_t u8() {
        require(1);
        return bytes_[cursor_++];
    }

    std::int16_t i16() {
        require(2);
        std::uint16_t value = 0;
        std::memcpy(&value, bytes_.data() + cursor_, 2);
        cursor_ += 2;
        return static_cast<std::int16_t>(value);
    }

    std::int32_t i32() {
        require(4);
        std::uint32_t value = 0;
        std::memcpy(&value, bytes_.data() + cursor_, 4);
        cursor_ += 4;
        return static_cast<std::int32_t>(value);
    }

    std::vector<std::uint8_t> take(std::size_t count) {
        require(count);
        std::vector<std::uint8_t> out(bytes_.begin() + static_cast<std::ptrdiff_t>(cursor_),
                                      bytes_.begin() + static_cast<std::ptrdiff_t>(cursor_ + count));
        cursor_ += count;
        return out;
    }

private:
    void require(std::size_t count) const {
        if (cursor_ + count > bytes_.size()) {
            throw std::runtime_error("sprite or map read past end of file");
        }
    }

    std::vector<std::uint8_t> bytes_;
    std::size_t cursor_ = 0;
};

std::vector<std::uint8_t> readFile(const std::string& path, std::string& error);

}  // namespace cl::assets
