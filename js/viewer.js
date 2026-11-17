(function () {
  const stage = document.getElementById("viewer");
  const status = document.getElementById("viewer-status");

  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");
  const startIndex = parseInt(params.get("i"), 10) || 0;

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
    document.title = (series.title || slug) + " — Tony Eremin";
    document.documentElement.lang = series.lang || "en";

    // Where × and "past the last frame" lead — the title page by default,
    // or e.g. the portraits grid for series opened from there.
    const backHref = series.back || "index.html";
    document.querySelector(".viewer__close").href = backHref;

    if (series.presentation === "book") {
      document.body.classList.add("viewer-page--book");
    }

    const frames = buildFrames(series.steps || []);

    // A series opens on its statement page (title, place/year label,
    // statement text) unless it sets "intro": false (portraits). A deep
    // link with ?i=N always means "photo N", so it skips past the statement.
    const hasIntro = series.intro !== false;
    if (hasIntro) frames.unshift({ kind: "statement" });

    status.remove();

    const hasDeepLink = params.has("i");
    let index = hasDeepLink ? Math.min(Math.max(startIndex, 0) + (hasIntro ? 1 : 0), frames.length - 1) : 0;
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
        window.location.href = backHref;
        return;
      }
      index = next;
      renderFrame(frames[index]);
    }

    // A "pair" step is two frames sharing one photo (overlay, then plain).
    // If the photo is already on screen, only the vellum should cross-fade —
    // rebuilding the <img> would restart its fade-in and make it flash.
    function renderFrame(frame) {
      document.body.classList.toggle("is-statement", frame.kind === "statement");

      if (frame.kind === "statement") {
        currentImageSrc = null;
        figureEl = null;
        vellumEl = null;
        stage.replaceChildren(buildStatement(series, frames.length > 1));
        return;
      }

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
      img.alt = frame.caption || "";
      if (frame.width && frame.height) {
        img.width = frame.width;
        img.height = frame.height;
      }
      figureEl.appendChild(img);

      if (frame.caption) {
        const caption = document.createElement("figcaption");
        caption.className = "label viewer__caption";
        caption.textContent = frame.caption;
        figureEl.appendChild(caption);
      }

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

    stage.addEventListener("click", (e) => {
      if (justSwiped) {
        justSwiped = false;
        return;
      }
      // Clicking anywhere on the statement text would be an accidental page
      // turn (people select or tap to scroll text); only its button advances.
      if (frames[index].kind === "statement" && !e.target.closest(".statement__start, .statement__photo")) {
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

  function buildStatement(series, hasPhotos) {
    const article = document.createElement("article");
    article.className = "statement";

    // One photo beside the text: "cover" in the series JSON, or the first
    // photo of the series if none is set.
    const cover = findCover(series);
    if (cover) {
      const img = document.createElement("img");
      img.className = "statement__photo";
      img.src = cover.image;
      img.alt = "";
      if (cover.width && cover.height) {
        img.width = cover.width;
        img.height = cover.height;
      }
      article.appendChild(img);
    }

    const text = document.createElement("div");
    text.className = "statement__text";
    article.appendChild(text);

    const title = document.createElement("h1");
    title.className = "statement__title";
    title.textContent = series.title || "";
    text.appendChild(title);

    const meta = [series.place, series.year].filter(Boolean).join(", ");
    if (meta) {
      const label = document.createElement("p");
      label.className = "label";
      label.textContent = meta;
      text.appendChild(label);
    }

    const paragraphs = Array.isArray(series.statement) ? series.statement : [];
    if (paragraphs.length > 0) {
      const body = document.createElement("div");
      body.className = "statement__body";
      for (const text of paragraphs) {
        const p = document.createElement("p");
        p.textContent = text;
        body.appendChild(p);
      }
      text.appendChild(body);
    }

    if (hasPhotos) {
      const start = document.createElement("button");
      start.type = "button";
      start.className = "statement__start label";
      start.textContent = "View series →";
      text.appendChild(start);
    }

    return article;
  }

  function findCover(series) {
    const steps = series.steps || [];
    if (series.cover) {
      const match = steps.find((step) => step.image === series.cover);
      return match || { image: series.cover };
    }
    return steps.find((step) => step.image) || null;
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
          caption: step.caption,
        });
        frames.push({
          kind: "plain",
          image: step.image,
          width: step.width,
          height: step.height,
          caption: step.caption,
        });
      } else if (step.type === "image") {
        frames.push({
          kind: "plain",
          image: step.image,
          width: step.width,
          height: step.height,
          caption: step.caption,
        });
      }
    }
    return frames;
  }
})();
