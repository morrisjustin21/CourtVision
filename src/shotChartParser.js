import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { findZone, CHART_WIDTH, CHART_HEIGHT } from './shotZones'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

// These offsets place each player's court-diagram origin relative to their
// name-line position, and were measured directly from a real Hudl "Shot
// Chart Report" PDF export.
const CHART_OFFSET_X = 0.2
const CHART_OFFSET_Y = 23.4
const CLUSTER_TOLERANCE = 10

function clusterValues(values, tolerance) {
  const sorted = [...new Set(values.map((v) => Math.round(v)))].sort((a, b) => a - b)
  const clusters = []
  for (const v of sorted) {
    if (clusters.length === 0 || v - clusters[clusters.length - 1] > tolerance) {
      clusters.push(v)
    }
  }
  return clusters
}

async function extractPageItems(page) {
  const viewport = page.getViewport({ scale: 1 })
  const textContent = await page.getTextContent()

  // This report is generated via a browser's print-to-PDF, which — unlike
  // the finer-grained text runs a PDF authoring tool would produce — often
  // bundles an entire line of text (e.g. "#33 Kadyn Armstrong") into a
  // single raw item. Split on whitespace and estimate each resulting
  // word's x-position from its character offset within the original
  // string, so a multi-word item still yields individually positioned,
  // matchable tokens instead of one unusable blob.
  const words = []
  for (const item of textContent.items) {
    if (!item.str || !item.str.trim()) continue
    const x0 = item.transform[4]
    const width = item.width || item.str.length * 5
    const top = viewport.height - item.transform[5] - (item.height || 9)
    const charWidth = item.str.length ? width / item.str.length : 0

    if (/\s/.test(item.str.trim())) {
      let charIndex = 0
      for (const part of item.str.split(/(\s+)/)) {
        if (part.trim()) {
          words.push({ text: part.trim(), x0: x0 + charIndex * charWidth, top })
        }
        charIndex += part.length
      }
    } else {
      words.push({ text: item.str.trim(), x0, top })
    }
  }

  return words
}

// Parses a Hudl "Shot Chart Report" PDF into per-player zone data.
// Returns: { players: [{ jersey, name, zones }], debug: {...} } — the debug
// object exists so a failed import can show exactly which stage produced
// nothing, instead of a single opaque "didn't work."
export async function parseShotChartPdf(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const results = []
  const debug = {
    pages: pdf.numPages,
    totalWords: 0,
    jerseyTokens: 0,
    namesFound: 0,
    pctWordsTotal: 0,
    fracWordsTotal: 0,
    zonesMatchedTotal: 0,
    sampleWords: [],
  }

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const items = await extractPageItems(page)
    debug.totalWords += items.length
    if (debug.sampleWords.length < 15) {
      debug.sampleWords.push(...items.slice(0, 15 - debug.sampleWords.length).map((w) => w.text))
    }

    const jerseyTokens = items.filter((w) => /^#\d+$/.test(w.text))
    debug.jerseyTokens += jerseyTokens.length
    const rowTops = clusterValues(jerseyTokens.map((w) => w.top), CLUSTER_TOLERANCE)
    const colX0s = clusterValues(jerseyTokens.map((w) => w.x0), CLUSTER_TOLERANCE)

    for (const rowTop of rowTops) {
      for (const colX of colX0s) {
        const headerWords = items
          .filter((w) => w.x0 >= colX - 2 && w.x0 < colX + 204 && w.top >= rowTop - 2 && w.top <= rowTop + 15)
          .sort((a, b) => a.x0 - b.x0)
        if (headerWords.length === 0) continue

        let jersey = null
        const nameParts = []
        for (const w of headerWords) {
          const m = /^#(\d+)$/.exec(w.text)
          if (m) jersey = parseInt(m[1], 10)
          else nameParts.push(w.text)
        }
        const name = nameParts.join(' ')
        if (!name) continue
        debug.namesFound += 1

        const chartX0 = colX + CHART_OFFSET_X
        const chartTop = rowTop + CHART_OFFSET_Y

        const pctWords = items.filter(
          (w) =>
            /^\d+%$/.test(w.text) &&
            w.x0 >= chartX0 - 5 &&
            w.x0 <= chartX0 + CHART_WIDTH + 5 &&
            w.top >= chartTop - 5 &&
            w.top <= chartTop + CHART_HEIGHT + 15
        )
        const fracWords = items.filter(
          (w) =>
            /^\d+\/\d+$/.test(w.text) &&
            w.x0 >= chartX0 - 5 &&
            w.x0 <= chartX0 + CHART_WIDTH + 5 &&
            w.top >= chartTop - 5 &&
            w.top <= chartTop + CHART_HEIGHT + 15
        )
        debug.pctWordsTotal += pctWords.length
        debug.fracWordsTotal += fracWords.length

        const zones = []
        const usedFracs = new Set()
        for (const p of pctWords) {
          let best = null
          let bestDy = Infinity
          fracWords.forEach((f, i) => {
            if (usedFracs.has(i)) return
            const dx = Math.abs(f.x0 - p.x0)
            const dy = f.top - p.top
            if (dx < 15 && dy > 5 && dy < 15 && dy < bestDy) {
              bestDy = dy
              best = i
            }
          })
          if (best !== null) {
            usedFracs.add(best)
            const [made, attempted] = fracWords[best].text.split('/').map((n) => parseInt(n, 10))
            const relX = p.x0 - chartX0
            const relY = p.top - chartTop
            const zone = findZone(relX, relY)
            if (zone) {
              zones.push({ zoneId: zone.id, type: zone.type, made, attempted })
            }
          }
        }
        debug.zonesMatchedTotal += zones.length

        if (zones.length > 0) {
          results.push({ jersey, name, zones })
        }
      }
    }
  }

  return { players: results, debug }
}
