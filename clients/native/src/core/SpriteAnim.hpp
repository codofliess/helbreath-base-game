#pragma once

namespace cl::core {

// Monster sheet layout documented in sp-client/docs/MONSTER_MECHANICS.md:
// idle 0-7, move 8-15, attack 16-23, hurt 24-31, dead 32-39, one sheet per direction.
// Playback rate 10 fps is the GameAsset default in sp-client/docs/ANIMATIONS_RENDERING.md.
// Frame count comes from the sprite file, not from a fixed constant.
inline constexpr float kDocumentedSpriteFps = 10.f;
inline constexpr int kDirections = 8;

enum class MonsterPose {
    Idle = 0,
    Move = 8,
    Attack = 16,
    Hurt = 24,
    Dead = 32,
};

struct SpriteAnim {
    MonsterPose pose = MonsterPose::Idle;
    int direction = 0;
    int framesInSheet = 1;
    float fps = kDocumentedSpriteFps;
    float time = 0.f;

    int sheetIndex() const {
        int dir = direction % kDirections;
        if (dir < 0) {
            dir += kDirections;
        }
        return static_cast<int>(pose) + dir;
    }

    int frameIndex() const {
        if (framesInSheet <= 0 || fps <= 0.f) {
            return 0;
        }
        const int frame = static_cast<int>(time * fps);
        int wrapped = frame % framesInSheet;
        if (wrapped < 0) {
            wrapped += framesInSheet;
        }
        return wrapped;
    }

    void advance(float dt) { time += dt; }
};

}  // namespace cl::core
