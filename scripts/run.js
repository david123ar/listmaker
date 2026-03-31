import { fetchAndStore } from "../lib/fetchAndStore.js";

(async () => {
  await fetchAndStore();
  process.exit();
})();