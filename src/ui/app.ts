import { loadCharacters } from "../obr/storage";

export async function renderApp(root: HTMLElement) {
  const characters = await loadCharacters();

  root.innerHTML = `
    <div style="padding:8px">
      <select id="characterSelect">
        ${Object.values(characters)
          .map(c => `<option value="${c.id}">${c.name}</option>`)
          .join("")}
      </select>
      <div style="margin-top:12px">
        <strong>Foxyverse System</strong>
        <p>Phase 1 loaded.</p>
      </div>
    </div>
  `;
}
