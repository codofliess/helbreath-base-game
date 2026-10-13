#pragma once

#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace cl::core {

// A number is stored only when a rules file states it and names the file it came from.
// The client does not invent market, hell, or mint figures.
struct SourcedValue {
    std::string key;
    std::string numerator;
    std::string denominator;
    std::string source;
};

struct EconomyCatalog {
    std::vector<std::string> unavailableSources;
    std::vector<SourcedValue> marketRates;
    std::vector<SourcedValue> hellParameters;

    const SourcedValue* market(std::string_view pair) const;
    const SourcedValue* hell(std::string_view key) const;
};

// Lines:
//   unavailable <path>
//   rate <pair> <numerator> <denominator> <source>
//   hell <key> <value> <source>
// Blank lines and lines starting with # are ignored.
// A rate or hell line missing its source is rejected and recorded in `error`.
bool loadEconomyRules(std::string_view text, EconomyCatalog& out, std::string& error);

class IMarketPort {
public:
    virtual ~IMarketPort() = default;
    virtual const SourcedValue* quote(std::string_view pair) const = 0;
};

class IHellPort {
public:
    virtual ~IHellPort() = default;
    virtual const SourcedValue* parameter(std::string_view key) const = 0;
};

class CatalogMarket final : public IMarketPort {
public:
    explicit CatalogMarket(const EconomyCatalog& catalog) : catalog_(&catalog) {}
    const SourcedValue* quote(std::string_view pair) const override { return catalog_->market(pair); }

private:
    const EconomyCatalog* catalog_;
};

class CatalogHell final : public IHellPort {
public:
    explicit CatalogHell(const EconomyCatalog& catalog) : catalog_(&catalog) {}
    const SourcedValue* parameter(std::string_view key) const override { return catalog_->hell(key); }

private:
    const EconomyCatalog* catalog_;
};

}  // namespace cl::core
