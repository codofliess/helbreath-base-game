#include <exception>
#include <iostream>

namespace cl::app {
int run(int argc, char** argv);
}

int main(int argc, char** argv) {
    try {
        return cl::app::run(argc, argv);
    } catch (const std::exception& ex) {
        std::cerr << ex.what() << "\n";
        return 1;
    }
}
