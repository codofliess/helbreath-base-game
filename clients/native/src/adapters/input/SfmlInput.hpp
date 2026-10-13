#pragma once

#include "ports/Ports.hpp"

#include <SFML/Window/Event.hpp>
#include <SFML/Window/Keyboard.hpp>
#include <SFML/Window/Window.hpp>

namespace cl::input {

class SfmlInput final : public cl::ports::IInput {
public:
    explicit SfmlInput(sf::Window& window) : window_(&window) {}

    cl::ports::InputFrame poll() override;

private:
    sf::Window* window_;
    float wheel_ = 0.f;
    bool quit_ = false;
    bool screenshot_ = false;
};

}  // namespace cl::input
