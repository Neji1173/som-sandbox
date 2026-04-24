/**
 * learning.js
 * Generates the step-by-step mathematical explanations.
 */
class Learning {
    static generate(model, results, mode = 'standard') {
        const reactions = results.reactions;
        let html = '';

        let maxAbsV = Math.max(Math.abs(results.maxV), Math.abs(results.minV));
        let maxAbsM = Math.max(Math.abs(results.maxM), Math.abs(results.minM));

        switch (mode) {
            case 'fast':
                html += `<b>Results Summary:</b><ul>`;
                html += `<li>R<sub>A</sub> = ${reactions.RA.toFixed(2)} kN</li>`;
                if (model.type === 'ssb') {
                    html += `<li>R<sub>B</sub> = ${reactions.RB.toFixed(2)} kN</li>`;
                } else {
                    html += `<li>M<sub>A</sub> = ${reactions.MA.toFixed(2)} kN&middot;m</li>`;
                }
                html += `<li>Max Shear Force = ${maxAbsV.toFixed(2)} kN</li>`;
                html += `<li>Max Bending Moment = ${maxAbsM.toFixed(2)} kN&middot;m</li>`;
                html += `</ul>`;
                break;

            case 'detailed':
                // --- STEP 1: GIVEN ---
                html += `<div class="step-title">STEP 1 → GIVEN</div>`;
                html += `<ul>`;
                html += `<li>Beam Type: ${model.type === 'ssb' ? 'Simply Supported Beam (SSB)' : 'Cantilever Beam'}</li>`;
                html += `<ul><li>Beam Type: ${model.type === 'ssb' ? 'Simply Supported Beam (SSB)' : 'Cantilever Beam'}</li>`;
                html += `<li>Span, <i>L</i> = ${model.L} m</li>`;
                if (model.loads.length === 0) {
                    html += `<li>No external loads applied.</li>`;
                } else {
                    model.loads.forEach(l => {
                        if (l.type === 'point') {
                            html += `<li>Point Load, <i>P</i> = ${l.P} kN acting at <i>a</i> = ${l.a} m from left</li>`;
                        } else if (l.type === 'udl') { // UDLs are converted to equivalent point loads for reaction calculation
                            html += `<li>UDL, <i>w</i> = ${l.w} kN/m acting over ${l.start}m to ${l.end}m</li>`;
                        }
                    });
                }
                html += `</ul>`;

                // --- STEP 2: EQUILIBRIUM ---
                html += `<div class="step-title">STEP 2 → EQUILIBRIUM</div>`;
                html += `<p>Apply equilibrium equations to prepare for support reactions:</p>`;
                html += `<div class="math-block">ΣF<sub>y</sub> = 0<br>ΣM = 0</div>`;
                
                const udlLoads = model.loads.filter(l => l.type === 'udl');
                if (udlLoads.length > 0) {
                    html += `<p>Distributed loads (UDLs) are converted to equivalent point loads:</p>`;
                    udlLoads.forEach(udl => {
                        const equivalentLoad = udl.w * (udl.end - udl.start);
                        const centroid = udl.start + (udl.end - udl.start) / 2;
                        html += `<div class="math-block">
                            <i>P<sub>eq</sub></i> = ${udl.w} kN/m &times; (${udl.end} - ${udl.start}) m = ${equivalentLoad.toFixed(2)} kN<br>
                            <i>Location (x)</i> = ${centroid.toFixed(2)} m
                        </div>`;
                    });
                }

                // --- STEP 3: REACTIONS ---
                html += `<div class="step-title">STEP 3 → REACTIONS</div>`;
                html += `<p>Solving for unknown support reactions:</p>`;

                if (model.type === 'ssb' && model.loads.length > 0) {
                    let pLoad = model.loads.find(l => l.type === 'point');
                    let uLoad = model.loads.find(l => l.type === 'udl');

                    if (model.loads.length === 1 && pLoad && !uLoad) { // Single point load
                        html += `<div class="math-block">
                            ΣM<sub>A</sub> = 0<br>
                            <i>R<sub>B</sub></i> &times; <i>L</i> - <i>P</i> &times; <i>a</i> = 0<br>
                            <i>R<sub>B</sub></i> &times; ${model.L} = ${pLoad.P} &times; ${pLoad.a}<br>
                            <i>R<sub>B</sub></i> = (${pLoad.P} &times; ${pLoad.a}) / ${model.L}<br>
                            <b><i>R<sub>B</sub></i> = ${reactions.RB.toFixed(2)} kN</b>
                        </div>`;
                        html += `<div class="math-block">
                            ΣF<sub>y</sub> = 0<br>
                            <i>R<sub>A</sub></i> + <i>R<sub>B</sub></i> - <i>P</i> = 0<br>
                            <i>R<sub>A</sub></i> = <i>P</i> - <i>R<sub>B</sub></i><br>
                            <i>R<sub>A</sub></i> = ${pLoad.P} - ${reactions.RB.toFixed(2)}<br>
                            <b><i>R<sub>A</sub></i> = ${reactions.RA.toFixed(2)} kN</b>
                        </div>`;
                    } else if (model.loads.length === 1 && uLoad && !pLoad && uLoad.start === 0 && uLoad.end === model.L) { // Single full-span UDL
                        html += `<p>For a full-span UDL on a simply supported beam (due to symmetry):</p>`;
                        html += `<div class="math-block">
                            ΣF<sub>y</sub> = 0<br>
                            <i>R<sub>A</sub></i> = <i>R<sub>B</sub></i> = (<i>w</i> &times; <i>L</i>) / 2<br>
                            <i>R<sub>A</sub></i> = (${uLoad.w} &times; ${model.L}) / 2<br>
                            <b><i>R<sub>A</sub></i> = <i>R<sub>B</sub></i> = ${reactions.RA.toFixed(2)} kN</b>
                        </div>`;
                    } else {
                        html += `<p>For multiple/complex loads, reactions are found by solving equilibrium equations:</p>`;
                        html += `<div class="math-block">
                            <b><i>R<sub>A</sub></i> = ${reactions.RA.toFixed(2)} kN</b><br>
                            <b><i>R<sub>B</sub></i> = ${reactions.RB.toFixed(2)} kN</b>
                        </div>`;
                    }
                } else if (model.type === 'cantilever' && model.loads.length > 0) {
                    html += `<p>For a cantilever beam fixed at A (x=0):</p>`;
                    html += `<div class="math-block">
                        ΣF<sub>y</sub> = 0<br>
                        <i>R<sub>A</sub></i> - ΣLoads = 0<br>
                        <b><i>R<sub>A</sub></i> = ${reactions.RA.toFixed(2)} kN</b>
                    </div>`;
                    html += `<div class="math-block">
                        ΣM<sub>A</sub> = 0<br>
                        <i>M<sub>A</sub></i> - Σ(Load &times; Lever Arm) = 0<br>
                        <b><i>M<sub>A</sub></i> = ${reactions.MA.toFixed(2)} kN&middot;m</b>
                    </div>`;
                } else {
                    html += `<p>No external loads, so reactions are zero.</p>`; // This case is already handled by solver returning 0.
                    html += `<div class="math-block"><b><i>R<sub>A</sub></i> = 0 kN, <i>R<sub>B</sub></i> = 0 kN</b></div>`;
                }

                // --- STEP 4: SHEAR ---
                html += `<div class="step-title">STEP 4 → SHEAR</div>`;
                html += `<p><i>V(x)</i> is the sum of vertical forces to the left of <i>x</i>. Upward forces are positive.</p>`;
                html += `<div class="math-block"><i>V(x)</i> = Σ (Forces to left of <i>x</i>)</div>`;
                html += `<h4>Derivation by Segments:</h4>`;

                let critical_x_coords = new Set([0, model.L]);
                model.loads.forEach(load => {
                    if (load.type === 'point') critical_x_coords.add(load.a);
                    else if (load.type === 'udl') {
                        critical_x_coords.add(load.start);
                        critical_x_coords.add(load.end);
                    }
                });
                let sorted_critical_x = Array.from(critical_x_coords).sort((a, b) => a - b);
                sorted_critical_x = sorted_critical_x.filter(x => x >= 0 && x <= model.L);

                for (let i = 0; i < sorted_critical_x.length - 1; i++) {
                    let x_start = sorted_critical_x[i];
                    let x_end = sorted_critical_x[i+1];

                    if (x_end - x_start < 1e-6) continue; // Skip very small segments

                    const { V_eq_str } = Learning.getSymbolicEquationsAtCut(model, reactions, x_end);

                    html += `<h5>Segment: ${x_start.toFixed(2)} m ≤ x < ${x_end.toFixed(2)} m</h5>`;
                    html += `<div class="math-block"><i>V(x)</i> = ${V_eq_str}</div>`;

                    // Get actual values at segment boundaries
                    const V_at_start_point = results.points.find(p => Math.abs(p.x - x_start) < 1e-6);
                    const V_at_end_point_left = results.points.find(p => Math.abs(p.x - x_end) < 1e-6 && p.side === 'left');
                    const V_at_end_point_right = results.points.find(p => Math.abs(p.x - x_end) < 1e-6 && p.side === 'right');

                    if (V_at_start_point) {
                        html += `<div class="math-block"><i>V(${x_start.toFixed(2)})</i> = ${V_at_start_point.V.toFixed(2)} kN</div>`;
                    }
                    if (V_at_end_point_left && V_at_end_point_right && Math.abs(V_at_end_point_left.V - V_at_end_point_right.V) > 1e-6) {
                        html += `<div class="math-block"><i>V(${x_end.toFixed(2)})<sub>left</sub></i> = ${V_at_end_point_left.V.toFixed(2)} kN<br><i>V(${x_end.toFixed(2)})<sub>right</sub></i> = ${V_at_end_point_right.V.toFixed(2)} kN</div>`;
                    } else if (V_at_end_point_left) {
                        html += `<div class="math-block"><i>V(${x_end.toFixed(2)})</i> = ${V_at_end_point_left.V.toFixed(2)} kN</div>`;
                    }
                }
                html += `<li><b>Result:</b> Maximum Shear Force magnitude = <b>${maxAbsV.toFixed(2)} kN</b></li>`;
                html += `</ul>`; // Close the main list for SFD

                // --- STEP 5: BENDING MOMENT ---
                html += `<div class="step-title">STEP 5 → BENDING MOMENT</div>`;
                html += `<p><i>M(x)</i> is the sum of moments of forces to the left of <i>x</i>. Clockwise moments are positive.</p>`;
                html += `<div class="math-block"><i>M(x)</i> = Σ (Moments to left of <i>x</i>)<br><i>dM/dx = V(x)</i></div>`;
                html += `<h4>Derivation by Segments:</h4>`;

                for (let i = 0; i < sorted_critical_x.length - 1; i++) {
                    let x_start = sorted_critical_x[i];
                    let x_end = sorted_critical_x[i+1];

                    if (x_end - x_start < 1e-6) continue;

                    const { M_eq_str } = Learning.getSymbolicEquationsAtCut(model, reactions, x_end);

                    html += `<h5>Segment: ${x_start.toFixed(2)} m ≤ x < ${x_end.toFixed(2)} m</h5>`;
                    html += `<div class="math-block"><i>M(x)</i> = ${M_eq_str}</div>`;

                    const M_at_start_point = results.points.find(p => Math.abs(p.x - x_start) < 1e-6);
                    const M_at_end_point = results.points.find(p => Math.abs(p.x - x_end) < 1e-6);

                    if (M_at_start_point) {
                        html += `<div class="math-block"><i>M(${x_start.toFixed(2)})</i> = ${M_at_start_point.M.toFixed(2)} kN·m</div>`;
                    }
                    if (M_at_end_point) {
                        html += `<div class="math-block"><i>M(${x_end.toFixed(2)})</i> = ${M_at_end_point.M.toFixed(2)} kN·m</div>`;
                    }

                    // Check for V(x)=0 within this segment (potential max/min moment)
                    const zero_V_point = results.points.find(p =>
                        p.x > x_start + 1e-6 && p.x < x_end - 1e-6 && Math.abs(p.V) < 1e-3
                    );
                    if (zero_V_point) {
                        html += `<p><i>V(x)</i> = 0 at <i>x</i> = ${zero_V_point.x.toFixed(2)} m (potential max/min moment)</p>`;
                        html += `<div class="math-block"><i>M(${zero_V_point.x.toFixed(2)})</i> = ${zero_V_point.M.toFixed(2)} kN·m</div>`;
                    }
                }
                html += `<li><b>Result:</b> Maximum Bending Moment magnitude = <b>${maxAbsM.toFixed(2)} kN&middot;m</b></li>`;
                html += `</ul>`; // Close the main list for BMD
                break;

            case 'standard': // Current behavior
            default:
                // --- STEP 1: IDENTIFY ---
                html += `<div class="step-title">1. Identify the given:</div>`;
                html += `<ul>`;
                html += `<li>Beam Type: ${model.type === 'ssb' ? 'Simply Supported Beam (SSB)' : 'Cantilever Beam'}</li>`;
                html += `<li>Span, <i>L</i> = ${model.L} m</li>`;

                if (model.loads.length === 0) {
                    html += `<li>No external loads applied.</li>`;
                } else {
                    model.loads.forEach(l => {
                        if (l.type === 'point') {
                            html += `<li>Point Load, <i>P</i> = ${l.P} kN at <i>a</i> = ${l.a} m</li>`;
                        } else if (l.type === 'udl') {
                            html += `<li>UDL, <i>w</i> = ${l.w} kN/m acting over ${l.start}m to ${l.end}m</li>`;
                        }
                    });
                }
                html += `</ul>`;

                // --- STEP 2: REACTIONS ---
                html += `<div class="step-title">2. Calculate Reactions:</div>`;
                if (model.type === 'ssb' && model.loads.length > 0) {
                    let pLoad = model.loads.find(l => l.type === 'point');
                    let uLoad = model.loads.find(l => l.type === 'udl');
                    
                    if (model.loads.length === 1 && pLoad && !uLoad) { // Single point load
                        html += `<p>Taking moments about A (ΣM<sub>A</sub> = 0):</p>
                            <div class="math-block">
                                <i>R<sub>B</sub></i> &middot; <i>L</i> = <i>P</i> &middot; <i>a</i><br>
                                <i>R<sub>B</sub></i> &middot; ${model.L} = ${pLoad.P} &middot; ${pLoad.a}<br>
                                <b><i>R<sub>B</sub></i> = ${reactions.RB.toFixed(2)} kN</b>
                            </div>`;
                        html += `<p>Vertical equilibrium (ΣF<sub>y</sub> = 0):</p>
                            <div class="math-block">
                                <i>R<sub>A</sub></i> + <i>R<sub>B</sub></i> = <i>P</i><br>
                                <i>R<sub>A</sub></i> = ${pLoad.P} - ${reactions.RB.toFixed(2)}<br>
                                <b><i>R<sub>A</sub></i> = ${reactions.RA.toFixed(2)} kN</b>
                            </div>`;
                    } else if (model.loads.length === 1 && uLoad && !pLoad && uLoad.start === 0 && uLoad.end === model.L) { // Single full-span UDL
                        html += `<p>Due to symmetry for a full-span UDL:</p>
                            <div class="math-block">
                                <i>R<sub>A</sub></i> = <i>R<sub>B</sub></i> = (<i>w</i> &middot; <i>L</i>) / 2<br>
                                <i>R<sub>A</sub></i> = (${uLoad.w} &middot; ${model.L}) / 2<br>
                                <b><i>R<sub>A</sub></i> = <i>R<sub>B</sub></i> = ${reactions.RA.toFixed(2)} kN</b>
                            </div>`;
                    } else {
                        html += `<p>For multiple or complex loads, reactions are calculated using equilibrium equations:</p>`;
                        html += `<div class="math-block">
                            <b><i>R<sub>A</sub></i> = ${reactions.RA.toFixed(2)} kN</b><br>
                            <b><i>R<sub>B</sub></i> = ${reactions.RB.toFixed(2)} kN</b>
                        </div>`;
                    }
                } else if (model.type === 'cantilever' && model.loads.length > 0) {
                    html += `<p>Vertical equilibrium (ΣF = 0):</p>
                        <div class="math-block">
                            <i>R<sub>A</sub></i> = ΣLoads<br>
                            <b><i>R<sub>A</sub></i> = ${reactions.RA.toFixed(2)} kN</b>
                        </div>`;
                    html += `<p>Moment reaction at fixed support (ΣM = 0):</p>
                        <div class="math-block">
                            <i>M<sub>A</sub></i> = -Σ(Load &middot; Lever Arm)<br>
                            <b><i>M<sub>A</sub></i> = ${reactions.MA.toFixed(2)} kN&middot;m</b>
                        </div>`;
                }

                // --- STEP 3 & 4: SFD & BMD summaries ---
                html += `<div class="step-title">3. Shear Force Calculation:</div><ul>`;
                html += `<li>Maximum Shear Force magnitude = ${maxAbsV.toFixed(2)} kN</li>`;
                html += `<li>Plotted directly from <i>V(x) = Σ F<sub>y</sub></i></li></ul>`;

                html += `<div class="step-title">4. Bending Moment Calculation:</div><ul>`;
                html += `<li>Maximum Bending Moment magnitude = ${maxAbsM.toFixed(2)} kN&middot;m</li>`;
                html += `<li>Plotted by integrating <i>V(x)</i></li></ul>`;
                break;
        }
        return html;
    }
}

