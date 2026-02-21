import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { initApp } from "./app";

// Only run when the extension is loaded in Owlbear Rodeo
OBR.onReady(() => {
  initApp();
});
