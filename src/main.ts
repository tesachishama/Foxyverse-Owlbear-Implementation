import OBR from "@owlbear-rodeo/sdk";

OBR.onReady(() => {
  console.log("Foxyverse extension loaded");

  const app = document.getElementById("app");

  if (!app) {
    throw new Error("App root #app not found");
  }

  app.innerHTML = `
    <div style="
      color: white;
      padding: 20px;
      font-size: 18px;
      background: #222;
      border-radius: 8px;
    ">
      <strong>Foxyverse UI</strong><br />
      Rendering is now correct.
    </div>
  `;
});
