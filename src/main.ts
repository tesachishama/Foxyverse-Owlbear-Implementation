import OBR from "@owlbear-rodeo/sdk";
import { renderApp } from "./ui/app";

async function init() {
  await OBR.waitUntilReady();

  const root = document.getElementById("app");
  if (!root) throw new Error("App root missing");

  await renderApp(root);

  console.log("Foxyverse extension loaded");
}

init();
