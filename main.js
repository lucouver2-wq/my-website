"use strict"

const $ = (selector, root = document) => root.querySelector(selector)
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector))
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

function mulberry32(seed) {
  return function random() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function gaussFactory(rng) {
  return function gauss() {
    return Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng())
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function setupCurtain(root) {
  const [base, top] = $$("canvas", root)
  const scrub = $(".scrub", root)
  const divider = $(".divider", root)

  function setPosition(value) {
    top.style.clipPath = `inset(0 0 0 ${value}%)`
    divider.style.left = `calc(${value}% - 1px)`
  }

  scrub.addEventListener("input", () => setPosition(Number(scrub.value)))
  setPosition(Number(scrub.value))
  return { base, top, setPosition }
}

;(function heroStars() {
  const canvas = $("#stars")
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  const rng = mulberry32(7)
  let stars = []
  let width = 0
  let height = 0

  function resize() {
    width = canvas.width = canvas.offsetWidth
    height = canvas.height = canvas.offsetHeight
    stars = []
    const count = Math.floor((width * height) / 6500)
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: rng() * width,
        y: rng() * height,
        r: 0.4 + rng() * 1.3,
        phase: rng() * Math.PI * 2,
        speed: 0.3 + rng() * 1.2,
        brightness: 0.25 + rng() * 0.75,
      })
    }
  }

  function draw(time) {
    ctx.clearRect(0, 0, width, height)
    for (const star of stars) {
      ctx.globalAlpha = star.brightness * (0.55 + 0.45 * Math.sin(star.phase + time * 0.001 * star.speed))
      ctx.fillStyle = star.r > 1.3 ? "#cfe4ff" : "#ffffff"
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
  }

  resize()
  window.addEventListener("resize", resize)
  if (reducedMotion) {
    draw(0)
    return
  }
  requestAnimationFrame(function loop(time) {
    draw(time)
    requestAnimationFrame(loop)
  })
})()

;(function turbulencePlayground() {
  const phaseCanvas = $("#phase-canvas")
  const psfCanvas = $("#psf-canvas")
  if (!phaseCanvas || !psfCanvas) return

  const pctx = phaseCanvas.getContext("2d")
  const sctx = psfCanvas.getContext("2d")
  const r0 = $("#r0")
  const wind = $("#wind")
  const correction = $("#correction")
  const r0Value = $("#r0-value")
  const windValue = $("#wind-value")
  const seeing = $("#seeing-output")
  const rng = mulberry32(11)
  const modes = []
  let norm = 0

  for (let i = 0; i < 28; i += 1) {
    const k = 0.35 + rng() * 4.2
    const theta = rng() * Math.PI * 2
    const amp = Math.pow(k, -1.7)
    modes.push({ kx: k * Math.cos(theta), ky: k * Math.sin(theta), amp, phase: rng() * Math.PI * 2 })
    norm += amp
  }

  const width = phaseCanvas.width
  const height = phaseCanvas.height
  const image = pctx.createImageData(width, height)

  function render(time) {
    const r0ValueNumber = Number(r0.value)
    const windValueNumber = Number(wind.value)
    const scale = Math.pow(10 / r0ValueNumber, 5 / 6) * (correction.checked ? 0.12 : 1)
    const data = image.data

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let value = 0
        const u = x / width
        const v = y / height
        for (const mode of modes) {
          value += mode.amp * Math.sin(Math.PI * 2 * (mode.kx * u + mode.ky * v) + mode.phase + time * 0.0014 * windValueNumber * mode.kx)
        }
        value = clamp((value / norm) * 2.4 * scale, -1, 1)
        const index = (y * width + x) * 4
        if (value >= 0) {
          data[index] = 13 + value * 228
          data[index + 1] = 19 + value * 130
          data[index + 2] = 34 + value * 30
        } else {
          const a = -value
          data[index] = 13 + a * 30
          data[index + 1] = 19 + a * 100
          data[index + 2] = 34 + a * 190
        }
        data[index + 3] = 255
      }
    }

    pctx.putImageData(image, 0, 0)
    sctx.fillStyle = "#000"
    sctx.fillRect(0, 0, psfCanvas.width, psfCanvas.height)
    const sigma = correction.checked ? 6 : Math.max(9, 34 * (10 / r0ValueNumber))
    const cx = psfCanvas.width / 2
    const cy = psfCanvas.height / 2
    const gradient = sctx.createRadialGradient(cx, cy, 0, cx, cy, sigma)
    gradient.addColorStop(0, "rgba(255,255,255,1)")
    gradient.addColorStop(0.35, "rgba(190,225,255,.55)")
    gradient.addColorStop(1, "rgba(120,180,255,0)")
    sctx.fillStyle = gradient
    sctx.beginPath()
    sctx.arc(cx, cy, sigma, 0, Math.PI * 2)
    sctx.fill()

    r0Value.textContent = `${r0ValueNumber} cm`
    windValue.textContent = `${windValueNumber} m/s`
    seeing.textContent = correction.checked
      ? "Corrected PSF ~= diffraction-limited (illustrative)"
      : `Seeing FWHM ~= ${(10.1 / r0ValueNumber).toFixed(2)} arcsec at 500 nm`
  }

  ;[r0, wind, correction].forEach((control) => control.addEventListener("input", () => render(0)))
  if (reducedMotion) {
    render(0)
    return
  }
  requestAnimationFrame(function loop(time) {
    render(time)
    requestAnimationFrame(loop)
  })
})()

