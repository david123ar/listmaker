import axios from "axios";
import { connectDB } from "./db.js";

const BASE = "https://hentaio.pro";

// 🔀 MIX (w/s/w/s)
function mixContent(watchList, specialList) {
  const result = [];
  const maxLength = Math.max(watchList.length, specialList.length);

  for (let i = 0; i < maxLength; i++) {
    if (watchList[i]) result.push(watchList[i]);
    if (specialList[i]) result.push(specialList[i]);
  }

  return result;
}

// 📄 Fetch ALL series pages
async function fetchAllSeries() {
  let page = 1;
  let totalPages = 1;
  let all = [];

  do {
    const res = await axios.get(
      `https://api.hentaio.pro/api/series?page=${page}`
    );

    const data = res.data;
    totalPages = data.totalPages;

    all.push(...(data?.data?.series || []));

    console.log(`📄 Series ${page}/${totalPages}`);
    page++;
  } while (page <= totalPages);

  return all;
}

// 🎬 Fetch ALL special pages
async function fetchAllSpecial() {
  let page = 1;
  let totalPages = 1;
  let all = [];

  do {
    const res = await axios.get(
      `https://api.hentaio.pro/api/special-home?page=${page}`
    );

    const data = res.data;
    totalPages = data.totalPages;

    all.push(...(data?.data || []));

    console.log(`🎬 Special ${page}/${totalPages}`);
    page++;
  } while (page <= totalPages);

  return all;
}

// 🎯 MAIN FUNCTION
export async function fetchAndStore() {
  try {
    const db = await connectDB();
    const collection = db.collection("content");

    console.log("🚀 Fetching APIs...");

    const [seriesData, specialData] = await Promise.all([
      fetchAllSeries(),
      fetchAllSpecial(),
    ]);

    // ✅ WATCH LINKS
    const watchLinks = seriesData.map((item) => ({
      type: "watch",
      url: `${BASE}/${item.link}`,
      title: item.title,
      poster: item.poster,
      createdAt: new Date(),
    }));

    // ✅ SPECIAL LINKS
    const specialLinks = specialData.map((item) => {
      const slug = item.link
        .replace("https://3d-hentai.co/", "")
        .replace(/\/$/, "");

      return {
        type: "special",
        url: `${BASE}/special/${slug}`,
        title: item.title,
        poster: item.thumbnail,
        createdAt: new Date(),
      };
    });

    // 🔀 MIX
    const mixed = mixContent(watchLinks, specialLinks);

    console.log(`🔀 Mixed Total: ${mixed.length}`);

    // 🔥 CREATE UNIQUE INDEX (run once safely)
    await collection.createIndex({ url: 1 }, { unique: true });

    // 💾 BULK UPSERT (FAST ⚡)
    const operations = mixed.map((item) => ({
      updateOne: {
        filter: { url: item.url },
        update: { $set: item },
        upsert: true,
      },
    }));

    if (operations.length > 0) {
      await collection.bulkWrite(operations);
    }

    console.log("✅ Data stored successfully");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}