/* ============================================================
   PitchCharts — shared chart kit for the pitch-data pages.

   Load BEFORE any page chart script:
     <script src=".../chart.umd.min.js"></script>
     <script src=".../pitch-charts.js"></script>
     <script src=".../<page>.js"></script>

   Pages differ in which row property names the pitch type
   ("pitch_type" on the outing report, "status" on the bullpen
   report), so every point helper takes that key as an argument
   rather than assuming one.
   ============================================================ */

window.PitchCharts = (function () {
    'use strict';

    var NEUTRAL = '#6B7280';

    // ── Palette ──────────────────────────────────────────────
    // Re-stepped for the light surface. Validated on all pairs:
    // lightness band, chroma floor and 3:1 contrast all pass for
    // the ten real pitch types. Two same-family pairs (Sinker /
    // Two Seamer, Changeup / Sweeper) sit inside the colour-vision
    // separation floor, which is why shape below is not optional —
    // colour alone does not identify a pitch on these charts.
    var COLORS = {
        'Four Seamer':   '#C92A2A',
        'Fastball':      '#C92A2A',
        'Two Seamer':    '#E8590C',
        'Sinker':        '#B07503',
        'Cutter':        '#C2407F',
        'Slider':        '#6E8A00',
        'Sweeper':       '#00897B',
        'Changeup':      '#1F7A3D',
        'Splitter':      '#0277BD',
        'Curveball':     '#3949AB',
        'Knuckle Curve': '#7B2D8E'
        // Knuckleball intentionally absent: with ten hues placed, no
        // eleventh clears the separation floors, so it folds to NEUTRAL.
    };

    var SHAPES = {
        'Four Seamer':   'circle',
        'Fastball':      'circle',
        'Two Seamer':    'rectRot',
        'Sinker':        'rect',
        'Cutter':        'rectRounded',
        'Slider':        'triangle',
        'Sweeper':       'star',
        'Changeup':      'cross',
        'Splitter':      'crossRot',
        'Curveball':     'circle',
        'Knuckle Curve': 'triangle'
    };

    var GLYPHS = {
        circle: '●', triangle: '▲', rect: '■', rectRot: '◆',
        rectRounded: '▣', star: '★', cross: '✚', crossRot: '✕'
    };

    function color(pitchType) { return COLORS[pitchType] || NEUTRAL; }
    function shape(pitchType) { return SHAPES[pitchType] || 'rect'; }
    function glyph(pitchType) { return GLYPHS[shape(pitchType)] || '■'; }

    // ── Scriptable point helpers ─────────────────────────────
    // Chart.js can call these before any data exists (an initial
    // render pass with an empty dataset), so guard the lookup.
    function pointColor(key) {
        return function (context) {
            var p = context.dataset.data[context.dataIndex];
            return p ? color(p[key]) : NEUTRAL;
        };
    }

    function pointShape(key) {
        return function (context) {
            var p = context.dataset.data[context.dataIndex];
            return p ? shape(p[key]) : 'rect';
        };
    }

    // One spread for every pitch-coloured scatter dataset.
    // borderColor matters: star/cross/crossRot are stroked rather
    // than filled, and without it they render in Chart.js's default
    // grey and disappear against a light surface.
    function scatterPointSpec(key, radius) {
        return {
            pointRadius: radius || 5,
            backgroundColor: pointColor(key),
            borderColor: pointColor(key),
            borderWidth: 2,
            pointStyle: pointShape(key)
        };
    }

    // ── Legend ───────────────────────────────────────────────
    // Identity is never colour-alone: each entry pairs the hue with
    // the same shape the plot uses.
    function renderLegend(hostId, rows, key) {
        var host = document.getElementById(hostId);
        if (!host) return;
        var seen = [];
        (rows || []).forEach(function (r) {
            var t = r && r[key];
            if (t && seen.indexOf(t) === -1) seen.push(t);
        });
        host.innerHTML = seen.map(function (t) {
            return '<span class="legend-item"><span class="legend-mark" style="color:' +
                color(t) + '">' + glyph(t) + '</span>' + t + '</span>';
        }).join('');
    }

    // ── General categorical series ───────────────────────────
    // For charts that are not pitch-coloured (training volume and the
    // like). Fixed order, never cycled. Validated on the light surface
    // for the adjacent pairlist that stacks and bars use: lightness,
    // chroma, CVD and normal-vision separation all pass at four slots.
    // Aqua and yellow fall under 3:1 contrast, so a chart using them
    // owes the reader visible labels or the numbers alongside.
    var CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];

    function series(i) { return CATEGORICAL[i % CATEGORICAL.length]; }

    // Stacked segments need a surface-coloured gap so adjacent fills
    // read as separate bands rather than one continuous block.
    function stackedBarSpec(i, surface) {
        return {
            backgroundColor: series(i),
            borderColor: surface || '#ffffff',
            borderWidth: 2,
            borderSkipped: false
        };
    }

    // ── Axes ─────────────────────────────────────────────────
    function zeroLineGrid(gridColor) {
        return {
            color: function (ctx) { return ctx.tick.value === 0 ? '#5a5f5a' : (gridColor || 'rgba(10,10,10,0.10)'); },
            lineWidth: function (ctx) { return ctx.tick.value === 0 ? 2 : 1; },
            borderDash: [4, 4]
        };
    }

    // ── Strike zone ──────────────────────────────────────────
    // Rulebook zone plus the thirds that split it, in feet.
    function strikeZoneAnnotations() {
        var rule = 'rgba(179, 36, 44, 0.55)';
        function line(o) {
            return Object.assign({ type: 'line', borderColor: rule, borderWidth: 1 }, o);
        }
        return {
            zone_box: {
                type: 'box',
                xMin: -0.71, xMax: 0.71, yMin: 1.5, yMax: 3.5,
                backgroundColor: 'rgba(179, 36, 44, 0.10)',
                borderColor: 'rgba(179, 36, 44, 0.85)',
                borderWidth: 1
            },
            hline1: line({ xMin: -0.71, xMax: 0.71, yMin: 2.16, yMax: 2.16 }),
            hline2: line({ xMin: -0.71, xMax: 0.71, yMin: 2.83, yMax: 2.83 }),
            vline1: line({ xMin: -0.24, xMax: -0.24, yMin: 1.5, yMax: 3.5 }),
            vline2: line({ xMin: 0.23, xMax: 0.23, yMin: 1.5, yMax: 3.5 })
        };
    }

    // ── Canvas decor ─────────────────────────────────────────
    // Draws a filled path from data-space [x, y] points, converted
    // to pixels through the chart's own scales.
    function drawDataPath(chart, points, fillStyle, strokeStyle) {
        var ctx = chart.ctx, x = chart.scales.x, y = chart.scales.y;
        var px = points.map(function (p) { return [x.getPixelForValue(p[0]), y.getPixelForValue(p[1])]; });
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(px[0][0], px[0][1]);
        px.slice(1).forEach(function (p) { ctx.lineTo(p[0], p[1]); });
        ctx.closePath();
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.5;
        ctx.fill();
        if (strokeStyle) ctx.stroke();
        ctx.restore();
    }

    var DECOR_FILL = 'rgba(90, 95, 90, 0.16)';
    var DECOR_LINE = 'rgba(90, 95, 90, 0.38)';

    // Simplified standing-hitter silhouette (legs/hips/waist/shoulders
    // plus a head circle), centred on cx in data-space feet. Scale
    // context only — not anatomically exact.
    function drawBatterSilhouette(chart, cx) {
        var ctx = chart.ctx, x = chart.scales.x, y = chart.scales.y;
        var body = [
            [cx - 0.22, 0], [cx - 0.18, 0.7], [cx - 0.25, 1.5], [cx - 0.22, 2.0], [cx - 0.3, 3.15], [cx - 0.12, 3.35],
            [cx + 0.12, 3.35], [cx + 0.3, 3.15], [cx + 0.22, 2.0], [cx + 0.25, 1.5], [cx + 0.18, 0.7], [cx + 0.22, 0]
        ];
        drawDataPath(chart, body, DECOR_FILL, DECOR_LINE);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x.getPixelForValue(cx), y.getPixelForValue(3.62),
                Math.abs(x.getPixelForValue(0.28) - x.getPixelForValue(0)), 0, Math.PI * 2);
        ctx.fillStyle = DECOR_FILL;
        ctx.strokeStyle = DECOR_LINE;
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    // Backdrop for a zone chart: the batter in the box on the correct
    // side of the plate for their handedness (drawn furthest back),
    // then home plate facing the pitcher's view.
    function zoneDecorPlugin(batterHand) {
        var side = batterHand === 'L' ? 1 : -1; // RHH stands to the pitcher's left
        return {
            id: 'zoneDecor',
            beforeDatasetsDraw: function (chart) {
                drawBatterSilhouette(chart, side * 1.45);
                drawDataPath(chart,
                    [[-0.71, 1.0], [0.71, 1.0], [0.71, 0.6], [0, 0.3], [-0.71, 0.6]],
                    'rgba(238, 240, 234, 1)', 'rgba(10, 10, 10, 0.85)');
            }
        };
    }

    // ── Chrome ───────────────────────────────────────────────
    function applyChartDefaults() {
        if (typeof Chart === 'undefined') return;
        Chart.defaults.font.family = "'IBM Plex Mono', ui-monospace, Menlo, monospace";
        Chart.defaults.font.size = 11;
        Chart.defaults.color = '#5a5f5a';
    }

    applyChartDefaults();

    return {
        NEUTRAL: NEUTRAL,
        color: color,
        shape: shape,
        glyph: glyph,
        pointColor: pointColor,
        pointShape: pointShape,
        scatterPointSpec: scatterPointSpec,
        renderLegend: renderLegend,
        CATEGORICAL: CATEGORICAL,
        series: series,
        stackedBarSpec: stackedBarSpec,
        zeroLineGrid: zeroLineGrid,
        strikeZoneAnnotations: strikeZoneAnnotations,
        drawDataPath: drawDataPath,
        drawBatterSilhouette: drawBatterSilhouette,
        zoneDecorPlugin: zoneDecorPlugin,
        applyChartDefaults: applyChartDefaults
    };
})();
