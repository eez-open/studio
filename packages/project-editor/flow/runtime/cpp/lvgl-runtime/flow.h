#pragma once

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

void flowInit(uint32_t wasmModuleId, uint8_t *assets, uint32_t assetsSize);
bool flowTick();
void flowOnPageLoaded(unsigned pageIndex);
void flowPropagateValue(unsigned pageIndex, unsigned componentIndex, unsigned outputIndex);

#ifdef __cplusplus
}
#endif
