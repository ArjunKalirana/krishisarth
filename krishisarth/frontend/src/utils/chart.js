/**
 * KrishiSarth Charting Utility
 * Zero-dependency SVG and CSS-based visualizations.
 */

/**
 * Draws a multi-line SVG chart
 * @param {Object} options { width, height, padding, datasets: [{ color, data: [] }], labels: [] }
 */
export function drawLineChart(options) {
    const { width = 600, height = 300, padding = 40, datasets, labels } = options;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const maxVal = 100; // Moisture % scale
    const getY = (v) => padding + chartH - (v / maxVal) * chartH;
    const getX = (i) => padding + (i / (labels.length - 1)) * chartW;

    let svgContent = `
        <svg viewBox="0 0 ${width} ${height}" class="w-full h-full font-mono">
            <!-- Grid Lines -->
            ${[20, 40, 60, 80].map(v => `
                <line x1="${padding}" y1="${getY(v)}" x2="${width - padding}" y2="${getY(v)}" stroke="#f3f4f6" stroke-width="1" />
                <text x="${padding - 10}" y="${getY(v) + 4}" text-anchor="end" fill="#9ca3af" style="font-size: 10px; font-weight: bold;">${v}%</text>
            `).join('')}

            <!-- X Axis Labels -->
            ${labels.map((l, i) => `
                <text x="${getX(i)}" y="${height - padding + 20}" text-anchor="middle" fill="#9ca3af" style="font-size: 10px; font-weight: bold;">${l}</text>
            `).join('')}

            <!-- Data Lines -->
            ${datasets.map(ds => {
                const points = ds.data.map((v, i) => `${getX(i)},${getY(v)}`).join(' ');
                return `<polyline fill="none" stroke="${ds.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}" class="transition-all duration-700 hover:stroke-width-4" />`;
            }).join('')}
        </svg>
    `;

    return svgContent;
}

/**
 * Draws a CSS-based bar chart
 * @param {Array} data [{ label, value, highlight }]
 */
export function drawBarChart(data = []) {
    if (!data || data.length === 0) return '<p style="color:#9ca3af;font-size:12px;">No data</p>';

    const max     = Math.max(...data.map(d => d.value || 0), 1);
    const barW    = Math.floor(100 / data.length);

    return `
        <div style="display:flex; align-items:flex-end; gap:4px; height:180px; 
                    padding:0 8px; position:relative;">
            <!-- Y-axis grid lines -->
            ${[25,50,75,100].map(pct => `
                <div style="position:absolute; left:8px; right:8px;
                            bottom:${pct * 1.5 + 24}px;
                            border-top:1px dashed #e5e7eb; z-index:0;"></div>
            `).join('')}
            ${data.map((d, i) => {
                const heightPct = max > 0 ? ((d.value || 0) / max) * 100 : 0;
                const heightPx  = Math.max(heightPct * 1.5, d.value > 0 ? 4 : 0);
                const isToday   = i === data.length - 1;
                return `
                    <div style="flex:1; display:flex; flex-direction:column;
                                align-items:center; justify-content:flex-end;
                                height:100%; position:relative; z-index:1;">
                        ${d.value > 0 ? `
                            <span style="font-size:10px; font-weight:700; color:#6b7280;
                                         margin-bottom:3px;">${d.value}L</span>
                        ` : ''}
                        <div style="
                            width:75%;
                            height:${heightPx}px;
                            background:${isToday ? '#1a7a4a' : 'rgba(26,122,74,0.4)'};
                            border-radius:6px 6px 0 0;
                            min-height:${d.value > 0 ? '4' : '0'}px;
                            transition: height 0.3s ease;
                        "></div>
                        <span style="font-size:10px; font-weight:600; color:#9ca3af;
                                     margin-top:4px; text-transform:uppercase;">
                            ${d.label || ''}
                        </span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
