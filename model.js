/**
 * model.js
 * Represents the structural mechanics properties of the beam.
 */
class BeamModel {
    constructor(type, L) {
        this.type = type; // 'ssb' (Simply Supported) or 'cantilever'
        this.L = L;       // Span in meters
        this.loads =[];  // Array of applied loads
    }

    addPointLoad(P, a) {
        // P = Magnitude in kN, a = distance from left support (x=0)
        this.loads.push({ type: 'point', P: P, a: a });
    }

    addUDL(w, start = 0, end = this.L) {
        // w = Load intensity in kN/m, start/end = span of UDL
        this.loads.push({ type: 'udl', w: w, start: start, end: end });
    }
} 