// styled-components.ts
import * as styledComponents from "styled-components";
import { ThemedStyledComponentsModule } from "styled-components";

import { ThemeInterface } from "eez-studio-ui/theme";

const {
    default: styled,
    css,
    createGlobalStyle,
    keyframes,
    ThemeProvider
} = styledComponents as unknown as ThemedStyledComponentsModule<ThemeInterface>;

export { css, styled, createGlobalStyle, keyframes, ThemeProvider };
export default styled;
