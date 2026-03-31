import axios from "axios";
import { connectDB } from "./db.js";

const BASE = "https://hentaio.pro";
const HOURS_48 = 48 * 60 * 60 * 1000;

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

// 📄 Fetch series (LIMITED pages for performance)
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
  } while (page <= Math.min(totalPages, 5)); // ⚡ LIMIT to latest 5 pages

  return all;
}

// 🎬 Fetch special (LIMITED pages)
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
  } while (page <= Math.min(totalPages, 5)); // ⚡ LIMIT

  return all;
}

// 🎯 MAIN FUNCTION
export async function fetchAndStore() {
  try {
    const db = await connectDB();
    const collection = db.collection("content");
    const metaCollection = db.collection("meta");

    console.log("🚀 Checking last run...");

    // 🔒 48-HOUR LOCK
    const lastRunDoc = await metaCollection.findOne({ key: "lastRun" });

    if (lastRunDoc) {
      const lastRunTime = new Date(lastRunDoc.value).getTime();
      const now = Date.now();

      if (now - lastRunTime < HOURS_48) {
        console.log("⛔ Skipping: Already ran within 48 hours");
        return;
      }
    }

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

    // 🔥 UNIQUE INDEX (safe)
    await collection.createIndex({ url: 1 }, { unique: true });

    // 🔍 GET EXISTING URLS
    const existingDocs = await collection
      .find({}, { projection: { url: 1 } })
      .toArray();

    const existingUrls = new Set(existingDocs.map((doc) => doc.url));

    // 🆕 FILTER ONLY NEW
    const newItems = mixed.filter((item) => !existingUrls.has(item.url));

    console.log(`🆕 New items to insert: ${newItems.length}`);

    // 💾 INSERT ONLY NEW
    if (newItems.length > 0) {
      await collection.insertMany(newItems);
    }

    // 💾 SAVE LAST RUN TIME
    await metaCollection.updateOne(
      { key: "lastRun" },
      { $set: { value: new Date() } },
      { upsert: true }
    );

    console.log("✅ Data stored successfully");
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
}