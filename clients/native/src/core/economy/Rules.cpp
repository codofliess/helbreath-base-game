#include "core/economy/Rules.hpp"

#include <cctype>
#include <sstream>

namespace cl::core {
namespace {

std::string trim(std::string_view text) {
    std::size_t begin = 0;
    while (begin < text.size() && std::isspace(static_cast<unsigned char>(text[begin]))) {
        ++begin;
    }
    std::size_t end = text.size();
    while (end > begin && std::isspace(static_cast<unsigned char>(text[end - 1]))) {
        --end;
    }
    return std::string(text.substr(begin, end - begin));
}

std::vector<std::string> split(const std::string& line) {
    std::istringstream stream(line);
    std::vector<std::string> parts;
    std::string part;
    while (stream >> part) {
        parts.push_back(part);
    }
    return parts;
}

}  // namespace

const SourcedValue* EconomyCatalog::market(std::string_view pair) const {
    for (const SourcedValue& rate : marketRates) {
        if (rate.key == pair) {
            return &rate;
        }
    }
    return nullptr;
}

const SourcedValue* EconomyCatalog::hell(std::string_view key) const {
    for (const SourcedValue& value : hellParameters) {
        if (value.key == key) {
            return &value;
        }
    }
    return nullptr;
}

bool loadEconomyRules(std::string_view text, EconomyCatalog& out, std::string& error) {
    out = {};
    error.clear();
    std::size_t lineNo = 0;
    std::size_t cursor = 0;
    while (cursor <= text.size()) {
        std::size_t next = text.find('\n', cursor);
        if (next == std::string_view::npos) {
            next = text.size();
        }
        ++lineNo;
        const std::string line = trim(text.substr(cursor, next - cursor));
        cursor = next + 1;
        if (line.empty() || line[0] == '#') {
            if (next == text.size()) {
                break;
            }
            continue;
        }
        const std::vector<std::string> parts = split(line);
        if (parts[0] == "unavailable" && parts.size() == 2) {
            out.unavailableSources.push_back(parts[1]);
        } else if (parts[0] == "rate" && parts.size() == 5) {
            SourcedValue rate;
            rate.key = parts[1];
            rate.numerator = parts[2];
            rate.denominator = parts[3];
            rate.source = parts[4];
            out.marketRates.push_back(std::move(rate));
        } else if (parts[0] == "hell" && parts.size() == 4) {
            SourcedValue value;
            value.key = parts[1];
            value.numerator = parts[2];
            value.denominator = "1";
            value.source = parts[3];
            out.hellParameters.push_back(std::move(value));
        } else {
            error = "economy rules line " + std::to_string(lineNo) + " is not a sourced rate, hell parameter, or unavailable path";
            return false;
        }
        if (next == text.size()) {
            break;
        }
    }
    return true;
}

}  // namespace cl::core
