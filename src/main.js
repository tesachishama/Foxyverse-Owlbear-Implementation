import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { initApp } from "./app";

/**
 * Extension entry: Owlbear loads this bundle and runs `OBR.onReady` once the SDK is usable.
 * See: docs/CODEBASE.md#bootstrap-and-entry
 */
OBR.onReady(() => {
  initApp().catch((error) => {
    console.error(error);
  });
});
