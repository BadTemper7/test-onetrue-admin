// Progressive enhancement: preserve the existing <table>, <td>, React handlers,
// server-side pagination, and permissions. Only add display labels for mobile cards.
// Exclude custom mobile views and dense interaction matrices explicitly.
export const enhanceAdaptiveTables = (root = document) => {
  for (const table of root.querySelectorAll("table.otli-data-table:not([data-mobile-view])")) {
    if (table.classList.contains("hidden")) continue;
    const headers = Array.from(table.querySelectorAll(":scope > thead > tr:last-child > th"));
    if (headers.length < 2) continue;
    const labels = headers.map((header, index) =>
      header.getAttribute?.("aria-label") || header.textContent?.trim() ||
      (index === headers.length - 1 ? "Actions" : `Field ${index + 1}`));
    table.classList.add("otli-adaptive-table");
    for (const body of table.tBodies) {
      for (const row of body.rows) {
        let columnIndex = 0;
        for (const cell of row.cells) {
          if (cell.colSpan > 1) {
            cell.dataset.mobileSpan = "true";
          } else {
            cell.dataset.columnLabel = labels[columnIndex] || `Field ${columnIndex + 1}`;
          }
          columnIndex += cell.colSpan;
        }
      }
    }
  }
};

