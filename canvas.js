/**
 * canvas.js
 * Generates engineering diagrams using scalable SVGs.
 */
class CanvasRenderer {
    
    static render(model, results) {
        document.getElementById('beam-container').innerHTML = this.drawBeam(model, results);
        document.getElementById('sfd-container').innerHTML = this.drawSFD(model, results);
        document.getElementById('bmd-container').innerHTML = this.drawBMD(model, results);
    }

    // --- Helper to create SVG strings ---
    static createSVG(content, viewBox="0 0 800 200") {
        return `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id="arrow-down" viewBox="0 0 10 10" refX="5" refY="10" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 5 10 L 10 0 Z" fill="var(--load-color)" />
                </marker>
                <marker id="arrow-up" viewBox="0 0 10 10" refX="5" refY="0" markerWidth="6" markerHeight="6" orient="auto">
                    <path d="M 0 10 L 5 0 L 10 10 Z" fill="var(--reaction-color)" />
                </marker>
            </defs>
            ${content}
        </svg>`;
    }

    // SVG Coordinate Mapping constants
    static padX = 80;
    static effW = 640;
    static mapX(x, L) { return this.padX + (x / L) * this.effW; }

    // --- 1. BEAM DIAGRAM ---
    static drawBeam(model, results) {
        const L = model.L;
        const cy = 100;
        let svg = '';

        // Dimension Line
        svg += `<line x1="${this.padX}" y1="160" x2="${this.padX + this.effW}" y2="160" stroke="#ccc" stroke-width="1" />`;
        svg += `<line x1="${this.padX}" y1="155" x2="${this.padX}" y2="165" stroke="#ccc" stroke-width="1" />`;
        svg += `<line x1="${this.padX + this.effW}" y1="155" x2="${this.padX + this.effW}" y2="165" stroke="#ccc" stroke-width="1" />`;
        svg += `<text x="${this.padX + this.effW/2}" y="164" fill="#666" font-size="12" text-anchor="middle" background="#fff">L = ${L} m</text>`;

        // Supports
        if (model.type === 'ssb') {
            // Pin Support Left
            svg += `<polygon points="${this.padX},${cy} ${this.padX-12},${cy+20} ${this.padX+12},${cy+20}" fill="none" stroke="#000" stroke-width="2"/>`;
            svg += `<line x1="${this.padX-18}" y1="${cy+20}" x2="${this.padX+18}" y2="${cy+20}" stroke="#000" stroke-width="2"/>`;
            // Roller Support Right
            let rx = this.padX + this.effW;
            svg += `<circle cx="${rx}" cy="${cy+10}" r="10" fill="none" stroke="#000" stroke-width="2"/>`;
            svg += `<line x1="${rx-18}" y1="${cy+20}" x2="${rx+18}" y2="${cy+20}" stroke="#000" stroke-width="2"/>`;
        } else if (model.type === 'cantilever') {
            // Fixed Wall Left
            svg += `<line x1="${this.padX}" y1="${cy-40}" x2="${this.padX}" y2="${cy+40}" stroke="#000" stroke-width="4"/>`;
            for(let i=-35; i<=40; i+=10) {
                svg += `<line x1="${this.padX-10}" y1="${cy+i+10}" x2="${this.padX}" y2="${cy+i}" stroke="#000" stroke-width="1"/>`;
            }
        }

        // Beam Line
        svg += `<line x1="${this.padX}" y1="${cy}" x2="${this.padX + this.effW}" y2="${cy}" stroke="#000" stroke-width="5" />`;
        svg += `<text x="${this.padX}" y="${cy-20}" font-size="14" font-weight="bold" text-anchor="end" dx="-10">A</text>`;
        svg += `<text x="${this.padX + this.effW}" y="${cy-20}" font-size="14" font-weight="bold" text-anchor="start" dx="10">B</text>`;

        // UDL Loads
        model.loads.forEach(load => {
            if (load.type === 'udl') {
                for (let x = 0; x <= L; x += L/15) {
                    let lx = this.mapX(x, L);
                    svg += `<line x1="${lx}" y1="${cy-40}" x2="${lx}" y2="${cy}" stroke="var(--load-color)" stroke-width="2" marker-end="url(#arrow-down)"/>`;
                }
                svg += `<line x1="${this.padX}" y1="${cy-40}" x2="${this.padX+this.effW}" y2="${cy-40}" stroke="var(--load-color)" stroke-width="2"/>`;
                svg += `<text x="${this.padX + this.effW/2}" y="${cy-50}" fill="var(--load-color)" font-size="14" font-weight="bold" text-anchor="middle">w = ${load.w} kN/m</text>`;
            }
        });

        // Point Loads
        model.loads.forEach(load => {
            if (load.type === 'point') {
                let lx = this.mapX(load.a, L);
                svg += `<line x1="${lx}" y1="${cy-60}" x2="${lx}" y2="${cy}" stroke="var(--load-color)" stroke-width="2" marker-end="url(#arrow-down)"/>`;
                svg += `<text x="${lx}" y="${cy-70}" fill="var(--load-color)" font-size="14" font-weight="bold" text-anchor="middle">P = ${load.P} kN</text>`;
            }
        });

        // Reactions (Green Arrows)
        if (results.reactions.RA > 0) {
            svg += `<line x1="${this.padX}" y1="${cy+60}" x2="${this.padX}" y2="${cy}" stroke="var(--reaction-color)" stroke-width="2" marker-end="url(#arrow-up)"/>`;
            svg += `<text x="${this.padX}" y="${cy+80}" fill="var(--reaction-color)" font-size="14" font-weight="bold" text-anchor="middle">R_A = ${results.reactions.RA.toFixed(2)} kN</text>`;
        }
        if (model.type === 'ssb' && results.reactions.RB > 0) {
            let rx = this.padX + this.effW;
            svg += `<line x1="${rx}" y1="${cy+60}" x2="${rx}" y2="${cy}" stroke="var(--reaction-color)" stroke-width="2" marker-end="url(#arrow-up)"/>`;
            svg += `<text x="${rx}" y="${cy+80}" fill="var(--reaction-color)" font-size="14" font-weight="bold" text-anchor="middle">R_B = ${results.reactions.RB.toFixed(2)} kN</text>`;
        }

        return this.createSVG(svg, "0 0 800 220");
    }

