(function () {
  const list = document.getElementById("series-index");
  const status = document.getElementById("series-index-status");

  fetch("content/series.json")
    .then((res) => {
      if (!res.ok) throw new Error("series.json request failed: " + res.status);
      return res.json();
    })
    .then(renderSeries)
    .catch(() => {
      status.textContent = "";
    });

  function renderSeries(series) {
    status.remove();

    if (!Array.isArray(series) || series.length === 0) {
      return;
    }

    for (const item of series) {
      list.appendChild(buildItem(item));
    }
  }

  function buildItem(item) {
    const link = document.createElement("a");
    link.className = "series-index__item";
    link.href = "series.html?slug=" + encodeURIComponent(item.slug);

    const title = document.createElement("span");
    title.className = "series-index__title";
    title.textContent = item.title;
    link.appendChild(title);

    if (item.year) {
      const year = document.createElement("span");
      year.className = "series-index__year";
      year.textContent = item.year;
      link.appendChild(year);
    }

    return link;
  }
})();
