/**
 * Bing Wallpaper · Fluent UI 交互脚本
 *
 * 仅使用原生 JS，不依赖框架，对应 Fluent 2 Web 的交互行为：
 * 1. 主题（跟随系统 / 浅色 / 深色），与 darkmode-js 的 localStorage 开关互通
 * 2. 命令栏在滚动后切换为 Acrylic 实心材质
 * 3. 导航抽屉（Drawer）：打开 / 关闭 / Esc / 焦点管理
 * 4. 站点搜索：fuse.js 模糊搜索 docs/images.json，结果渲染为 Fluent Card
 * 5. 图片渐进加载（模糊占位 -> 清晰图）
 * 6. 回到顶部按钮
 *
 * 兼容旧界面遗留的全局函数：w3_open / w3_close / imgloading / updateLove
 */
(function () {
  "use strict";

  var THEME_KEY = "theme";
  var DARKMODE_KEY = "darkmode:darkmode:activated";
  var SEARCH_LIMIT = 36;
  var ROOT = document.documentElement;

  var $ = function (sel, ctx) {
    return (ctx || document).querySelector(sel);
  };
  var $$ = function (sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  };

  /* ---------------------------------------------------------------------
   * 0. 尽早应用主题，避免闪烁
   * ------------------------------------------------------------------- */

  function readStoredTheme() {
    try {
      var t = localStorage.getItem(THEME_KEY);
      if (t === "light" || t === "dark" || t === "system") {
        return t;
      }
      if (localStorage.getItem(DARKMODE_KEY) === "true") {
        return "dark";
      }
    } catch (e) {
      /* 隐私模式等场景忽略 */
    }
    return "system";
  }

  function systemPrefersDark() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }

  function resolvedTheme() {
    var pref = readStoredTheme();
    return pref === "system" ? (systemPrefersDark() ? "dark" : "light") : pref;
  }

  function applyTheme() {
    var pref = readStoredTheme();
    var resolved = resolvedTheme();
    ROOT.setAttribute("data-theme-preference", pref);
    ROOT.setAttribute("data-theme", resolved);
    try {
      localStorage.setItem(DARKMODE_KEY, resolved === "dark" ? "true" : "false");
    } catch (e) {
      /* ignore */
    }
    var btn = $("[data-theme-toggle]");
    if (btn) {
      var next = resolved === "dark" ? "light" : "dark";
      btn.setAttribute("aria-pressed", resolved === "dark" ? "true" : "false");
      btn.setAttribute(
        "aria-label",
        resolved === "dark" ? "切换到浅色主题" : "切换到深色主题"
      );
      btn.setAttribute("title", resolved === "dark" ? "浅色主题" : "深色主题");
      btn.setAttribute("data-next", next);
      btn.classList.toggle("is-dark", resolved === "dark");
    }
    var meta = $('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", resolved === "dark" ? "#141414" : "#f5f5f5");
    }
    document.dispatchEvent(
      new CustomEvent("fluent:themechange", { detail: { theme: resolved } })
    );
  }

  applyTheme();

  function setTheme(pref) {
    try {
      localStorage.setItem(THEME_KEY, pref);
    } catch (e) {
      /* ignore */
    }
    applyTheme();
  }

  /* ---------------------------------------------------------------------
   * 1. 工具函数
   * ------------------------------------------------------------------- */

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }

  // 去掉版权署名尾巴，卡片上只留地点
  function placeOf(desc) {
    return String(desc == null ? "" : desc).replace(
      /\s*[（(]\s*(©|\(c\)|C)[^）)]*[）)]\s*$/i,
      ""
    );
  }

  // 详情页：Esc 返回（与页头返回按钮同一套判断）
  function initViewerKeys() {
    if (!$(".viewer")) return;
    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape" || e.altKey || e.ctrlKey || e.metaKey) return;
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      goBack();
    });
  }

  /* 返回逻辑：
   * 1. 有本站来源（referrer 同源，或本标签页记录过上一次的本站路径）且能用浏览器历史 -> history.back()
   * 2. 否则（直接打开、外站跳进来、历史不足）-> 回首页
   */
  var PREV_PATH_KEY = "bingwp:prev-path";
  var enteredFrom = null;

  function currentPath() {
    return window.location.pathname + window.location.search;
  }

  function sameSiteRef() {
    var ref = document.referrer;
    if (!ref) return false;
    try {
      return new URL(ref).origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  function hasSameSiteHistory() {
    if (window.history.length <= 1) return false;
    if (sameSiteRef()) return true;
    // 进入本页之前的那一页；与本页相同说明是同页刷新，不算有效来源
    return !!enteredFrom && enteredFrom !== currentPath();
  }

  function goBack() {
    if (hasSameSiteHistory()) {
      window.history.back();
    } else {
      window.location.href = "/";
    }
  }

  window.fluentGoBack = goBack;

  // 先读取上一次的本站路径，再把本页写进去（顺序不能反）
  function rememberPath() {
    try {
      enteredFrom = window.sessionStorage.getItem(PREV_PATH_KEY) || null;
      window.sessionStorage.setItem(PREV_PATH_KEY, currentPath());
    } catch (e) {
      enteredFrom = null;
    }
  }

  function initBackButtons() {
    $$("[data-go-back]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        // 允许中键/修饰键按浏览器默认方式新开
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        goBack();
      });
    });
  }

  var ICON = function (id, cls) {
    return (
      '<svg class="ic ' +
      (cls || "") +
      '" aria-hidden="true"><use href="#' +
      id +
      '"></use></svg>'
    );
  };

  function weekday(dateStr) {
    var p = dateStr.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    if (isNaN(d.getTime())) return "";
    return ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][
      d.getDay()
    ];
  }

  function relativeDay(dateStr) {
    var p = dateStr.split("-");
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var diff = Math.round((today - d) / 86400000);
    if (diff === 0) return "今天";
    if (diff === 1) return "昨天";
    if (diff === 2) return "前天";
    return "";
  }

  /* ---------------------------------------------------------------------
   * 2. 命令栏滚动材质
   * ------------------------------------------------------------------- */

  function initAppBar() {
    // 命令栏现在是常驻 Acrylic 表面，无需随滚动切换；图片详情页走透明变体
  }

  /* ---------------------------------------------------------------------
   * 3. 导航抽屉
   * ------------------------------------------------------------------- */

  var drawer = null;
  var scrim = null;
  var lastFocus = null;

  function openDrawer() {
    if (!drawer) return;
    lastFocus = document.activeElement;
    drawer.classList.add("is-open");
    drawer.removeAttribute("aria-hidden");
    drawer.removeAttribute("inert");
    if (scrim) scrim.classList.add("is-open");
    document.body.style.overflow = "hidden";
    var first = $(".drawer-item.is-current", drawer) || $(".drawer-item", drawer);
    if (first) {
      window.setTimeout(function () {
        first.focus();
      }, 60);
    }
  }

  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (scrim) scrim.classList.remove("is-open");
    document.body.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function initDrawer() {
    drawer = $("#navDrawer");
    scrim = $("#navScrim");
    if (!drawer) return;
    drawer.setAttribute("aria-hidden", "true");
    $$("[data-drawer-open]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        openDrawer();
      });
    });
    $$("[data-drawer-close]").forEach(function (el) {
      el.addEventListener("click", function (e) {
        e.preventDefault();
        closeDrawer();
      });
    });
    if (scrim) scrim.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) {
        closeDrawer();
      }
      if (e.key === "Tab" && drawer.classList.contains("is-open")) {
        // 焦点陷阱
        var items = $$(
          'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
          drawer
        ).filter(function (n) {
          return n.offsetParent !== null;
        });
        if (!items.length) return;
        var first = items[0];
        var last = items[items.length - 1];
        if (!drawer.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  }

  // 兼容旧页面内联调用
  window.w3_open = openDrawer;
  window.w3_close = closeDrawer;

  /* ---------------------------------------------------------------------
   * 4. 图片渐进加载
   * ------------------------------------------------------------------- */

  function markLoaded(img) {
    if (!img) return;
    img.classList.add("is-loaded");
    // 旧界面使用内联 opacity 动画
    if (img.classList.contains("bigImg")) {
      img.style.opacity = "1";
    }
  }

  function initImages() {
    $$("img.bigImg").forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        markLoaded(img);
      } else {
        img.addEventListener("load", function () {
          markLoaded(img);
        });
        img.addEventListener("error", function () {
          markLoaded(img);
        });
      }
    });

    // Hero 大图：小图占位 -> 大图淡入
    var hero = $(".hero");
    var heroImg = $(".hero-img", hero || document);
    if (hero && heroImg) {
      var url = heroImg.getAttribute("data-src");
      if (url) {
        var pre = new Image();
        pre.onload = function () {
          heroImg.style.backgroundImage = 'url("' + url + '")';
          heroImg.classList.add("is-loaded");
        };
        pre.src = url;
      }
    }

    // 详情页背景：同一张图的模糊铺底
    var plate = $(".viewer-plate");
    if (plate) {
      var plateUrl = plate.getAttribute("data-plate");
      if (plateUrl) {
        var pre0 = new Image();
        pre0.onload = function () {
          plate.style.backgroundImage = 'url("' + plateUrl + '")';
          plate.classList.add("is-loaded");
        };
        pre0.src = plateUrl;
      }
    }

    // 预加载详情页主图，让切换更平滑
    var photo = $(".viewer-photo");
    if (photo) {
      var hi = photo.getAttribute("data-src-full");
      if (hi) new Image().src = hi;
    }
  }

  // 兼容旧界面内联 onload="imgloading(this)"
  window.imgloading = markLoaded;

  // 旧界面点赞按钮没有实现，这里给出 Fluent Toast 反馈，避免点击后报错
  window.updateLove = function () {
    toast("已收到你的反馈，谢谢！");
  };

  /* ---------------------------------------------------------------------
   * 5. Toast（Fluent Toast：底部居中，自动消失）
   * ------------------------------------------------------------------- */

  var toastHost = null;

  function toast(message) {
    if (!toastHost) {
      toastHost = document.createElement("div");
      toastHost.className = "toast-host";
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = ICON("i-info") + "<span>" + escapeHtml(message) + "</span>";
    toastHost.appendChild(el);
    window.requestAnimationFrame(function () {
      el.classList.add("is-visible");
    });
    window.setTimeout(function () {
      el.classList.remove("is-visible");
      window.setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 250);
    }, 2600);
  }

  window.fluentToast = toast;

  /* ---------------------------------------------------------------------
   * 6. 主题按钮 / 回到顶部
   * ------------------------------------------------------------------- */

  function initChrome() {
    $$("[data-theme-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setTheme(btn.getAttribute("data-next") || "light");
      });
    });

    // 系统主题变化：仅在“跟随系统”时响应
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var onChange = function () {
        if (readStoredTheme() === "system") applyTheme();
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }

    var back = $("[data-backtop]");
    if (back) {
      var ticking = false;
      var update = function () {
        back.classList.toggle("is-visible", window.scrollY > 640);
        back.tabIndex = window.scrollY > 640 ? 0 : -1;
        ticking = false;
      };
      window.addEventListener(
        "scroll",
        function () {
          if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(update);
          }
        },
        { passive: true }
      );
      back.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      update();
    }
  }

  /* ---------------------------------------------------------------------
   * 7. 搜索
   * ------------------------------------------------------------------- */

  var imageIndex = null;
  var imageIndexPromise = null;
  var fuse = null;

  function baseUrlOf(url) {
    var i = url.indexOf("&");
    return i === -1 ? url : url.slice(0, i);
  }

  function loadIndex() {
    if (imageIndexPromise) return imageIndexPromise;
    imageIndexPromise = fetch("/images.json", { credentials: "omit" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (data) {
        imageIndex = Array.isArray(data) ? data : [];
        return imageIndex;
      })
      .catch(function (err) {
        console.warn("[fluent-ui] 无法加载 images.json:", err);
        imageIndex = [];
        return imageIndex;
      });
    return imageIndexPromise;
  }

  function ensureFuse() {
    if (window.Fuse) return Promise.resolve(window.Fuse);
    return new Promise(function (resolve) {
      // search.js 中以 async 方式加载了 CDN 版本，这里等待它
      var tries = 0;
      var timer = window.setInterval(function () {
        tries += 1;
        if (window.Fuse || tries > 40) {
          window.clearInterval(timer);
          resolve(window.Fuse || null);
        }
      }, 100);
    });
  }

  function cardHtml(item, contextDate) {
    var date = item.date || "";
    var url = baseUrlOf(item.url || "");
    var region = item.region || "zh-cn";
    var desc = item.desc || "";
    var parts = date.split("-");
    var href = "/day/" + parts[0] + parts[1] + "/" + parts[2] + ".html";
    var full = url + "&rf=LaDigue_UHD.jpg&pid=hp&w=3840&h=2160&rs=1&c=4";
    var hd = url + "&pid=hp&w=1920";
    var rel = contextDate ? relativeDay(date) : "";
    var dlBtn = function (link, label) {
      return (
        '<a class="card-action bing-download" href="' +
        escapeHtml(link) +
        '" target="_blank" rel="noopener" data-region="' +
        escapeHtml(region) +
        '" data-date="' +
        escapeHtml(date) +
        '" data-desc="' +
        escapeHtml(desc) +
        '" title="下载 ' +
        label +
        '" aria-label="下载 ' +
        escapeHtml(date) +
        " 的 " +
        label +
        '">' +
        label +
        "</a>"
      );
    };
    return (
      '<article class="card">' +
      '<a class="card-media" href="' +
      escapeHtml(href) +
      '" aria-label="查看 ' +
      escapeHtml(date) +
      ' 的壁纸">' +
      '<img class="smallImg" alt="" aria-hidden="true" src="' +
      escapeHtml(url) +
      '&pid=hp&w=50">' +
      '<img class="bigImg" alt="' +
      escapeHtml(desc) +
      '" loading="lazy" src="' +
      escapeHtml(url) +
      '&pid=hp&w=384&h=216&rs=1&c=4" onload="imgloading(this)">' +
      "</a>" +
      '<div class="card-body">' +
      '<span class="card-meta">' +
      escapeHtml(date) +
      " · " +
      escapeHtml(weekday(date)) +
      (rel ? " · " + rel : "") +
      "</span>" +
      '<a class="card-title" href="' +
      escapeHtml(href) +
      '">' +
      escapeHtml(placeOf(desc)) +
      "</a>" +
      '<div class="card-foot">' +
      dlBtn(full, "4K") +
      dlBtn(hd, "1080P") +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function renderResults(list, keyword) {
    var grid = $("#search_list") || $("#img_list");
    if (!grid) return;
    var section = $("[data-grid-section]");
    if (!list.length) {
      grid.innerHTML =
        '<div class="empty">' +
        ICON("i-search-off") +
        "<strong>没有找到与“" +
        escapeHtml(keyword) +
        "”匹配的壁纸</strong>" +
        "<span>换个关键词试试，例如“山”“湖”或日期 2024-05</span>" +
        "</div>";
    } else {
      grid.innerHTML = list
        .map(function (x) {
          return cardHtml(x, true);
        })
        .join("");
    }
    if (section) section.hidden = false;
    initImages();
    if (window.bingDownloadEnhance) window.bingDownloadEnhance();
  }

  function runSearch(raw) {
    var q = String(raw || "").trim();
    var status = $("[data-search-status]");
    if (!q) return;
    loadIndex()
      .then(function (list) {
        return ensureFuse().then(function () {
          var results;
          if (window.Fuse) {
            if (!fuse) {
              fuse = new window.Fuse(list, {
                threshold: 0.42,
                keys: ["desc", "date"],
                includeScore: true,
                ignoreLocation: true,
              });
            }
            results = fuse
              .search(q)
              .slice(0, SEARCH_LIMIT)
              .map(function (r) {
                return r.item;
              });
          } else {
            var lower = q.toLowerCase();
            results = list.filter(function (it) {
              return (
                String(it.desc || "")
                  .toLowerCase()
                  .indexOf(lower) !== -1 ||
                String(it.date || "").indexOf(q) !== -1
              );
            });
          }
          renderResults(results, q);
          if (status) {
            status.textContent = "“" + q + "” 共找到 " + results.length + " 张";
          }
          var section = $("[data-grid-section]");
          if (section) {
            section.scrollIntoView({ behavior: "smooth", block: "start" });
          }        });
      })
      .catch(function (err) {
        console.error(err);
        if (status) status.textContent = "搜索服务暂时不可用";
      });
  }

  window.search = function () {
    var input = $("#search");
    runSearch(input ? input.value : "");
  };

  function initSearch() {
    var form = $("[data-search-form]");
    var input = $("#search");
    if (!form || !input) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      runSearch(input.value);
    });

    input.addEventListener("input", function () {
      var clear = $(".input-clear");
      if (clear) clear.classList.toggle("is-visible", input.value.length > 0);
    });

    var clear = $(".input-clear");
    if (clear) {
      clear.addEventListener("click", function () {
        input.value = "";
        input.focus();
        clear.classList.remove("is-visible");
        var section = $("[data-grid-section]");
        if (section && section.dataset.searchSection === "1") {
          section.hidden = true;
        }
      });
    }

    // 快捷键：/ 或 Ctrl+K 聚焦搜索
    document.addEventListener("keydown", function (e) {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag)) {
        e.preventDefault();
        input.focus();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });

    // 预取索引，加快首次搜索
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(loadIndex, { timeout: 4000 });
    } else {
      window.setTimeout(loadIndex, 2500);
    }
  }

  /* ---------------------------------------------------------------------
   * 8. 启动
   * ------------------------------------------------------------------- */

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    rememberPath();
    initAppBar();
    initDrawer();
    initImages();
    initChrome();
    initBackButtons();
    initViewerKeys();
    initSearch();
    // 已加载完的图片再补一次（脚本可能晚于图片）
    window.setTimeout(initImages, 800);
  });
})();
