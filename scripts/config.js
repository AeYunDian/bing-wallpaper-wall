// 只做中文站
export const REGION = "zh-CN";

export const BING_BASE = "https://cn.bing.com";

export const bingApi = () =>
  `https://cn.bing.com/HPImageArchive.aspx?format=js&idx=0&n=9&pid=hp` +
  `&FORM=BEHPTB&uhd=1&uhdwidth=3840&uhdheight=2160` +
  `&mkt=zh-CN&setmkt=zh-CN&setlang=zh`;

export const ACCEPT_LANG = "zh-CN,zh;q=0.9";

export const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const README_LIMIT = 30;
