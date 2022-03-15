#include <eez/core/sound.h>

#include <eez/gui/gui.h>
#include <eez/gui/keypad.h>

#include <SDL.h>

////////////////////////////////////////////////////////////////////////////////

namespace eez {
    namespace gui {
        const EnumItem *g_enumDefinitions[] = { nullptr };

        static class : public AppContext {
        public:
            void stateManagment() override {
                AppContext::stateManagment();
                if (getActivePageId() == PAGE_ID_NONE) {
                    showPage(getMainPageId());
                }
            }

        protected:
            int getMainPageId() override {
                return PAGE_ID_MAIN;
            }
        } g_myAppContext;

        AppContext *getAppContextFromId(int16_t id) { return &g_myAppContext; }
        void executeNumericKeypadOptionHook(int optionActionIndex) { }
        Keypad *getActiveKeypad() { return nullptr; }
        NumericKeypad *getActiveNumericKeypad() { return nullptr; }
        void action_edit() { }
    } // namespace gui
} // namespace eez

////////////////////////////////////////////////////////////////////////////////

namespace eez {
    bool g_shutdown;
    void shutdown() { g_shutdown = true; }

    namespace keyboard {
        void onKeyboardEvent(SDL_KeyboardEvent *key) { }
    } // keyboard

    namespace sound {
        void playBeep(bool force) {}
        void playClick() {}
    } // namespace sound
} // namespace eez

////////////////////////////////////////////////////////////////////////////////

#ifdef _WIN32
#undef INPUT
#undef OUTPUT
#include <Shlobj.h>
#include <Windows.h>
#include <direct.h>
#else
#include <string.h>
#include <pwd.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>
#endif

namespace eez {
    char *getConfFilePath(const char *file_name) {
        static char file_path[1024];

        *file_path = 0;

    #ifdef _WIN32
        if (SUCCEEDED(SHGetFolderPathA(NULL, CSIDL_PROFILE, NULL, 0, file_path))) {
            stringAppendString(file_path, sizeof(file_path), "\\.min_eez_sample");
            _mkdir(file_path);
            stringAppendString(file_path, sizeof(file_path), "\\");
        }
    #elif defined(__EMSCRIPTEN__)
        stringAppendString(file_path, sizeof(file_path), "/min_eez_sample/");
    #else
        const char *home_dir = 0;
        if ((home_dir = getenv("HOME")) == NULL) {
            home_dir = getpwuid(getuid())->pw_dir;
        }
        if (home_dir) {
            stringAppendString(file_path, sizeof(file_path), home_dir);
            stringAppendString(file_path, sizeof(file_path), "/.min_eez_sample");
            mkdir(file_path, S_IRWXU | S_IRWXG | S_IROTH | S_IXOTH);
            stringAppendString(file_path, sizeof(file_path), "/");
        }
    #endif

        char *q = file_path + strlen(file_path);
        const char *p = file_name;
        while (*p) {
            char ch = *p++;
    #ifdef _WIN32
            if (ch == '/')
                *q++ = '\\';
    #else
            if (ch == '\\')
                *q++ = '/';
    #endif
            else
                *q++ = ch;
        }
        *q = 0;

        return file_path;
    }
} // eez
