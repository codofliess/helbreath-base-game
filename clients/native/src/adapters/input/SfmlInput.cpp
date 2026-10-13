#include "adapters/input/SfmlInput.hpp"

namespace cl::input {

cl::ports::InputFrame SfmlInput::poll() {
    wheel_ = 0.f;
    screenshot_ = false;
    while (const std::optional event = window_->pollEvent()) {
        if (event->is<sf::Event::Closed>()) {
            quit_ = true;
        } else if (const auto* key = event->getIf<sf::Event::KeyPressed>()) {
            if (key->code == sf::Keyboard::Key::Escape) {
                quit_ = true;
            }
            if (key->code == sf::Keyboard::Key::F12) {
                screenshot_ = true;
            }
        } else if (const auto* wheel = event->getIf<sf::Event::MouseWheelScrolled>()) {
            wheel_ += wheel->delta;
        }
    }

    auto down = [](sf::Keyboard::Key key) { return sf::Keyboard::isKeyPressed(key); };
    cl::ports::InputFrame frame;
    frame.panLeft = down(sf::Keyboard::Key::Left) || down(sf::Keyboard::Key::A);
    frame.panRight = down(sf::Keyboard::Key::Right) || down(sf::Keyboard::Key::D);
    frame.panUp = down(sf::Keyboard::Key::Up) || down(sf::Keyboard::Key::W);
    frame.panDown = down(sf::Keyboard::Key::Down) || down(sf::Keyboard::Key::S);
    frame.zoomIn = down(sf::Keyboard::Key::E) || down(sf::Keyboard::Key::Equal);
    frame.zoomOut = down(sf::Keyboard::Key::Q) || down(sf::Keyboard::Key::Hyphen);
    frame.quit = quit_;
    frame.screenshot = screenshot_;
    frame.wheel = wheel_;
    return frame;
}

}  // namespace cl::input
