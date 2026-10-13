#include "adapters/render/GlApi.hpp"

#if defined(_WIN32)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <GL/gl.h>
#else
#include <GL/gl.h>
#include <GL/glx.h>
#endif

namespace cl::render {
namespace {

void* loadGl(const char* name) {
#if defined(_WIN32)
    void* symbol = reinterpret_cast<void*>(wglGetProcAddress(name));
    const auto marker = reinterpret_cast<std::intptr_t>(symbol);
    if (symbol == nullptr || marker == 1 || marker == 2 || marker == 3 || marker == -1) {
        static HMODULE module = GetModuleHandleA("opengl32.dll");
        symbol = reinterpret_cast<void*>(GetProcAddress(module, name));
    }
    return symbol;
#else
    return reinterpret_cast<void*>(glXGetProcAddress(reinterpret_cast<const GLubyte*>(name)));
#endif
}

}  // namespace

bool GlApi::load(std::string& error) {
#define CL_LOAD(member, symbol)                                                      \
    member = reinterpret_cast<decltype(member)>(loadGl(symbol));                    \
    if (member == nullptr) {                                                         \
        error += symbol;                                                             \
        error += " ";                                                                \
    }
    CL_LOAD(GenVertexArrays, "glGenVertexArrays")
    CL_LOAD(BindVertexArray, "glBindVertexArray")
    CL_LOAD(DeleteVertexArrays, "glDeleteVertexArrays")
    CL_LOAD(GenBuffers, "glGenBuffers")
    CL_LOAD(BindBuffer, "glBindBuffer")
    CL_LOAD(BufferData, "glBufferData")
    CL_LOAD(DeleteBuffers, "glDeleteBuffers")
    CL_LOAD(EnableVertexAttribArray, "glEnableVertexAttribArray")
    CL_LOAD(VertexAttribPointer, "glVertexAttribPointer")
    CL_LOAD(CreateShader, "glCreateShader")
    CL_LOAD(ShaderSource, "glShaderSource")
    CL_LOAD(CompileShader, "glCompileShader")
    CL_LOAD(GetShaderiv, "glGetShaderiv")
    CL_LOAD(GetShaderInfoLog, "glGetShaderInfoLog")
    CL_LOAD(DeleteShader, "glDeleteShader")
    CL_LOAD(CreateProgram, "glCreateProgram")
    CL_LOAD(AttachShader, "glAttachShader")
    CL_LOAD(BindAttribLocation, "glBindAttribLocation")
    CL_LOAD(LinkProgram, "glLinkProgram")
    CL_LOAD(GetProgramiv, "glGetProgramiv")
    CL_LOAD(GetProgramInfoLog, "glGetProgramInfoLog")
    CL_LOAD(UseProgram, "glUseProgram")
    CL_LOAD(DeleteProgram, "glDeleteProgram")
    CL_LOAD(GetUniformLocation, "glGetUniformLocation")
    CL_LOAD(UniformMatrix4fv, "glUniformMatrix4fv")
    CL_LOAD(Uniform1i, "glUniform1i")
    CL_LOAD(GenTextures, "glGenTextures")
    CL_LOAD(BindTexture, "glBindTexture")
    CL_LOAD(TexParameteri, "glTexParameteri")
    CL_LOAD(TexImage2D, "glTexImage2D")
    CL_LOAD(DeleteTextures, "glDeleteTextures")
    CL_LOAD(ActiveTexture, "glActiveTexture")
    CL_LOAD(DrawArrays, "glDrawArrays")
    CL_LOAD(Enable, "glEnable")
    CL_LOAD(Disable, "glDisable")
    CL_LOAD(BlendFunc, "glBlendFunc")
    CL_LOAD(Viewport, "glViewport")
    CL_LOAD(Clear, "glClear")
    CL_LOAD(ClearColor, "glClearColor")
    CL_LOAD(GetString, "glGetString")
    CL_LOAD(GetIntegerv, "glGetIntegerv")
    CL_LOAD(GetError, "glGetError")
    CL_LOAD(PixelStorei, "glPixelStorei")
    CL_LOAD(ReadPixels, "glReadPixels")
#undef CL_LOAD
    if (!error.empty()) {
        error = "OpenGL entry points missing: " + error;
        return false;
    }
    return true;
}

}  // namespace cl::render
