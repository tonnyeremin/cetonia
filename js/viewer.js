(function () {
  const stage = document.getElementById("viewer");
  const status = document.getElementById("viewer-status");

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  if (!slug) {
    status.textContent = "";
    return;
  }

  fetch("content/series/" + encodeURIComponent(slug) + ".json")
    .then((res) => {
      if (!res.ok) throw new Error("series request failed: " + res.status);
      return res.json();
    })
    .then(start)
    .catch(() => {
      status.textContent = "";
    });

  function start(series) {
    document.title = (series.title || slug) + " — Anton Eremin";
    document.documentElement.lang = series.lang || "ru";

    if (series.presentation === "book") {
      document.body.classList.add("viewer-page--book");
    }

    const frames = buildFrames(series.steps || []);
    if (frames.length === 0) {
      status.textContent = "";
      return;
    }

    status.remove();

    let index = 0;
    let currentImageSrc = null;
    let figureEl = null;
    let vellumEl = null;
    renderFrame(frames[index]);

    function advance(delta) {
      const next = index + delta;
      if (next < 0) return;
      if (next >= frames.length) {
        window.location.href = "index.html";
        return;
      }
      index = next;
      renderFrame(frames[index]);
    }

    // A "pair" step is two frames sharing one photo (overlay, then plain).
    // If the photo is already on screen, only the vellum should cross-fade —
    // rebuilding the <img> would restart its fade-in and make it flash.
    function renderFrame(frame) {
      if (frame.kind === "text") {
        currentImageSrc = null;
        figureEl = null;
        vellumEl = null;
        stage.replaceChildren();
        const card = document.createElement("p");
        card.className = "viewer__title-card";
        card.textContent = frame.lines.join(" ");
        stage.appendChild(card);
        return;
      }

      if (figureEl && frame.image === currentImageSrc) {
        if (frame.kind === "overlay" && vellumEl) {
          vellumEl.classList.add("is-visible");
        } else if (frame.kind === "plain" && vellumEl) {
          vellumEl.classList.remove("is-visible");
        }
        return;
      }

      stage.replaceChildren();
      currentImageSrc = frame.image;
      figureEl = document.createElement("figure");
      figureEl.className = "viewer__frame";

      const img = document.createElement("img");
      img.className = "viewer__image";
      img.src = frame.image;
      img.alt = "";
      if (frame.width && frame.height) {
        img.width = frame.width;
        img.height = frame.height;
      }
      figureEl.appendChild(img);

      vellumEl = null;
      if (frame.kind === "overlay") {
        vellumEl = document.createElement("div");
        vellumEl.className = "viewer__vellum";
        for (const line of frame.lines) {
          const p = document.createElement("p");
          p.textContent = line;
          vellumEl.appendChild(p);
        }
        figureEl.appendChild(vellumEl);
        requestAnimationFrame(() => vellumEl.classList.add("is-visible"));
      }

      stage.appendChild(figureEl);
    }

    let justSwiped = false;
    let touchStartX = null;

    stage.addEventListener("click", () => {
      if (justSwiped) {
        justSwiped = false;
        return;
      }
      advance(1);
    });

    stage.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.changedTouches[0].clientX;
      },
      { passive: true }
    );

    stage.addEventListener(
      "touchend",
      (e) => {
        if (touchStartX === null) return;
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(deltaX) > 40) {
          justSwiped = true;
          advance(deltaX < 0 ? 1 : -1);
        }
      },
      { passive: true }
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === " ") advance(1);
      if (e.key === "ArrowLeft") advance(-1);
    });

    const prevButton = document.getElementById("viewer-prev");
    const nextButton = document.getElementById("viewer-next");
    prevButton.addEventListener("click", (e) => {
      e.stopPropagation();
      advance(-1);
    });
    nextButton.addEventListener("click", (e) => {
      e.stopPropagation();
      advance(1);
    });
  }

  // Expands each JSON step into the sequence of click-states the reader
  // actually walks through: a "pair" step is the vellum-over-photo view,
  // then the same photo alone once the leaf is "turned".
  function buildFrames(steps) {
    const frames = [];
    for (const step of steps) {
      if (step.type === "text") {
        frames.push({ kind: "text", lines: step.lines });
      } else if (step.type === "pair") {
        frames.push({
          kind: "overlay",
          lines: step.lines,
          image: step.image,
          width: step.width,
          height: step.height,
        });
        frames.push({
          kind: "plain",
          image: step.image,
          width: step.width,
          height: step.height,
        });
      } else if (step.type === "image") {
        frames.push({
          kind: "plain",
          image: step.image,
          width: step.width,
          height: step.height,
        });
      }
    }
    return frames;
  }
})();
