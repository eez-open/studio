#!/bin/bash
OUT="../exported-functions.txt"
~/emsdk/upstream/bin/llvm-objdump -t ./lib/liblvgl.a | grep "g     F CODE lv_" | cut -c 23- | sed 's/^/_/' > $OUT
sed -i '1s/^/_malloc \n/' $OUT
sed -i '1s/^/_free \n/' $OUT
