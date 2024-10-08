/*
 * EEZ Modular Firmware
 * Copyright (C) 2021-present, Envox d.o.o.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.

 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.

 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

#include <eez/conf-internal.h>

#include <stdio.h>
#include <stdlib.h>
#include <emscripten.h>

#include <eez/core/alloc.h>

#include <eez/flow/flow.h>
#include <eez/flow/components.h>
#include <eez/flow/flow_defs_v3.h>
#include <eez/flow/expression.h>
#include <eez/flow/queue.h>
#include <eez/flow/debugger.h>
#include <eez/flow/hooks.h>

using namespace eez::gui;

namespace eez {
namespace flow {

////////////////////////////////////////////////////////////////////////////////

// When passed quoted string as '"str"' it will return unquoted string as 'str'.
// Returns false if passed value is not a valid string.
bool parseScpiString(const char *&textArg, size_t &textLenArg) {
	const char *text = textArg;
	size_t textLen = textLenArg;

	if (textLen < 2 || text[0] != '"' || text[textLen - 1] != '"') {
		return false;
	}

	text++;
	textLen -= 2;

	// make sure there is no single quote (") inside
	// scpi can return list of strings as "str1","str2","str3",...
	// and we don't want to recognize this as string
	for (size_t i = 0; i < textLen; i++) {
		if (text[i] == '"') {
			if (i == textLen - 1 || text[i + 1] != '"') {
				return false;
			}
			i++;
		}
	}

	textArg = text;
	textLenArg = textLen;
	return true;
}

////////////////////////////////////////////////////////////////////////////////

enum ScpiResultStatus {
    SCPI_RESULT_STATUS_NOT_READY = 0,
    SCPI_RESULT_STATUS_READY = 1,
    SCPI_RESULT_STATUS_QUEUED = 2
};

struct ScpiComponentExecutionState : public ComponenentExecutionState {
	uint8_t op;
	int instructionIndex;
	char commandOrQueryText[256];

	static ScpiComponentExecutionState *g_waitingForScpiResult;

    char *errorMessage;
    char *result;
    int resultLen;
    bool resultIsBlob;

	bool resultIsReady;

	ScpiComponentExecutionState() {
        errorMessage = 0;
        result = 0;
		instructionIndex = 0;
		commandOrQueryText[0] = 0;
	}

    ~ScpiComponentExecutionState() {
        if (errorMessage) {
            ::free(errorMessage);
        }
        if (result) {
            ::free(result);
        }
    }

	ScpiResultStatus scpi(eez::ArrayValue *instrument, bool isQuery, int timeout, int delay) {
		if (g_waitingForScpiResult) {
			if (g_waitingForScpiResult == this && g_waitingForScpiResult->resultIsReady) {
				g_waitingForScpiResult = nullptr;
				return SCPI_RESULT_STATUS_READY;
			}

			return SCPI_RESULT_STATUS_NOT_READY;
		}

		g_waitingForScpiResult = this;

        errorMessage = 0;
        result = 0;
        resultLen = 0;
        resultIsBlob = 0;

        resultIsReady = false;

		EM_ASM({
            executeScpi($0, $1, new Uint8Array(Module.HEAPU8.buffer, $2, $3), $4, $5, $6);
        }, g_wasmModuleId, instrument, commandOrQueryText, strlen(commandOrQueryText), isQuery ? 1 : 0, timeout, delay);

		return SCPI_RESULT_STATUS_QUEUED;
	}

    ScpiResultStatus scpiCommand(eez::ArrayValue *instrument, int timeout, int delay) {
        return scpi(instrument, false, timeout, delay);
    }

    ScpiResultStatus scpiQuery(eez::ArrayValue *instrument, int timeout, int delay) {
        return scpi(instrument, true, timeout, delay);
    }

    bool getLatestScpiResult(FlowState *flowState, unsigned componentIndex, const char **resultText, size_t *resultTextLen, bool *resultIsBlob) {
        if (errorMessage) {
            throwError(flowState, componentIndex, FlowError::Plain(errorMessage));
            return false;
        }

        if (resultLen >= 2 && result[resultLen - 2] == '\r' && result[resultLen - 1] == '\n') {
            resultLen -= 2;
            result[resultLen] = 0;
        }

        if (resultLen >= 3 && result[0] == '"' && result[resultLen - 1] == '"') {
            // replace "" with "
            size_t j = 1;
            size_t i;
            for (i = 1; i < resultLen - 2; i++, j++) {
                result[j] = result[i];
                if (result[i] == '"' && result[i + 1] == '"') {
                    i++;
                }
            }
            result[j] = result[i];
            result[j + 1] = '"';
            resultLen -= i - j;
        }

        // printf("%d, %.*s\n", (int)resultLen, (int)resultLen, result);

        *resultText = result;
        *resultTextLen = resultLen;
        *resultIsBlob = this->resultIsBlob;
        return true;
    }
};

ScpiComponentExecutionState *ScpiComponentExecutionState::g_waitingForScpiResult = nullptr;

////////////////////////////////////////////////////////////////////////////////

EM_PORT_API(void) onScpiResult(char *errorMessage, char *result, int resultLen, int resultIsBlob) {
	if (isFlowStopped()) {
		return;
	}

    ScpiComponentExecutionState::g_waitingForScpiResult->errorMessage = errorMessage;
	ScpiComponentExecutionState::g_waitingForScpiResult->result = result;
	ScpiComponentExecutionState::g_waitingForScpiResult->resultLen = resultLen;
    ScpiComponentExecutionState::g_waitingForScpiResult->resultIsBlob = resultIsBlob ? true : false;

	ScpiComponentExecutionState::g_waitingForScpiResult->resultIsReady = true;
}

////////////////////////////////////////////////////////////////////////////////

struct ScpiActionComponent : public Component {
	uint8_t instructions[1];
};

void executeScpiComponent(FlowState *flowState, unsigned componentIndex) {
    auto component = (ScpiActionComponent *)flowState->flow->components[componentIndex];

    Value instrumentValue;
    if (!evalProperty(flowState, componentIndex, defs_v3::SCPI_ACTION_COMPONENT_PROPERTY_INSTRUMENT, instrumentValue, FlowError::Property("SCPI", "Instrument"))) {
        return;
    }
    if (!instrumentValue.isArray()) {
        throwError(flowState, componentIndex, FlowError::Plain("Invalid Instrument value in SCPI"));
        return;
    }
    auto instrumentArrayValue = instrumentValue.getArray();

    int err;

    Value timeoutValue;
    if (!evalProperty(flowState, componentIndex, defs_v3::SCPI_ACTION_COMPONENT_PROPERTY_TIMEOUT, timeoutValue, FlowError::Property("SCPI", "Timeout"))) {
        return;
    }
    int timeout = timeoutValue.toInt32(&err);
    if (err == 1) {
        timeout = -1;
    }

    Value delayValue;
    if (!evalProperty(flowState, componentIndex, defs_v3::SCPI_ACTION_COMPONENT_PROPERTY_DELAY, delayValue, FlowError::Property("SCPI", "Delay"))) {
        return;
    }
    int delay = delayValue.toInt32(&err);
    if (err == 1) {
        delay = -1;
    }

	auto instructions = component->instructions;

	static const int SCPI_PART_STRING = 1;
	static const int SCPI_PART_EXPR = 2;
	static const int SCPI_PART_QUERY_WITH_ASSIGNMENT = 3;
	static const int SCPI_PART_QUERY = 4;
	static const int SCPI_PART_COMMAND = 5;
	static const int SCPI_PART_END = 6;

	auto scpiComponentExecutionState = (ScpiComponentExecutionState *)flowState->componenentExecutionStates[componentIndex];

	if (!scpiComponentExecutionState) {
		scpiComponentExecutionState = allocateComponentExecutionState<ScpiComponentExecutionState>(flowState, componentIndex);
		scpiComponentExecutionState->op = instructions[scpiComponentExecutionState->instructionIndex++];
	}

	while (true) {
		if (scpiComponentExecutionState->op == SCPI_PART_STRING) {
			uint16_t sizeLowByte = instructions[scpiComponentExecutionState->instructionIndex++];
			uint16_t sizeHighByte = instructions[scpiComponentExecutionState->instructionIndex++];
			uint16_t stringLength = sizeLowByte | (sizeHighByte << 8);
			stringAppendStringLength(
				scpiComponentExecutionState->commandOrQueryText,
				sizeof(scpiComponentExecutionState->commandOrQueryText),
				(const char *)instructions + scpiComponentExecutionState->instructionIndex,
				(size_t)stringLength
			);
			scpiComponentExecutionState->instructionIndex += stringLength;
		} else if (scpiComponentExecutionState->op == SCPI_PART_EXPR) {
			Value value;
			int numInstructionBytes;
			if (!evalExpression(flowState, componentIndex, instructions + scpiComponentExecutionState->instructionIndex, value, FlowError::Property("SCPI", "Assignable expression"), &numInstructionBytes)) {
				deallocateComponentExecutionState(flowState, componentIndex);
				return;
			}
			scpiComponentExecutionState->instructionIndex += numInstructionBytes;

			char valueStr[256];
			value.toText(valueStr, sizeof(valueStr));

			stringAppendString(
				scpiComponentExecutionState->commandOrQueryText,
				sizeof(scpiComponentExecutionState->commandOrQueryText),
				valueStr
			);
		} else if (scpiComponentExecutionState->op == SCPI_PART_QUERY_WITH_ASSIGNMENT) {
			if (!scpiComponentExecutionState->g_waitingForScpiResult) {
				logScpiQuery(flowState, componentIndex, scpiComponentExecutionState->commandOrQueryText);
			}

            auto scpiResultStatus = scpiComponentExecutionState->scpiQuery(instrumentArrayValue, timeout, delay);
			if (scpiResultStatus != SCPI_RESULT_STATUS_READY) {
				addToQueue(flowState, componentIndex, -1, -1, -1, scpiResultStatus == SCPI_RESULT_STATUS_NOT_READY);
				return;
			}

			const char *resultText;
			size_t resultTextLen;
            bool resultIsBlob;
			if (!scpiComponentExecutionState->getLatestScpiResult(flowState, componentIndex, &resultText, &resultTextLen, &resultIsBlob)) {
                deallocateComponentExecutionState(flowState, componentIndex);
				return;
			}

			logScpiQueryResult(flowState, componentIndex, resultText, resultTextLen);

			Value dstValue;
			int numInstructionBytes;
			if (!evalAssignableExpression(flowState, componentIndex, instructions + scpiComponentExecutionState->instructionIndex, dstValue, FlowError::Property("SCPI", "Assignable expression"), &numInstructionBytes)) {
				deallocateComponentExecutionState(flowState, componentIndex);
				return;
			}
			scpiComponentExecutionState->instructionIndex += numInstructionBytes;

			scpiComponentExecutionState->commandOrQueryText[0] = 0;

			Value srcValue;
            if (resultIsBlob) {
				srcValue = Value::makeBlobRef((const uint8_t *)resultText, resultTextLen, 0xe4581c7b);
            } else if (parseScpiString(resultText, resultTextLen)) {
				srcValue = Value::makeStringRef(resultText, resultTextLen, 0x09143fa4);
			} else {
				char *strEnd;
				long num = strtol(resultText, &strEnd, 10);
				if (strEnd == resultText + resultTextLen) {
					srcValue = Value((int)num, VALUE_TYPE_INT32);
				} else {
					float fnum = strtof(resultText, &strEnd);
					if (strEnd == resultText + resultTextLen) {
						srcValue = Value(fnum, VALUE_TYPE_FLOAT);
					} else {
						srcValue = Value::makeStringRef(resultText, resultTextLen, 0x09143fa4);
					}
				}
			}

			assignValue(flowState, componentIndex, dstValue, srcValue);
		} else if (scpiComponentExecutionState->op == SCPI_PART_QUERY) {
			if (!scpiComponentExecutionState->g_waitingForScpiResult) {
				logScpiQuery(flowState, componentIndex, scpiComponentExecutionState->commandOrQueryText);
			}

            auto scpiResultStatus = scpiComponentExecutionState->scpiQuery(instrumentArrayValue, timeout, delay);
			if (scpiResultStatus != SCPI_RESULT_STATUS_READY) {
				addToQueue(flowState, componentIndex, -1, -1, -1, scpiResultStatus == SCPI_RESULT_STATUS_NOT_READY);
				return;
			}

			const char *resultText;
			size_t resultTextLen;
            bool resultIsBlob;
			if (!scpiComponentExecutionState->getLatestScpiResult(flowState, componentIndex, &resultText, &resultTextLen, &resultIsBlob)) {
                deallocateComponentExecutionState(flowState, componentIndex);
				return;
			}

			scpiComponentExecutionState->commandOrQueryText[0] = 0;
		} else if (scpiComponentExecutionState->op == SCPI_PART_COMMAND) {
			if (!scpiComponentExecutionState->g_waitingForScpiResult) {
				logScpiCommand(flowState, componentIndex, scpiComponentExecutionState->commandOrQueryText);
			}

            auto scpiResultStatus = scpiComponentExecutionState->scpiCommand(instrumentArrayValue, timeout, delay);
			if (scpiResultStatus != SCPI_RESULT_STATUS_READY) {
				addToQueue(flowState, componentIndex, -1, -1, -1, scpiResultStatus == SCPI_RESULT_STATUS_NOT_READY);
				return;
			}

			const char *resultText;
			size_t resultTextLen;
            bool resultIsBlob;
			if (!scpiComponentExecutionState->getLatestScpiResult(flowState, componentIndex, &resultText, &resultTextLen, &resultIsBlob)) {
                deallocateComponentExecutionState(flowState, componentIndex);
				return;
			}

			scpiComponentExecutionState->commandOrQueryText[0] = 0;
		} else if (scpiComponentExecutionState->op == SCPI_PART_END) {
            deallocateComponentExecutionState(flowState, componentIndex);
    		propagateValueThroughSeqout(flowState, componentIndex);
			return;
		}

		scpiComponentExecutionState->op = instructions[scpiComponentExecutionState->instructionIndex++];
	}
}

} // namespace flow
} // namespace eez
