import axios from "axios";
import { connectDB } from "./db.js";

const BASE = "https://hentaio.pro";

function mixContent(watchList, specialList) {
  const result = [];
  const maxLength = Math.max(watchList.length, specialList.length);

  for (let i = 0; i < maxLength; i++) {
    if (watchList[i]) result.push(watchList[i]);
    if (specialList[i]) result.push(specialList[i]);
  }

  return result;
}

async function fetchAllSeries() {
  const res = await axios.get("https://api.hentaio.pro/api/series?page=1");
  return res.data?.data?.series || [];
}

async function fetchAllSpecial() {
  const res = await axios.get("https://api.hentaio.pro/api/special-home?page=1");
  return res.data?.data || [];
}

export async function fetchAndStore() {
  const db = await connectDB();
  const collection = db.collection("content");

  const [seriesData, specialData] = await Promise.all([
    fetchAllSeries(),
    fetchAllSpecial(),
  ]);

  const watchLinks = seriesData.map((item) => ({
    type: "watch",
    url: `${BASE}/${item.link}`,
    title: item.title,
    poster: item.poster,
  }));

  const specialLinks = specialData.map((item) => {
    const slug = item.link
      .replace("https://3d-hentai.co/", "")
      .replace(/\/$/, "");

    return {
      type: "special",
      url: `${BASE}/special/${slug}`,
      title: item.title,
      poster: item.thumbnail,
    };
  });

  // 🔥 MIX + POSITION (IMPORTANT)
  const mixed = mixContent(watchLinks, specialLinks).map((item, index) => ({
    ...item,
    position: index,
    createdAt: new Date(),
  }));

  // 🔥 CLEAR OLD DATA (IMPORTANT for correct order)
  await collection.deleteMany({});

  // 💾 INSERT FRESH
  await collection.insertMany(mixed);

  console.log("✅ Stored with correct w/s/w/s order");
}