;(function aberrationCurtain() {
  const root = $("#aberration-compare")
  if (!root) return
  const curtain = setupCurtain(root)
  const rng = mulberry32(23)
  const stars = []
  for (let i = 0; i < 120; i += 1) {
    stars.push({ x: rng() * 420, y: rng() * 420, b: 0.3 + rng() * 0.7 })
  }

  function drawStar(ctx, x, y, radius, alpha) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
    gradient.addColorStop(0, `rgba(255,255,255,${alpha})`)
    gradient.addColorStop(0.4, `rgba(210,230,255,${alpha * 0.5})`)
    gradient.addColorStop(1, "rgba(150,190,255,0)")
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
  }

  const corrected = curtain.top.getContext("2d")
  corrected.fillStyle = "#05070d"
  corrected.fillRect(0, 0, 420, 420)
  stars.forEach((star) => drawStar(corrected, star.x, star.y, 2 + star.b * 2.4, 0.05 + 0.95 * star.b))

  const raw = curtain.base.getContext("2d")
  raw.fillStyle = "#05070d"
  raw.fillRect(0, 0, 420, 420)
  stars.forEach((star) => {
    const dx = star.x - 210
    const dy = star.y - 210
    const distance = Math.sqrt(dx * dx + dy * dy)
    const normalized = distance / 297
    const blur = 2.2 + 8 * normalized * normalized
    const ux = distance > 0 ? dx / distance : 0
    const uy = distance > 0 ? dy / distance : 0
    for (let j = 0; j < 4; j += 1) {
      const offset = j * blur * 0.55
      drawStar(raw, star.x + ux * offset, star.y + uy * offset, blur * (1 + j * 0.18), (0.05 + star.b * 0.55) / (1 + j * 0.8))
    }
  })
})()

