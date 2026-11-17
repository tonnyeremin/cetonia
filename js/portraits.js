(function () {
  const gallery = document.getElementById("gallery");
  const status = document.getElementById("gallery-status");

  fetch("content/series/portraits.json")
    .then((res) => {
      if (!res.ok) throw new Error("portraits.json request failed: " + res.status);
      return res.json();
    })
    .then(render)
    .catch(() => {
      status.textContent = "";
    });

  function render(series) {
    // Only plain images belong in the grid; their position here is the
    // frame index the viewer opens at.
    const images = (series.steps || []).filter((s) => s.type === "image");

    if (images.length === 0) {
      status.textContent = "Coming soon";
      return;
    }

    status.remove();

    images.forEach((step, i) => {
      const item = document.createElement("figure");
      item.className = "gallery__item";

      const link = document.createElement("a");
      link.className = "gallery__link";
      link.href = "series.html?slug=portraits&i=" + i;

      const img = document.createElement("img");
      img.src = step.image;
      img.alt = step.alt || step.caption || "";
      img.loading = "lazy";
      if (step.width && step.height) {
        img.width = step.width;
        img.height = step.height;
      }

      link.appendChild(img);
      item.appendChild(link);

      if (step.caption) {
        const caption = document.createElement("figcaption");
        caption.className = "label gallery__caption";
        caption.textContent = step.caption;
        item.appendChild(caption);
      }

      gallery.appendChild(item);
    });
  }
})();
