#!/bin/bash
MISC="../exported-functions-misc.txt"
LVGL="../exported-functions-lvgl.txt"
ALL="../exported-functions.txt"
~/emsdk/upstream/bin/llvm-objdump -t ./lib/liblvgl.a | grep "g     F CODE lv_" | cut -c 23- | sed 's/^/_/' > $LVGL
cat $MISC > $ALL
cat $LVGL >> $ALL