;(function refocusDemo() {
  const canvas = $("#focus-canvas")
  if (!canvas) return
  const ctx = canvas.getContext("2d")
  const focus = $("#focus")
  const focusValue = $("#focus-value")
  const planes = [
    { depth: 0.12, color: "190,225,255" },
    { depth: 0.5, color: "255,224,186" },
    { depth: 0.88, color: "216,198,255" },
  ].map((plane, index) => {
    const rng = mulberry32(31 + index)
    plane.points = []
    for (let j = 0; j < 16; j += 1) {
      plane.points.push({ x: 16 + rng() * 528, y: 24 + rng() * 192, r: 3 + rng() * 9, a: 0.3 + rng() * 0.55 })
    }
    return plane
  })

  function draw(value) {
    ctx.filter = "none"
    ctx.fillStyle = "#05070d"
    ctx.fillRect(0, 0, 560, 260)
    for (const plane of planes) {
      const blur = Math.abs(value - plane.depth) * 22
      ctx.filter = blur > 0.4 ? `blur(${blur.toFixed(1)}px)` : "none"
      for (const point of plane.points) {
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, point.r)
        gradient.addColorStop(0, `rgba(${plane.color},${point.a})`)
        gradient.addColorStop(1, `rgba(${plane.color},0)`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(point.x, point.y, point.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.filter = "none"
  }

  function update() {
    const value = Number(focus.value) / 100
    draw(value)
    focusValue.textContent = value < 0.33 ? "near" : value < 0.67 ? "mid" : "far"
  }

  focus.addEventListener("input", update)
  update()
})()

;(function asterisExplorer() {
  const telescope = $("#telescope")
  const exposures = $("#exposures")
  const noise = $("#noise")
  const targetMag = $("#target-mag")
  if (!telescope || !exposures || !noise || !targetMag) return

  let method = "coadd"
  const deepField = $("#deep-field")

  function update() {
    const telescopeInfo = {
      jwst: { boost: 0.45, note: "space" },
      subaru: { boost: -0.2, note: "ground" },
      custom: { boost: 0.1, note: "custom" },
    }[telescope.value]
    const exposureCount = Number(exposures.value)
    const noiseLevel = Number(noise.value)
    const magnitude = Number(targetMag.value)
    const methodBoost = method === "asteris" ? 1.05 : 0
    const depth = 29.45 + Math.log2(exposureCount) * 0.38 + telescopeInfo.boost - noiseLevel * 0.006 + methodBoost
    const delta = depth - magnitude
    const completeness = clamp(Math.round(50 + delta * 24 + (method === "asteris" ? 12 : 0)), 8, 98)
    const purity = clamp(Math.round(58 + delta * 18 + (method === "asteris" ? 16 : -4)), 10, 99)
    const baseSnr = clamp(5 + delta * 1.9 + (method === "asteris" ? 1.2 : 0), 1.2, 12.8)

    $("#telescope-note").textContent = telescopeInfo.note
    $("#exposures-value").textContent = String(exposureCount)
    $("#noise-value").textContent = `${noiseLevel}%`
    $("#target-mag-value").textContent = magnitude.toFixed(1)
    $("#limit").textContent = depth.toFixed(1)
    $("#complete").textContent = `${completeness}%`
    $("#purity").textContent = `${purity}%`
    $("#method-readout").textContent =
      method === "asteris"
        ? "ASTERIS learns spatiotemporal noise and recovers fainter candidates."
        : "Co-addition averages exposures but leaves correlated background structure."

    deepField.style.setProperty("--noise-opacity", String(clamp(noiseLevel / 100, 0.12, 0.8)))
    deepField.style.setProperty("--signal-opacity", String(clamp((depth - 28.7) / 3.6, 0.22, 0.86)))
    deepField.style.setProperty("--blur-size", method === "asteris" ? "0.7px" : "2.2px")

    const snrs = [baseSnr + 0.5, baseSnr - 0.4, baseSnr + 0.9].map((snr) => clamp(snr, 1.1, 13.4))
    ;["a", "b", "c"].forEach((id, index) => {
      $(`#snr-${id}`).textContent = snrs[index].toFixed(1)
      $(`#status-${id}`).textContent = snrs[index] >= 5 ? "Recovered" : snrs[index] >= 3 ? "Marginal" : "Hidden"
    })
    updateLimitChart(depth)
  }

  $$("#method-tabs button").forEach((button) => {
    button.addEventListener("click", () => {
      method = button.dataset.method
      $$("#method-tabs button").forEach((item) => item.classList.toggle("on", item === button))
      update()
    })
  })

  ;[telescope, exposures, noise, targetMag].forEach((control) => {
    control.addEventListener("input", update)
    control.addEventListener("change", update)
  })

  window.updateAsteris = update
  update()
})()

;(function limitCardFilter() {
  const limitCards = $$(".limit-card")
  const workCards = $$(".work-card")
  if (!limitCards.length || !workCards.length) return
  let active = null

  function reset() {
    active = null
    limitCards.forEach((card) => card.classList.remove("selected"))
    workCards.forEach((card) => card.classList.remove("dim", "glow"))
  }

  function select(limit) {
    if (active === limit) {
      reset()
      return
    }
    active = limit
    limitCards.forEach((card) => card.classList.toggle("selected", card.dataset.limit === limit))
    workCards.forEach((card) => {
      const tags = (card.dataset.limits || "").split(" ")
      const match = limit === "all" || tags.includes(limit) || tags.includes("all")
      card.classList.toggle("glow", match)
      card.classList.toggle("dim", !match)
    })
  }

  limitCards.forEach((card) => {
    card.addEventListener("click", (event) => {
      if (card.dataset.limit !== "all") event.preventDefault()
      select(card.dataset.limit)
    })
  })
})()

;(function missionNavigator() {
  const nodes = $$(".orbit-node")
  if (!nodes.length) return
  nodes.forEach((node) => {
    node.addEventListener("click", () => {
      nodes.forEach((item) => item.classList.toggle("on", item === node))
      const target = $(node.dataset.jump)
      target?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" })
    })
  })
})()

;(function evidenceWall() {
  const tabs = $$("#evidence-tabs button")
  const cards = $$(".evidence-card")
  const lightbox = $("#figure-lightbox")
  if (!tabs.length || !cards.length) return

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const filter = tab.dataset.filter
      tabs.forEach((item) => item.classList.toggle("on", item === tab))
      cards.forEach((card) => {
        const show = filter === "all" || card.dataset.kind === filter
        card.classList.toggle("hide", !show)
      })
    })
  })

  if (!lightbox) return
  const image = $("img", lightbox)
  const caption = $("p", lightbox)
  const close = $(".lightbox-close", lightbox)

  $$(".evidence-card button").forEach((button) => {
    button.addEventListener("click", () => {
      image.src = button.dataset.img
      image.alt = button.dataset.title || "Paper figure"
      caption.textContent = button.dataset.title || "Paper figure"
      if (typeof lightbox.showModal === "function") lightbox.showModal()
    })
  })

  close?.addEventListener("click", () => lightbox.close())
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) lightbox.close()
  })
})()

