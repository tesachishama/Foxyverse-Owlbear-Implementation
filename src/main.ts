import OBR from "@owlbear-rodeo/sdk";

OBR.onReady(() => {
  console.log("Foxyverse extension loaded");

  const app = document.getElementById("app");
  if (!app) throw new Error("App root #app not found");

  app.innerHTML = `
    <div style="
      color: white;
      padding: 16px;
      background: #222;
      border-radius: 8px;
      font-family: sans-serif;
    ">
      <h3>Foxyverse</h3>

      <label>
        Active Character:
        <select id="character-select">
          <option value="">— Select —</option>
          <option value="char1">Character One</option>
          <option value="char2">Character Two</option>
        </select>
      </label>

      <div id="output" style="margin-top: 10px; opacity: 0.8;"></div>
    </div>
  `;

  const select = document.getElementById("character-select") as HTMLSelectElement;
  const output = document.getElementById("output");

  select.addEventListener("change", () => {
    if (output) {
      output.textContent = `Selected: ${select.value || "none"}`;
    }
  });
});
