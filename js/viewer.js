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
    let currentFrameSize = null;
    let figureEl = null;
    let vellumEl = null;
    renderFrame(frames[index]);

    // The figure is a flex item centering itself in .viewer — a flex item's
    // content-based auto-sizing doesn't reliably honor CSS aspect-ratio
    // before its content (the photo) has actually loaded, so the box would
    // collapse to 0x0 (and the vellum text with it) until the photo arrives.
    // Computing the pixel size ourselves sidesteps that entirely.
    function sizeFigure(el, w, h) {
      // clientWidth/Height include padding, so subtract .viewer's own
      // padding to get the content box actually available to the flex
      // child — using the raw viewport size here previously let the
      // figure's computed size exceed what the flex container could give
      // it, so the flex-shrink algorithm quietly squeezed the box narrower
      // than intended.
      const stageStyle = getComputedStyle(stage);
      const availW = stage.clientWidth - parseFloat(stageStyle.paddingLeft) - parseFloat(stageStyle.paddingRight);
      const availH = stage.clientHeight - parseFloat(stageStyle.paddingTop) - parseFloat(stageStyle.paddingBottom);
      const maxW = availW * 0.92;
      const maxH = availH * 0.82;
      const scale = Math.min(maxW / w, maxH / h);
      el.style.width = Math.round(w * scale) + "px";
      el.style.height = Math.round(h * scale) + "px";
    }

    window.addEventListener("resize", () => {
      if (figureEl && currentFrameSize) {
        sizeFigure(figureEl, currentFrameSize.width, currentFrameSize.height);
      }
    });

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
      currentFrameSize = frame.width && frame.height ? { width: frame.width, height: frame.height } : null;
      figureEl = document.createElement("figure");
      figureEl.className = "viewer__frame";
      if (currentFrameSize) {
        sizeFigure(figureEl, currentFrameSize.width, currentFrameSize.height);
      }

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