;(function quickstartPlanner() {
  const instrument = $("#instrument-config")
  const pixelScale = $("#pixel-scale")
  const model = $("#model-output")
  const command = $("#command-output")
  const cfgExposures = $("#cfg-exposures")
  const checklist = $("#cfg-checklist")
  const exposures = $("#exposures")
  if (!instrument || !pixelScale || !model || !command || !cfgExposures || !checklist) return

  function listItem(text, warn = false) {
    return `<li${warn ? ' class="warn"' : ""}>${text}</li>`
  }

  function update() {
    const exposureCount = Number(cfgExposures.value || exposures?.value || 8)
    const frames = exposureCount >= 8 ? 8 : 4
    const scale = pixelScale.value.trim() || "0.04"
    const modelName =
      instrument.value === "custom"
        ? "custom_model"
        : `ASTERIS${frames}_${instrument.value === "nrclong" ? "nrclong" : "nrcshort"}`
    model.textContent = modelName
    const odd = exposureCount % 2 !== 0
    const tooFew = exposureCount < 4
    const wrongScale = scale !== "0.04"
    checklist.innerHTML =
      instrument.value === "custom"
        ? [
            listItem("Pretrained weights are instrument-specific; train a custom model.", true),
            listItem("Astrometrically align all FITS exposures to a common WCS."),
            listItem(`Use an even number of same-pointing exposures: ${odd ? "currently odd" : "ready"}.`, odd),
          ].join("")
        : [
            listItem("FITS exposures aligned to a common WCS."),
            listItem(`At least ${frames} same-pointing exposures: you entered ${exposureCount}.`, exposureCount < frames || tooFew),
            listItem(`Even exposure count: ${odd ? "adjust grouping or drop one frame" : "ready"}.`, odd),
            listItem(`Pixel scale 0.04 arcsec/pixel for pretrained weights: ${wrongScale ? `you set ${scale}` : "ready"}.`, wrongScale),
            listItem(`Selected ${instrument.value === "nrclong" ? "long wavelength" : "short wavelength"} NIRCam model.`),
          ].join("")
    command.textContent =
      instrument.value === "custom"
        ? [
            "# Train a custom ASTERIS model for a new instrument",
            "python ASTERIS_make_train_dataset.py --input ./aligned_exposures",
            "python ASTERIS_train.py --config configs/custom.yaml",
            "python ASTERIS_test.py --model custom_model --input ./aligned_exposures",
          ].join("\n")
        : [
            "# Denoise an aligned multi-exposure stack",
            `python ASTERIS_test.py --model ${modelName} \\`,
            "  --input ./aligned_exposures \\",
            `  --pixel_scale ${scale} \\`,
            "  --output ./asteris_denoised",
          ].join("\n")
  }

  ;[instrument, pixelScale, cfgExposures, exposures].forEach((control) => {
    control?.addEventListener("input", update)
    control?.addEventListener("change", update)
  })
  update()
})()

