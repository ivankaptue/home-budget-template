import { render } from "preact";
import { App } from "./ui/App";
import "./ui/styles.css";
import { applyTheme, theme } from "./ui/state";

applyTheme(theme.value);

render(<App />, document.getElementById("root")!);
