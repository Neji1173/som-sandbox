/**
 * solver.js
 * Applies equilibrium equations to solve Reactions, V(x), and M(x).
 */
class Solver {
    static solve(model) {
        const L = model.L;
        let RA = 0, RB = 0, MA = 0;

        // --- 1. SOLVE REACTIONS ---
        if (model.type === 'ssb') {
            model.loads.forEach(load => {
                if (load.type === 'point') {
                    // Sum M_A = 0 -> RB * L = P * a
                    let rb = (load.P * load.a) / L;
                    RB += rb;
                    RA += (load.P - rb);
                } else if (load.type === 'udl') {
                    let totalLoad = load.w * L;
                    RA += totalLoad / 2;
                    RB += totalLoad / 2;
                }
            });
        } else if (model.type === 'cantilever') {
            // Assume fixed at x=0 (Left)
            model.loads.forEach(load => {
                if (load.type === 'point') {
                    RA += load.P;
                    MA -= load.P * load.a; // Reaction moment (Negative = Sagging convention / Counter-Clockwise)
                } else if (load.type === 'udl') {
                    let totalLoad = load.w * L;
                    RA += totalLoad;
                    MA -= totalLoad * (L / 2);
                }
            });
        }

        const reactions = { RA, RB, MA };

        // --- 2. CALCULATE INTERNAL FORCES V(x), M(x) ---
        let points =[];
        const numSteps = 200;
        const dx = L / numSteps;

        // Evaluator function utilizing basic section method from Left to Right
        const getForces = (x, side = 'left') => {
            let V = RA;
            let M = RA * x + MA; // M_A is reactive moment at support

            model.loads.forEach(load => {
                if (load.type === 'point') {
                    // If evaluating precisely at the point load, determine step jump based on 'side'
                    if (x > load.a || (Math.abs(x - load.a) < 1e-6 && side === 'right')) {
                        V -= load.P;
                        M -= load.P * (x - load.a);
                    }
                } else if (load.type === 'udl') {
                    let loadLen = Math.min(x, L);
                    V -= load.w * loadLen;
                    M -= load.w * loadLen * (loadLen / 2);
                }
            });
            return { V, M };
        };

        // Sweep across beam
        for (let i = 0; i <= numSteps; i++) {
            let x = i * dx;
            
            // Check proximity to point loads to capture perfect vertical jumps
            let isPointLoad = model.loads.find(l => l.type === 'point' && Math.abs(l.a - x) < 1e-5);
            
            if (isPointLoad) {
                points.push({ x: x, ...getForces(x, 'left') });
                points.push({ x: x, ...getForces(x, 'right') });
            } else {
                points.push({ x: x, ...getForces(x, 'right') });
            }
        }

        // Guarantee we mathematically hit the exact point load locations even if sweep misses them
        model.loads.forEach(load => {
            if (load.type === 'point') {
                if (!points.some(p => Math.abs(p.x - load.a) < 1e-5)) {
                    points.push({ x: load.a, ...getForces(load.a, 'left') });
                    points.push({ x: load.a, ...getForces(load.a, 'right') });
                }
            }
        });

        points.sort((a, b) => a.x - b.x);

        // --- 3. EXTRACT MAX/MIN FOR SCALING ---
        let maxV = -Infinity, minV = Infinity;
        let maxM = -Infinity, minM = Infinity;

        points.forEach(p => {
            if (p.V > maxV) maxV = p.V;
            if (p.V < minV) minV = p.V;
            if (p.M > maxM) maxM = p.M;
            if (p.M < minM) minM = p.M;
        });

        // Ensure flat lines if no loads
        if (maxV === -Infinity) { maxV = 0; minV = 0; maxM = 0; minM = 0; }

        return { reactions, points, maxV, minV, maxM, minM };
    }
}