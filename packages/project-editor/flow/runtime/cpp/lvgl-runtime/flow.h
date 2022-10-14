#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void flowInit(uint32_t wasmModuleId, uint8_t *assets, uint32_t assetsSize);
bool flowTick();

#ifdef __cplusplus
}
#endif
