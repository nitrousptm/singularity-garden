#include <GLFW/glfw3.h>
#include <cstdio>

int main(int argc, char** argv) {
    if (!glfwInit()) {
        fprintf(stderr, "Failed to initialize GLFW\n");
        return 1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 6);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);

    GLFWwindow* window = glfwCreateWindow(1920, 1080, "SINGULARITY GARDEN", nullptr, nullptr);
    if (!window) {
        fprintf(stderr, "Failed to create window\n");
        glfwTerminate();
        return 1;
    }

    glfwMakeContextCurrent(window);
    double startTime = glfwGetTime();

    printf("[SINGULARITY GARDEN] Initializing...\n");

    while (!glfwWindowShouldClose(window)) {
        double t = glfwGetTime() - startTime;
        if (t >= 240.0) break; // 4 minutes

        glfwPollEvents();
        glfwSwapBuffers(window);
    }

    printf("[SINGULARITY GARDEN] Demo finished\n");
    glfwDestroyWindow(window);
    glfwTerminate();

    return 0;
}
