// styled-components.ts
import * as styledComponents from "styled-components";
import { ThemedStyledComponentsModule } from "styled-components";

import { ThemeInterface } from "eez-studio-ui/theme";

const {
    default: styled,
    css,
    injectGlobal,
    keyframes,
    ThemeProvider
} = styledComponents as ThemedStyledComponentsModule<ThemeInterface>;

export { css, injectGlobal, styled, keyframes, ThemeProvider };
export default styled;
