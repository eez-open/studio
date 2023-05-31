# Introduction

Iako se LVGL i EEZ-GUI projekti mogu tijekom razvoja izvršavati i debuggirati koristeći Studio, ono što se u konačnici želi je izvršavati ih na stvarnom fizičkom uređaju - boardu. Za to je potrebno odraditi native integraciju. Za Dashboard projekte ovaj korak nije potreban, oni se izvršavaju isključivo unutar Studija ili se mogu pretvoriti u standalone aplikaciju koja se onda može izvršavati na ovim Desktop OS-ovima: Linux, Windows i macOS.

Za native integraciju potrebno je kompajlirati i polinkati source code koji dolazi iz ovih izvore:

-   Source code koji Studio generira korištenjem Build komande koja se pokreće iz Toolbara
-   EEZ Framework C++ library (https://github.com/eez-open/eez-framework)
-   LVGL C library (potreban je samo za LVGL projekte)
-   Board specific source code

Napomena: EEZ Framework library se sastoji od dva modula: EEZ Flow engine i EEZ-GUI engine. EEZ Flow engine se koristi i za LVGL i EEZ-GUI projekte, a EEZ-GUI engine potreban je samo za EEZ-GUI projekte.

Napomena: Samo za LVGL projekte potreban je i LVGL library. Ovdje nećemo ulaziti u detalje portanja LVGL-a na željeni board, za to molimo posjetite njihovu web stranicu: https://lvgl.io/.

Uz navedeni source code potrebno je i napisati:

-   source code koji inicijalizira i izvršava buildani projekt, za što se koristi EEZ Framework library
-   source code koji obavlja interakciju sa EEZ Flow-om, a to znači napisati:
    -   get and set function for each native varible defined in project
    -   function for each native action defined in project

## Build from Studio

Svi fajlovi koje se kreiraju tijekom buildanja ubacuju se u folderu specificiranom u `Settings - Build / Destination folder`. To je relativni path u odnosu na folder u kojem se nalazi eez-project fajl.

Samo za LVGL projekte postoji i opcija `LVGL include` koje sadrži include path od LVGL librarija.

Studio generira source code fajlove koji su specificirani u `Settings - Build - Files` sekciji. Ovo zovemo file templejti, jer se u njima nalaze direktive koji izgledaju ovako:

`//${eez-studio <directive_name> <configuration>?}`

i na mjesto tih direktive će se tijekom buildanja ubaciti neki sadržaj koji ovisi o tome što se nalazi u projektu. U posebnom poglavlju za LVGL i EEZ-GUI projekte biti će opisano koje direktive postoje.

## Configurations

U file template direktivi, `<configuration>` parametar je opcionalan i da li će se koristiti ovisi o tome da li se koriste konfiguracije koje se uređuju kroz `Settings - Build - Configurations`.

Za sada se koriste samo u EEZ-GUI projektima.

## Compiling and Linking of EEZ Framework Library

Skinite EEZ Framework Library source code sa githubu i sve _.cpp/_.c/\*.h fajlove.

Ako i koristite git onda:

`git submodule add https://github.com/eez-open/eez-framework <path_to>/eez-framework`

## Integration of LVGL projects

Ovo je jedna moguća struktura source coda za LVGL projekt na STM32F469I DISCO development board koji je kreiran koristeći STM32CubeIDE (čitav source code se nalazi ovdje: https://github.com/eez-open/stm32f469i-disco-lvgl-demo). U nastavku kada govorimo o LVGL projektu referencirati ćemo se na ovu strukturu.

```
/Core
    ...
    /Src
        main.c
    ...
/Drivers
    ...
/Middlewares
    ...
    /eez-framework
        /src
            /eez
                /core
                    ...
                /flow
                    ...
                /fs
                    ...
                /gui
                    ...
                /libs
                    ...
                /platform
                    ...
    /lvgl
        ...
    ...
/eez-project
    smart-home.eez-project
    /src
        /ui
            ... (files generated by the studio)
```

### LVGL file templates

TODO

### LVGL library

Podržana je verzija 8.3.

### Initialization and Execution of Project

-   `ui_init()`

-   `ui_tick()`

## Integration of EEZ-GUI projects

Ovo je jedna moguća struktura source coda za EEZ-GUI projekt na STM32F469I DISCO development board koji je kreiran koristeći STM32CubeIDE (čitav source code se nalazi ovdje: https://github.com/eez-open/stm32f469i-disco-eez-flow-demo). U nastavku kada govorimo o EEZ-GUI projektu referencirati ćemo se na ovu strukturu.

```
/Core
    ...
    /Src
        main.c       <-- We will modify this file
    ...
/Drivers
    ...
/Middlewares
    ...
    /eez-framework    <-- EEZ Framwork Library from github
        /src
            /eez
                /core
                    ...
                /flow
                    ...
                /fs
                    ...
                /gui
                    ...
                /libs
                    ...
                /platform
                    ...
/Src
    flow/
        hooks.cpp
        hooks.h
    gui/
        action.cpp
        app_context.cpp
        app_context.h
        data.cpp
        document.cpp   <-- file generated by the studio
        document.h     <-- file generated by the studio
        hooks.cpp
        hooks.h
        keypad.cpp
        keypad.h
    ...
    stm32f469i-disco-eez-flow-demo.eez-project  <-- eez-project file
    firmware.cpp
    firmware.h
    ...
```

### EEZ-GUI file templates

U documents.h:

//${eez-studio DATA_ENUM stm32}

//${eez-studio DATA_FUNCS_DECL stm32}

//${eez-studio DATA_ARRAY_DECL stm32}

//${eez-studio ACTIONS_ENUM stm32}

//${eez-studio ACTIONS_FUNCS_DECL stm32}

//${eez-studio ACTIONS_ARRAY_DECL stm32}

//${eez-studio GUI_FONTS_ENUM stm32}

//${eez-studio GUI_BITMAPS_ENUM stm32}

//${eez-studio GUI_STYLES_ENUM stm32}

//${eez-studio GUI_THEMES_ENUM stm32}

//${eez-studio GUI_COLORS_ENUM stm32}

//${eez-studio GUI_PAGES_ENUM stm32}

//${eez-studio GUI_ASSETS_DECL_COMPRESSED stm32}

U documents.cpp:

//${eez-studio DATA_ARRAY_DEF stm32}

//${eez-studio ACTIONS_ARRAY_DEF stm32}

//${eez-studio GUI_ASSETS_DEF_COMPRESSED stm32}

## Native Interaction with the Flow

### Native Variables

```
getLocalVariable
getGlobalVariable
```

### Native Actions

Za native akcije je također moguće definirati flow koji se koristi samo kada se projekt izvršava u Studiju, a odbacuje se prilikom buildanja projekta, jer se prilikom native izvršavanja koristi native akcija.

## Example Projects

### Development boards

Primjeri projekata sa native integracijom koji se izvršavaju na nekom development boardu:

-   https://github.com/eez-open/stm32f469i-disco-eez-flow-demo
    Project type: EEZ-GUI
    Board: stm32f469i-disco

-   https://github.com/eez-open/stm32f469i-disco-lvgl-demo
    Project type: LVGL
    Board: stm32f469i-disco

-   https://github.com/eez-open/stm32h745i-disco-lvgl-demo
    Project type: LVGL
    Board: stm32h745i-disco

-   https://github.com/eez-open/MStack-DMA-eez-flow-demo
    Project type: LVGL
    Board: MStack

-   https://github.com/eez-open/Nscreen_32-esp32-eez-flow-demo
    Project type: LVGL
    Board: Nscreen_32-esp32

-   https://github.com/eez-open/esp32-lvgl-eez-demo
    Project type: LVGL
    Board: esp32

### Simulators

Ovo su primjeri koji se ne izvršavaju na boardu nego simuliraju izvršavanje na deskopu, ali su također native aplikacije napisane u C++

-   https://github.com/eez-open/sdl-eez-flow-demo
    Project type: EEZ-GUI
    Based on: SDL

-   https://github.com/eez-open/lvgl-web-demo
    Project type: LVGL
    Based on: EMSCRIPTEN