;(function beforeAfterGallery() {
  function placeholder(label, kind) {
    const after = kind === "after"
    const bg0 = after ? "#0a1522" : "#090d15"
    const bg1 = after ? "#12253c" : "#151b2a"
    const accent = after ? "#f4c15d" : "#8b98ad"
    let dots = ""
    const rng = mulberry32(after ? label.length * 37 : label.length * 19)
    const count = after ? 76 : 56
    for (let i = 0; i < count; i += 1) {
      const x = Math.round(rng() * 300)
      const y = Math.round(rng() * 225)
      const r = (rng() * (after ? 1.8 : 1.1) + 0.25).toFixed(1)
      const opacity = (rng() * (after ? 0.85 : 0.42) + 0.1).toFixed(2)
      dots += `<circle cx="${x}" cy="${y}" r="${r}" fill="#e3ecff" opacity="${opacity}"/>`
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="225" viewBox="0 0 300 225">
      <defs><radialGradient id="g" cx="48%" cy="42%" r="78%"><stop offset="0%" stop-color="${bg1}"/><stop offset="100%" stop-color="${bg0}"/></radialGradient></defs>
      <rect width="300" height="225" fill="url(#g)"/>${dots}
      <text x="150" y="116" fill="${accent}" font-family="monospace" font-size="13" font-weight="700" text-anchor="middle">${label}</text>
      <text x="150" y="136" fill="#5f6d8c" font-family="monospace" font-size="8.5" text-anchor="middle">placeholder - click tag or drop image</text>
    </svg>`
    return `data:image/svg+xml,${encodeURIComponent(svg)}`
  }

  $$(".ba").forEach((figure) => {
    const before = $(".ba-before", figure)
    const after = $(".ba-after", figure)
    const divider = $(".ba-div", figure)
    const range = $(".ba-range", figure)
    before.src = placeholder(before.dataset.label || "before", "before")
    after.src = placeholder(after.dataset.label || "after", "after")

    function setPosition(value) {
      const position = clamp(Number(value), 0, 100)
      before.style.clipPath = `inset(0 ${100 - position}% 0 0)`
      divider.style.left = `${position}%`
      range.value = position
    }

    function pickImage(target) {
      const input = document.createElement("input")
      input.type = "file"
      input.accept = "image/*"
      input.addEventListener("change", () => {
        const file = input.files?.[0]
        if (file) target.src = URL.createObjectURL(file)
      })
      input.click()
    }

    range.addEventListener("input", () => setPosition(range.value))
    $$(".ba-tag", figure).forEach((tag) => {
      tag.addEventListener("click", (event) => {
        event.preventDefault()
        pickImage(tag.dataset.kind === "after" ? after : before)
      })
    })
    $(".ba-frame", figure).addEventListener("dragover", (event) => event.preventDefault())
    $(".ba-frame", figure).addEventListener("drop", (event) => {
      event.preventDefault()
      const file = event.dataTransfer?.files?.[0]
      if (!file || !file.type.startsWith("image/")) return
      const rect = event.currentTarget.getBoundingClientRect()
      const leftSide = event.clientX - rect.left < rect.width / 2
      ;(leftSide ? before : after).src = URL.createObjectURL(file)
    })
    setPosition(50)
  })
})()

;(function copyButtons() {
  $$(".copy").forEach((button) => {
    button.addEventListener("click", async () => {
      const target = $(`#${button.dataset.copy}`)
      if (!target) return
      const text = target.innerText
      const original = button.textContent
      try {
        await navigator.clipboard?.writeText(text)
      } catch {
        const textarea = document.createElement("textarea")
        textarea.value = text
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand("copy")
        textarea.remove()
      }
      button.textContent = "Copied"
      setTimeout(() => {
        button.textContent = original
      }, 1400)
    })
  })
})()

