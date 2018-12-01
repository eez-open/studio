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
} = styledComponents as ThemedStyledComponentsModule<ThemeInterface>;

export { css, createGlobalStyle, keyframes, ThemeProvider };
export default styled;
