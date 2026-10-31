import { BING_BASE, UA, bingApi, ACCEPT_LANG } from "./config.js";

export async function fetchLatest() {
  const res = await fetch(bingApi(), {
    headers: {
      "User-Agent": UA,
      Accept: "application/json",
      "Accept-Language": ACCEPT_LANG,
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Bing API ${res.status}`);

  const { images } = await res.json();
  const img = images?.[0];
  if (!img?.url || !img.enddate) {
    throw new Error("Bing API returned no image");
  }

  return {
    date: img.enddate.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
    desc: img.copyright ?? "",
    url: img.url.startsWith("http") ? img.url : BING_BASE + img.url,
  };
}
