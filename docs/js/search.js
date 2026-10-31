/**
 * 搜索（增强版）
 *
 * 主搜索逻辑在 /js/fluent-ui.js（顶部命令栏表单、Toast、预取 images.json）。
 * 这里保留旧页面内联调用 search() 的兼容入口，并在 fuse.js 加载完成后
 * 把结果以相同的 Fluent Card 结构渲染到 #img_list。
 */
(function () {
  "use strict";

  var SEARCH_LIMIT = 36;
  var FUSE_CDN = "https://cdn.bootcdn.net/ajax/libs/fuse.js/6.5.3/fuse.min.js";

  function icon(id, cls) {
    return (
      '<svg class="ic ' +
      (cls || "") +
      '" aria-hidden="true"><use href="#' +
      id +
      '"></use></svg>'
    );
  }

  function esc(s) {
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

  var WEEKDAYS = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

  function baseUrl(url) {
    var i = url.indexOf("&");
    return i === -1 ? url : url.slice(0, i);
  }

  // 静态 CDN 被拦截时，从同源依赖再试一次
  function ensureFuse(callback) {
    if (window.Fuse) {
      callback();
      return;
    }
    var script = document.createElement("script");
    script.src = FUSE_CDN;
    script.onload = function () {
      callback();
    };
    script.onerror = function () {
      console.warn("[search] fuse.js 加载失败，降级为子串匹配");
      callback();
    };
    document.head.appendChild(script);
  }

  function searchResultHtml(data) {
    var rows = data
      .map(function (entry) {
        var item = entry.item || entry;
        var date = String(item.date || "");
        var url = baseUrl(item.url || "");
        var region = item.region || "zh-cn";
        var desc = item.desc || "";
        var parts = date.split("-");
        var href = "/day/" + parts[0] + parts[1] + "/" + parts[2] + ".html";
        var full = url + "&rf=LaDigue_UHD.jpg&pid=hp&w=3840&h=2160&rs=1&c=4";
        var d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
        var week = isNaN(d.getTime()) ? "" : WEEKDAYS[d.getDay()];
        return (
          '<article class="card">' +
          '<div class="card-media">' +
          '<img class="smallImg" src="' +
          esc(url) +
          '&pid=hp&w=50" alt="" aria-hidden="true">' +
          '<img class="bigImg" src="' +
          esc(url) +
          '&pid=hp&w=384&h=216&rs=1&c=4" alt="' +
          esc(desc) +
          '" loading="lazy" onload="imgloading(this)">' +
          '<span class="card-date">' +
          icon("i-calendar", "ic-sm") +
          esc(date) +
          "</span>" +
          '<div class="card-actions">' +
          '<a class="card-action bing-download" href="' +
          esc(full) +
          '" data-region="' +
          esc(region) +
          '" data-date="' +
          esc(date) +
          '" data-desc="' +
          esc(desc) +
          '" target="_blank" rel="noopener" title="下载 4K 原图">' +
          icon("i-download") +
          "</a>" +
          "</div>" +
          "</div>" +
          '<div class="card-body">' +
          '<a class="card-title" href="' +
          esc(href) +
          '">' +
          esc(desc) +
          "</a>" +
          '<div class="card-foot">' +
          '<span class="card-time">' +
          icon("i-clock", "ic-sm") +
          esc(week) +
          "</span>" +
          '<a class="card-link" href="' +
          esc(href) +
          '">查看大图' +
          icon("i-chevron-right", "ic-sm") +
          "</a>" +
          "</div>" +
          "</div>" +
          "</article>"
        );
      })
      .join("");
    return rows;
  }

  function search() {
    var input = document.getElementById("search");
    var grid = document.getElementById("img_list");
    if (!input || !grid) return;

    var keyword = input.value.trim();
    if (!keyword) return;

    fetch("/images.json", { credentials: "omit" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (jsonArray) {
        ensureFuse(function () {
          var results;
          if (window.Fuse) {
            var fuse = new window.Fuse(jsonArray, {
              threshold: 0.42,
              keys: ["desc", "date"],
              includeScore: true,
              includeMatches: true,
              ignoreLocation: true,
            });
            results = fuse.search(keyword).slice(0, SEARCH_LIMIT);
          } else {
            var lower = keyword.toLowerCase();
            results = jsonArray
              .filter(function (x) {
                return (
                  String(x.desc || "").toLowerCase().indexOf(lower) !== -1 ||
                  String(x.date || "").indexOf(keyword) !== -1
                );
              })
              .slice(0, SEARCH_LIMIT)
              .map(function (x) {
                return { item: x };
              });
          }

          var section = document.querySelector("[data-grid-section]");
          if (section) section.hidden = false;

          if (!results.length) {
            grid.innerHTML =
              '<div class="empty">' +
              icon("i-search-off") +
              "<strong>没有找到与“" +
              esc(keyword) +
              "”匹配的壁纸</strong>" +
              "<span>换个关键词试试，例如“山”“湖”或日期 2024-05</span>" +
              "</div>";
          } else {
            grid.innerHTML = searchResultHtml(results);
          }

          if (window.imgloading) {
            document.querySelectorAll("img.bigImg").forEach(function (img) {
              if (img.complete) window.imgloading(img);
            });
          }
          if (window.bingDownloadEnhance) window.bingDownloadEnhance();
        });
      })
      .catch(function (err) {
        console.error("[search]", err);
      });
  }

  function generateHTML(data) {
    return searchResultHtml(data);
  }

  if (typeof window !== "undefined") {
    window.search = search;
    window.generateHTML = generateHTML;
  }
})();