// Helper function to build V(x) and M(x) symbolic equation strings for a given cut 'x'
// This function constructs the equation as if a cut is made at 'x_cut_for_equation_context'
// and we are looking at forces/moments to the left.
Learning.getSymbolicEquationsAtCut = (model, reactions, x_cut_for_equation_context) => {
    let V_terms = [];
    let M_terms = [];

    // Initial reactions at x=0
    V_terms.push(reactions.RA.toFixed(2));
    M_terms.push(`${reactions.RA.toFixed(2)} * x`);

    if (model.type === 'cantilever' && reactions.MA !== 0) {
        // For cantilever, MA is a moment reaction at x=0.
        // If MA is negative (counter-clockwise in solver's convention), it creates a positive bending moment on the beam.
        // So, we add its absolute value to the moment equation.
        M_terms.push(`${reactions.MA > 0 ? '+' : '-'} ${Math.abs(reactions.MA).toFixed(2)}`);
    }

    model.loads.forEach(load => {
        if (load.type === 'point' && load.a < x_cut_for_equation_context) {
            V_terms.push(`- ${load.P.toFixed(2)}`);
            M_terms.push(`- ${load.P.toFixed(2)} * (x - ${load.a.toFixed(2)})`);
        } else if (load.type === 'udl' && load.start < x_cut_for_equation_context) {
            // UDL is active from load.start up to x (the cut)
            const udl_active_start_x = load.start;
            const udl_active_end_x = Math.min(x_cut_for_equation_context, load.end); // UDL might end before x_cut

            if (udl_active_end_x > udl_active_start_x) {
                // The UDL term in V(x) is w * (x - start)
                V_terms.push(`- ${load.w.toFixed(2)} * (x - ${udl_active_start_x.toFixed(2)})`);
                // The UDL term in M(x) is w * (x - start)^2 / 2
                M_terms.push(`- ${load.w.toFixed(2)} * (x - ${udl_active_start_x.toFixed(2)})^2 / 2`);
            }
        }
    });

    let V_eq_str = V_terms.join(' ').replace(/\+ -/g, '- ');
    let M_eq_str = M_terms.join(' ').replace(/\+ -/g, '- ');

    return { V_eq_str, M_eq_str };
};