function updateLimitChart(currentDepth = 31.2) {
  const host = $("#limit-chart")
  if (!host) return
  const width = 560
  const height = 310
  const left = 48
  const right = 14
  const top = 16
  const bottom = 40
  const minMag = 27
  const maxMag = 32
  const x = (mag) => left + ((mag - minMag) / (maxMag - minMag)) * (width - left - right)
  const y = (value) => top + (1 - value) * (height - top - bottom)
  const logistic = (mag, center, slope) => 1 / (1 + Math.exp((mag - center) / slope))
  const linePath = (center) => {
    let path = ""
    for (let mag = minMag; mag <= maxMag + 1e-9; mag += 0.08) {
      path += `${path ? "L" : "M"}${x(mag).toFixed(1)} ${y(logistic(mag, center, 0.32)).toFixed(1)}`
    }
    return path
  }

  const rawCenter = currentDepth - 1.05
  const astCenter = currentDepth
  let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="ui-monospace,Menlo,monospace" font-size="11">`
  for (let mag = 27; mag <= 32; mag += 1) {
    svg += `<line x1="${x(mag)}" y1="${top}" x2="${x(mag)}" y2="${y(0)}" stroke="#1c2438"/>`
    svg += `<text x="${x(mag)}" y="${height - bottom + 18}" fill="#8b98ad" text-anchor="middle">${mag}</text>`
  }
  ;[0, 0.25, 0.5, 0.75, 1].forEach((value) => {
    svg += `<line x1="${left}" y1="${y(value)}" x2="${width - right}" y2="${y(value)}" stroke="#1c2438"/>`
    svg += `<text x="${left - 8}" y="${y(value) + 4}" fill="#8b98ad" text-anchor="end">${Math.round(value * 100)}%</text>`
  })
  svg += `<line x1="${left}" y1="${y(0.9)}" x2="${width - right}" y2="${y(0.9)}" stroke="#3a4a6b" stroke-dasharray="3 4"/>`
  svg += `<path d="${linePath(rawCenter)}" fill="none" stroke="#8b98ad" stroke-width="2.2"/>`
  svg += `<path d="${linePath(astCenter)}" fill="none" stroke="#5ac8fa" stroke-width="2.2"/>`
  svg += `<line id="science-line" x1="${x(Number($("#mag-threshold")?.value || 30))}" y1="${top}" x2="${x(Number($("#mag-threshold")?.value || 30))}" y2="${y(0)}" stroke="#ffffff" stroke-opacity=".6"/>`
  svg += `<text x="${(left + width - right) / 2}" y="${height - 4}" fill="#8b98ad" text-anchor="middle">source magnitude (AB)</text>`
  svg += `<text x="${width - 110}" y="${top + 18}" fill="#5ac8fa">ASTERIS</text><text x="${width - 110}" y="${top + 36}" fill="#8b98ad">co-addition</text>`
  svg += `</svg>`
  host.innerHTML = svg
  updateThresholdReadout(rawCenter, astCenter)
}

function updateThresholdReadout(rawCenter, astCenter) {
  const threshold = $("#mag-threshold")
  const output = $("#mag-threshold-value")
  const readout = $("#threshold-readout")
  if (!threshold || !output || !readout) return
  const mag = Number(threshold.value)
  const logistic = (center) => 1 / (1 + Math.exp((mag - center) / 0.32))
  output.textContent = mag.toFixed(1)
  readout.textContent = `At m = ${mag.toFixed(1)}: completeness ${Math.round(logistic(rawCenter) * 100)}% (co-addition) -> ${Math.round(logistic(astCenter) * 100)}% (ASTERIS).`
}

$("#mag-threshold")?.addEventListener("input", () => window.updateAsteris?.())

;(function roadmapTabs() {
  const buttons = $("#roadmap-buttons")
  const card = $("#roadmap-card")
  if (!buttons || !card) return
  const items = [
    {
      title: "Optical co-design",
      era: "Instrument layer",
      copy: "Future observatories should treat optics, sensors, and reconstruction algorithms as a coupled design space, not a serial pipeline.",
    },
    {
      title: "Wavefront and aberration sensing",
      era: "Measurement layer",
      copy: "The first two works show how atmosphere and instrument imperfections can become measurable signals for correction.",
    },
    {
      title: "Learning-based reconstruction",
      era: "Algorithm layer",
      copy: "ASTERIS shows how multi-exposure data can train itself, suppress correlated noise, and reveal faint astronomical targets.",
    },
    {
      title: "Scientist-facing workflows",
      era: "Application layer",
      copy: "Interactive tools should expose assumptions, parameters, detection confidence, and candidate triage to working astronomers.",
    },
  ]

  function show(index) {
    const item = items[index]
    card.innerHTML = `<div class="era">${item.era}</div><h3>${item.title}</h3><p>${item.copy}</p>`
    $$("button", buttons).forEach((button, i) => button.classList.toggle("on", i === index))
  }

  items.forEach((item, index) => {
    const button = document.createElement("button")
    button.type = "button"
    button.textContent = item.title
    button.addEventListener("click", () => show(index))
    buttons.appendChild(button)
  })
  show(0)
})()

;(function revealAndNav() {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("visible")
      })
    },
    { threshold: 0.08 },
  )
  $$(".reveal").forEach((item) => revealObserver.observe(item))

  const navMap = {}
  $$(".navlinks a").forEach((link) => {
    navMap[link.getAttribute("href").slice(1)] = link
  })
  const navObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          $$(".navlinks a").forEach((link) => link.classList.remove("active"))
          navMap[entry.target.id]?.classList.add("active")
        }
      })
    },
    { rootMargin: "-40% 0px -55% 0px" },
  )
  $$("section[id]").forEach((section) => navObserver.observe(section))
})()
