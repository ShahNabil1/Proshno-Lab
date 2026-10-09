import { createContext } from "react";

// Paper-only preference; other renderers retain their normal math weight.
export const EquationBoldContext = createContext(false);

export const AnswerLineFitContext = createContext({ enabled: false, fontSize: 14, layoutKey: "" });
