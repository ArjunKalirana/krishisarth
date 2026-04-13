/**
 * KrishiSarth Charting Utility (Elite Edition)
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
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
            </defs>
            
            <!-- Grid Lines -->
            ${[20, 40, 60, 80].map(v => `
                <line x1="${padding}" y1="${getY(v)}" x2="${width - padding}" y2="${getY(v)}" stroke="rgba(255,255,255,0.03)" stroke-width="1" />
                <text x="${padding - 12}" y="${getY(v) + 4}" text-anchor="end" fill="#475569" style="font-size: 10px; font-weight: 900;">${v}%</text>
            `).join('')}

            <!-- X Axis Labels -->
            ${labels.map((l, i) => `
                <text x="${getX(i)}" y="${height - padding + 22}" text-anchor="middle" fill="#475569" style="font-size: 10px; font-weight: 900; text-transform:uppercase;">${l}</text>
            `).join('')}

            <!-- Data Lines -->
            ${datasets.map(ds => {
                const points = ds.data.map((v, i) => `${getX(i).toFixed(1)},${getY(v).toFixed(1)}`).join(' ');
                const color = ds.color === '#1a7a4a' ? '#10b981' : ds.color; // Map legacy green to Emerald
                return `
                    <polyline fill="none" stroke="${color}" stroke-opacity="0.1" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
                    <polyline fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}" style="filter: url(#glow);" opacity="0.9" />
                `;
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
    if (!data || data.length === 0) return '<p class="text-slate-600 font-black uppercase tracking-widest text-[10px]">Vault empty</p>';

    const max     = Math.max(...data.map(d => d.value || 0), 1);

    return `
        <div style="display:flex; align-items:flex-end; gap:8px; height:200px; 
                    padding:0 8px; position:relative;">
            <!-- Y-axis grid lines -->
            ${[25,50,75,100].map(pct => `
                <div style="position:absolute; left:0; right:0;
                            bottom:${pct * 1.6 + 28}px;
                            border-top:1px dashed rgba(255,255,255,0.03); z-index:0;"></div>
            `).join('')}
            ${data.map((d, i) => {
                const heightPct = max > 0 ? ((d.value || 0) / max) * 100 : 0;
                const heightPx  = Math.max(heightPct * 1.6, d.value > 0 ? 4 : 0);
                const isLatest   = i === data.length - 1;
                return `
                    <div style="flex:1; display:flex; flex-direction:column;
                                align-items:center; justify-content:flex-end;
                                height:100%; position:relative; z-index:1;" class="group">
                        ${d.value > 0 ? `
                            <span style="font-size:9px; font-weight:900; color:rgba(255,255,255,0.3);
                                         margin-bottom:6px; font-family:var(--font-mono);">${d.value}L</span>
                        ` : ''}
                        <div style="
                            width:100%;
                            height:${heightPx}px;
                            background:${isLatest ? '#10b981' : 'rgba(16,185,129,0.1)'};
                            border: 1px solid ${isLatest ? '#10b981' : 'rgba(16,185,129,0.2)'};
                            border-radius:8px 8px 4px 4px;
                            min-height:${d.value > 0 ? '4' : '0'}px;
                            transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                            box-shadow: ${isLatest ? '0 0 20px rgba(16,185,129,0.2)' : 'none'};
                        "></div>
                        <span style="font-size:9px; font-weight:900; color:#475569;
                                     margin-top:8px; text-transform:uppercase; letter-spacing: 0.1em; font-family:var(--font-display);">
                            ${d.label || ''}
                        </span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