    // --- 2. SHEAR FORCE DIAGRAM (SFD) ---
    static drawSFD(model, results) {
        const cy = 100;
        const maxAbs = Math.max(Math.abs(results.maxV), Math.abs(results.minV));
        const scale = maxAbs === 0 ? 1 : 60 / maxAbs;
        
        let pathD = `M ${this.padX},${cy} `;
        results.points.forEach(p => {
            pathD += `L ${this.mapX(p.x, model.L)},${cy - p.V * scale} `;
        });
        pathD += `L ${this.padX + this.effW},${cy} Z`;

        let svg = `<path d="${pathD}" fill="var(--sfd-fill)" stroke="var(--sfd-color)" stroke-width="2"/>`;
        svg += `<line x1="${this.padX}" y1="${cy}" x2="${this.padX + this.effW}" y2="${cy}" stroke="#000" stroke-width="1" />`;
        
        // Zero Axis line marks
        svg += `<text x="${this.padX-20}" y="${cy+5}" font-size="12" text-anchor="end">0</text>`;

        // Max/Min Texts
        if(results.maxV > 0) svg += `<text x="${this.padX + this.effW/2}" y="${cy - results.maxV*scale - 10}" fill="var(--sfd-color)" font-size="12" font-weight="bold" text-anchor="middle">+${results.maxV.toFixed(2)}</text>`;
        if(results.minV < 0) svg += `<text x="${this.padX + this.effW/2}" y="${cy - results.minV*scale + 20}" fill="var(--sfd-color)" font-size="12" font-weight="bold" text-anchor="middle">${results.minV.toFixed(2)}</text>`;

        return this.createSVG(svg);
    }

    // --- 3. BENDING MOMENT DIAGRAM (BMD) ---
    static drawBMD(model, results) {
        const cy = 140; // Shifted down since sagging BMD is positive (up)
        const maxAbs = Math.max(Math.abs(results.maxM), Math.abs(results.minM));
        const scale = maxAbs === 0 ? 1 : 100 / maxAbs;
        
        let pathD = `M ${this.padX},${cy} `;
        results.points.forEach(p => {
            pathD += `L ${this.mapX(p.x, model.L)},${cy - p.M * scale} `;
        });
        pathD += `L ${this.padX + this.effW},${cy} Z`;

        let svg = `<path d="${pathD}" fill="var(--bmd-fill)" stroke="var(--bmd-color)" stroke-width="2"/>`;
        svg += `<line x1="${this.padX}" y1="${cy}" x2="${this.padX + this.effW}" y2="${cy}" stroke="#000" stroke-width="1" />`;

        // Zero Axis
        svg += `<text x="${this.padX-20}" y="${cy+5}" font-size="12" text-anchor="end">0</text>`;

        // Max Text
        if(results.maxM > 0) {
            let pMax = results.points.find(p => p.M === results.maxM);
            let pX = pMax ? this.mapX(pMax.x, model.L) : this.padX + this.effW/2;
            svg += `<text x="${pX}" y="${cy - results.maxM*scale - 10}" fill="var(--reaction-color)" font-size="12" font-weight="bold" text-anchor="middle">${results.maxM.toFixed(2)} (Max)</text>`;
        }
        if(results.minM < 0) {
             let pMin = results.points.find(p => p.M === results.minM);
             let pX = pMin ? this.mapX(pMin.x, model.L) : this.padX;
             svg += `<text x="${pX}" y="${cy - results.minM*scale + 20}" fill="var(--load-color)" font-size="12" font-weight="bold" text-anchor="middle">${results.minM.toFixed(2)}</text>`;
        }

        return this.createSVG(svg, "0 0 800 240");
    }
}