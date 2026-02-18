import OBR from "@owlbear-rodeo/sdk";

OBR.onReady(() => {
  console.log("Foxyverse extension loaded");

  document.body.innerHTML = `
    <div style="
      color: white;
      padding: 20px;
      font-size: 18px;
      background: #222;
    ">
      Extension loaded successfully.
    </div>
  `;
});
