/**
 * parser.js
 * Converts natural text input into a structured Beam Model.
 */
class Parser {
    static parse(input) {
        // Normalize input for consistent parsing
        let normalizedText = input.toLowerCase();
        normalizedText = normalizedText.replace(/\s+/g, ' ').trim(); // Remove extra spaces
        normalizedText = normalizedText.replace(/kn\b/g, 'kN'); // Standardize kN unit
        normalizedText = normalizedText.replace(/m\b/g, 'm'); // Ensure 'm' unit is consistent
        
        // Dispatch to structured or natural language parser
        // Structured input typically uses '=', 'P=', 'UDL=', or '@'
        if (normalizedText.includes("l=") || normalizedText.includes("p=") || normalizedText.includes("udl=") || normalizedText.includes("@")) {
            return this.parseStructured(normalizedText);
        } else {
            return this.parseNatural(normalizedText);
        }
    }

    // Existing structured parsing logic (renamed from parse)
    static parseStructured(text) {
        // 1. Determine Beam Type
        let type = 'ssb'; // Default
        if (text.includes('cantilever')) {
            type = 'cantilever';
        } else if (text.includes('ssb')) {
            type = 'ssb';
        }

        // 2. Determine Length
        let L = 10; // Default fallback length
        const lMatch = text.match(/l\s*=\s*([0-9.]+)/) || text.match(/([0-9.]+)\s*m/);
        if (lMatch) L = parseFloat(lMatch[1]);

        // 3. Initialize Model Structure
        const model = new BeamModel(type, L);
        
        // 4. Parse UDL (Uniformly Distributed Load) - Structured
        const udlStructuredRegex = /udl\s*([0-9.]+)(?:kn\/m|n\/m)?(?:\s*@\s*([0-9.]+)\s*to\s*([0-9.]+)\s*m)?/gi;
        for (const match of text.matchAll(udlStructuredRegex)) {
            const magnitude = parseFloat(match[1]);
            const start = match[2] ? parseFloat(match[2]) : 0;
            const end = match[3] ? parseFloat(match[3]) : L;
            model.addUDL(magnitude, start, end);
        }

        // 5. Parse Point Load - Structured
        const pointLoadStructuredRegex = /(?:p\s*=\s*|)(\d+\.?\d*)\s*(?:kn|n)?\s*@\s*(\d+\.?\d*)\s*m?/gi;
        for (const match of text.matchAll(pointLoadStructuredRegex)) {
            model.addPointLoad(parseFloat(match[1]), parseFloat(match[2]));
        }
        return model;
    }

    // New natural language parsing logic
    static parseNatural(text) {
        // 1. Determine Beam Type
        let type = 'ssb'; // Default
        if (text.includes('cantilever')) {
            type = 'cantilever';
        } else if (text.includes('simply supported') || text.includes('ssb')) {
            type = 'ssb';
        }

        // 2. Determine Length
        let L = 10; // Default fallback length
        const lengthMatch = text.match(/(\d+(\.\d+)?)\s*m/);
        if (lengthMatch) L = parseFloat(lengthMatch[1]);

        // 3. Initialize Model Structure
        const model = new BeamModel(type, L);

        // 4. Extract Loads
        // Point Loads: "5kn at 2m", "point load 5kn at 2m"
        const pointLoadNaturalRegex = /(?:point load\s*|)(\d+\.?\d*)\s*kn(?:\s*at)?\s*(\d+\.?\d*)\s*m/gi;
        for (const match of text.matchAll(pointLoadNaturalRegex)) {
            model.addPointLoad(parseFloat(match[1]), parseFloat(match[2]));
        }

        // UDLs: "udl 10kn/m", "10kn/m over 0 to 6m"
        const udlNaturalRegex = /(?:udl\s*|)(\d+\.?\d*)\s*kn\/m(?:\s*over\s*(\d+\.?\d*)\s*(?:to|-)\s*(\d+\.?\d*)\s*m)?/gi;
        for (const match of text.matchAll(udlNaturalRegex)) {
            const magnitude = parseFloat(match[1]);
            let start = 0;
            let end = L;
            if (match[2] !== undefined && match[3] !== undefined) { // If span is specified
                start = parseFloat(match[2]);
                end = parseFloat(match[3]);
            }
            model.addUDL(magnitude, start, end);
        }

        return model;
    }
}