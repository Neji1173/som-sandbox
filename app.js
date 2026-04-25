/**
 * app.js
 * Main Controller: Wires DOM events to backend parsing, solving, and rendering.
 */

// --- Global State Object ---
const state = {
    currentInput: "SSB L=6m P=5kN @2m", // Initial value
    parsedModel: null,
    solution: null,
    showSteps: true, // Default to showing steps
    theme: 'light', // Default theme
    inputMode: 'text', // 'text' or 'guided'
    history: [],
    currentView: 'learn', // 'learn' or 'design'
    guidedInput: { // State for guided input mode
        // Default to SSB for consistency, but allow guided input to override
        type: 'ssb', 
        length: 6,
        loads: [] // { type: 'point', magnitude: 5, position: 2 } or { type: 'udl', magnitude: 10, start: 0, end: 6 }
    },
    appSettings: { // Application shell settings
        forceUnit: 'kN',
        lengthUnit: 'm',
        defaultLearningMode: 'standard',
        exportDiagrams: true,
        exportSteps: true
    }
};

// --- Safe DOM Element Access Helper ---
// Replaces document.getElementById to prevent TypeError when element is null
function safeGet(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn("Element not found:", id);
    }
    return el;
}

// --- Safe HTML Setter Helper ---
function safeSetHTML(el, html, name = "element") {
    if (el) {
        el.innerHTML = html;
    } else {
        console.warn(`[DOM Safety] Attempted to set HTML on missing element: ${name}`);
    }
}

// --- Safe Event Listener Helper ---
function safeAddListener(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    } else {
        console.warn(`[DOM Safety] Cannot attach listener to missing element: ${id}`);
    }
}

let interpretedAsText = ''; // Global variable to store the interpreted text for display
// --- Cached DOM Elements ---
const DOM = {};

// --- Core Execution Pipeline ---
function executeAnalysis(inputText) {
    if (!inputText.trim()) return;

    let modelToSolve;
    let inputForHistory = inputText; // Default for text mode

    try {
        let rawInput = inputText; // Store the original user input
        // 1. Parse Input
        if (state.inputMode === 'text') {
            // Preprocess natural language input into structured format
            interpretedAsText = preprocessInput(rawInput); // This updates the global interpretedAsText
            modelToSolve = Parser.parse(interpretedAsText);
        } else { // Guided mode
            // Validate guided input before building model
            if (!validateGuidedInput(state.guidedInput)) {
                return; // Validation failed, do not proceed
            }
            modelToSolve = buildModelFromGuidedInput(state.guidedInput);
            // For history, create a representative string from guided input
            inputForHistory = generateTextFromGuidedInput(state.guidedInput);
        }
        state.currentInput = inputForHistory; // Update currentInput for display

        state.parsedModel = modelToSolve;
        console.log("Parsing started", state.parsedModel); // Debug Log

        // 2. Add to History (only if successful parse)
        // This was a duplicate call, removed. The correct call is below.
        state.solution = Solver.solve(state.parsedModel);
        console.log("Model created", state.solution); // Debug Log

        // 3. Add to History (only if successful)
        addToHistory(inputText);

        console.log("Solving started"); // Debug Log
        console.log("Rendering canvas"); // Debug Log

    } catch (error) {
        console.error("Error during analysis:", error);
        alert("Error parsing or solving the input. Please ensure it follows the expected format (e.g., 'SSB L=6m P=5kN @2m').");
        state.parsedModel = null;
        state.solution = null;
        renderUI(); // Render UI to clear previous results if error
    } finally { // Always render UI and save state after an attempt, successful or not
        renderUI();
        saveStateToLocalStorage();
    }
}

// --- UI Rendering Function (Reacts to State Changes) ---
function renderUI() {
    try {
    // Update input field
    DOM.cmdInput.value = state.currentInput;
    
    // Toggle Steps/Fast Result button active state and visibility
    if (DOM.btnShowSteps && DOM.btnFastResult && DOM.stepsContainer) { // Ensure elements exist
        if (state.showSteps) {
            DOM.btnShowSteps.classList.add('active'); // Use DOM.btnShowSteps
            DOM.btnFastResult.classList.remove('active'); // Use DOM.btnFastResult
            DOM.stepsContainer.style.display = 'flex'; // Use stepsContainer for display toggling
        } else {
            DOM.btnShowSteps.classList.remove('active'); // Use DOM.btnShowSteps
            DOM.btnFastResult.classList.add('active'); // Use DOM.btnFastResult
            DOM.stepsContainer.style.display = 'none';
        }
    }
    
    // Apply theme
    document.body.classList.toggle('dark-mode', state.theme === 'dark');

    // Render history list
    renderHistoryList();

    // Render current view (Learn/Design)
    if (state.currentView === 'learn') {
        if (DOM.learnTab) DOM.learnTab.classList.add('active');
        if (DOM.designTab) DOM.designTab.classList.remove('active');
        if (DOM.leftPanel) DOM.leftPanel.style.display = 'flex';
        if (DOM.rightPanel) DOM.rightPanel.style.display = 'flex';
    } else { // 'design'
        if (DOM.learnTab) DOM.learnTab.classList.remove('active');
        if (DOM.designTab) DOM.designTab.classList.add('active');
        DOM.leftPanel.style.display = 'none';
        DOM.rightPanel.style.display = 'flex';
    }

    // Toggle Text/Guided input panels
    if (state.inputMode === 'text') {
        DOM.textInputPanel.style.display = 'flex';
        if (DOM.guidedInputPanel) DOM.guidedInputPanel.style.display = 'none';
        if (DOM.textModeBtn) DOM.textModeBtn.classList.add('active');
        if (DOM.guidedModeBtn) DOM.guidedModeBtn.classList.remove('active');
    } else {
        if (DOM.textInputPanel) DOM.textInputPanel.style.display = 'none';
        if (DOM.guidedInputPanel) DOM.guidedInputPanel.style.display = 'flex';
        if (DOM.textModeBtn) DOM.textModeBtn.classList.remove('active');
        if (DOM.guidedModeBtn) DOM.guidedModeBtn.classList.add('active');
    }

    // If model and solution exist, render diagrams and summaries
    if (state.parsedModel && state.solution) {
        CanvasRenderer.render(state.parsedModel, state.solution);
        updateSummaries(state.parsedModel, state.solution);
        safeSetHTML(DOM.stepsContent, Learning.generate(state.parsedModel, state.solution, state.learningMode), "stepsContent");
    } else {
        // Clear UI if no model/solution (e.g., after an error or initial load)
        safeSetHTML(DOM.beamContainer, '', 'beamContainer');
        safeSetHTML(DOM.sfdContainer, '', 'sfdContainer');
        safeSetHTML(DOM.bmdContainer, '', 'bmdContainer');
        safeSetHTML(DOM.resultsGrid, '', 'resultsGrid');
        safeSetHTML(DOM.stepsContent, '<p>Enter a command to get started!</p>', 'stepsContent');
    }

    // Update active state for learning mode buttons
    if (DOM.btnShowSteps && DOM.btnFastResult && DOM.btnDetailed) { // Ensure elements exist
        DOM.btnShowSteps.classList.remove('active'); // Use DOM.btnShowSteps
        DOM.btnFastResult.classList.remove('active'); // Use DOM.btnFastResult
        DOM.btnDetailed.classList.remove('active'); // Use DOM.btnDetailed

        if (state.learningMode === 'standard') { // Use DOM.btnShowSteps
            DOM.btnShowSteps.classList.add('active'); // Use DOM.btnShowSteps
        } else if (state.learningMode === 'fast') { // Use DOM.btnFastResult
            DOM.btnFastResult.classList.add('active'); // Use DOM.btnFastResult
        } else if (state.learningMode === 'detailed') { // Use DOM.btnDetailed
            DOM.btnDetailed.classList.add('active'); // Use DOM.btnDetailed
        }
    }
    
    // Display interpreted text for text mode
    if (state.inputMode === 'text' && interpretedAsText && interpretedAsText !== DOM.cmdInput.value) { // DOM.interpretedAsDisplay is checked in safeGet
        if (DOM.interpretedAsDisplay) DOM.interpretedAsDisplay.textContent = `Interpreted as: ${interpretedAsText}`;
    } else {
        if (DOM.interpretedAsDisplay) DOM.interpretedAsDisplay.textContent = '';
    }
    
    // Render guided input specific elements
    renderGuidedInputPanel();
    renderGuidedLoads();
    } catch (err) {
        console.error("Render failed. Prevented app crash:", err);
    }
}

// --- UI Update Helpers ---
function updateSummaries(model, results) {
    let maxAbsV = Math.max(Math.abs(results.maxV), Math.abs(results.minV));
    let maxAbsM = Math.max(Math.abs(results.maxM), Math.abs(results.minM));

    // Right Panel Footer Results
    safeSetHTML(DOM.resultsGrid, `
        <div class="result-col">
            <h4>Reactions</h4>
            <p>R<sub>A</sub> = ${results.reactions.RA.toFixed(2)} kN (up)</p>
            ${model.type === 'ssb' ? `<p>R<sub>B</sub> = ${results.reactions.RB.toFixed(2)} kN (up)</p>` : `<p>M<sub>A</sub> = ${Math.abs(results.reactions.MA).toFixed(2)} kN·m</p>`}
        </div>
        <div class="result-col">
            <h4>Shear Force</h4>
            <p>Max +ve S.F = +${results.maxV.toFixed(2)} kN</p>
            <p>Max -ve S.F = ${results.minV.toFixed(2)} kN</p>
        </div>
        <div class="result-col">
            <h4>Bending Moment</h4>
            <p>Max B.M = ${maxAbsM.toFixed(2)} kN·m</p>
        </div>
        <div class="result-col">
            <h4>At Supports</h4>
            <p>M<sub>A</sub> = ${model.type === 'cantilever' ? Math.abs(results.reactions.MA).toFixed(2) : 0} kN·m</p>
            <p>M<sub>B</sub> = 0 kN·m</p>
        </div>
        <div class="interpretation-box">
            <strong>Interpretation</strong>
            Maximum bending moment typically occurs where the shear force crosses zero or at fixed supports. 
            Diagram shapes are mathematically consistent for a ${model.type === 'ssb' ? 'Simply Supported Beam' : 'Cantilever'} with the specified loading.
        </div>
    `, "resultsGrid");
}

function addToHistory(cmd) {
    // Prevent duplicate consecutive entries
    if (state.history.length > 0 && state.history[0] === cmd) return;
    
    state.history.unshift(cmd); // Add to the beginning
    if (state.history.length > 10) { // Keep history to a reasonable length
        state.history.pop();
    }
    renderHistoryList();
}

function renderHistoryList() {
    safeSetHTML(DOM.historyList, '', 'historyList'); // Clear existing list
    state.history.forEach(cmd => {
        const li = document.createElement('li');
        li.dataset.cmd = cmd; // store for reference
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        li.innerHTML = `<span>${cmd}</span><span class="history-time">${timeStr}</span>`;
        li.addEventListener('click', () => {
            state.currentInput = cmd; // Update input field via state
            executeAnalysis(cmd);
        });
        if (DOM.historyList) DOM.historyList.appendChild(li);
    });
}

// --- Guided Input Specific Functions ---
function renderGuidedInputPanel() {
    if (state.inputMode === 'guided') {
        if (DOM.guidedBeamType) DOM.guidedBeamType.value = state.guidedInput.type;
        if (DOM.guidedBeamLength) DOM.guidedBeamLength.value = state.guidedInput.length;
    }
}

function renderGuidedLoads() {
    if (state.inputMode !== 'guided') return;

    DOM.guidedLoadsContainer.innerHTML = '';
    state.guidedInput.loads.forEach((load, index) => { // Use DOM.guidedLoadsContainer
        let loadCardHtml = '';
        if (load.type === 'point') {
            loadCardHtml = `
                <div class="load-card point-load-card">
                    <select data-index="${index}" data-field="type" class="load-type-select">
                        <option value="point" selected>Point Load</option>
                        <option value="udl">UDL</option>
                    </select>
                    <label>Magnitude (kN): <input type="number" value="${load.magnitude}" data-index="${index}" data-field="magnitude"></label>
                    <label>Position (m): <input type="number" value="${load.position}" data-index="${index}" data-field="position"></label>
                    <button class="btn-remove-load" data-index="${index}">Remove</button>
                </div>
            `;
        } else if (load.type === 'udl') {
            loadCardHtml = `
                <div class="load-card udl-load-card">
                    <select data-index="${index}" data-field="type" class="load-type-select">
                        <option value="point">Point Load</option>
                        <option value="udl" selected>UDL</option>
                    </select>
                    <label>Magnitude (kN/m): <input type="number" value="${load.magnitude}" data-index="${index}" data-field="magnitude"></label>
                    <label>Start (m): <input type="number" value="${load.start}" data-index="${index}" data-field="start"></label>
                    <label>End (m): <input type="number" value="${load.end}" data-index="${index}" data-field="end"></label>
                    <button class="btn-remove-load" data-index="${index}">Remove</button>
                </div>
            `;
        }
        if (DOM.guidedLoadsContainer) DOM.guidedLoadsContainer.insertAdjacentHTML('beforeend', loadCardHtml);
    });

    // Re-attach event listeners for dynamically created elements
    if (DOM.guidedLoadsContainer) DOM.guidedLoadsContainer.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('change', handleGuidedLoadChange);
    });
    if (DOM.guidedLoadsContainer) DOM.guidedLoadsContainer.querySelectorAll('.load-type-select').forEach(select => {
        select.addEventListener('change', handleGuidedLoadChange);
    });
    if (DOM.guidedLoadsContainer) DOM.guidedLoadsContainer.querySelectorAll('.btn-remove-load').forEach(button => {
        button.addEventListener('click', handleRemoveLoad);
    });
}

function addGuidedLoad(type) {
    if (type === 'point') {
        state.guidedInput.loads.push({ type: 'point', magnitude: 0, position: 0 });
    } else if (type === 'udl') {
        state.guidedInput.loads.push({ type: 'udl', magnitude: 0, start: 0, end: state.guidedInput.length });
    }
    renderUI();
    saveStateToLocalStorage();
}

function handleGuidedLoadChange(event) {
    const index = parseInt(event.target.dataset.index);
    const field = event.target.dataset.field;
    let value = event.target.value;

    if (field === 'type') {
        // If type changes, replace the load object with a new default of that type
        if (value === 'point') {
            state.guidedInput.loads[index] = { type: 'point', magnitude: 0, position: 0 };
        } else if (value === 'udl') {
            state.guidedInput.loads[index] = { type: 'udl', magnitude: 0, start: 0, end: state.guidedInput.length };
        }
    } else {
        state.guidedInput.loads[index][field] = parseFloat(value);
    }
    renderUI(); // Re-render to update UI and potentially re-run analysis
    saveStateToLocalStorage();
}

function handleRemoveLoad(event) {
    const index = parseInt(event.target.dataset.index);
    state.guidedInput.loads.splice(index, 1);
    renderUI();
    saveStateToLocalStorage();
}

function buildModelFromGuidedInput(guidedInputState) {
    const model = new BeamModel(guidedInputState.type, guidedInputState.length);
    guidedInputState.loads.forEach(load => {
        if (load.type === 'point') {
            model.addPointLoad(load.magnitude, load.position);
        } else if (load.type === 'udl') {
            model.addUDL(load.magnitude, load.start, load.end);
        }
    });
    return model;
}

// --- Local Storage ---
function saveStateToLocalStorage() {
    localStorage.setItem('somSandboxState', JSON.stringify({
        theme: state.theme,
        history: state.history,
        currentInput: state.currentInput,
        showSteps: state.showSteps,
        currentView: state.currentView,
        inputMode: state.inputMode,
        guidedInput: state.guidedInput // Save guided input state
    }));
}

function loadStateFromLocalStorage() {
    const savedState = JSON.parse(localStorage.getItem('somSandboxState'));
    if (savedState) {
        state.theme = savedState.theme || 'light';
        state.history = savedState.history || [];
        state.currentInput = savedState.currentInput || "SSB L=6m P=5kN @2m";
        state.showSteps = savedState.showSteps !== undefined ? savedState.showSteps : true;
        state.currentView = savedState.currentView || 'learn';
        state.inputMode = savedState.inputMode || 'text';
        state.guidedInput = savedState.guidedInput || { type: 'ssb', length: 6, loads: [] };
    }
    
    const savedSettings = JSON.parse(localStorage.getItem('som_settings'));
    if (savedSettings) {
        state.appSettings = savedSettings;
    }
}

// --- Basic Validation for Guided Input ---
function validateGuidedInput(guidedInputState) {
    const L = guidedInputState.length;
    if (L <= 0) {
        alert("Beam length must be positive.");
        return false;
    }

    for (const load of guidedInputState.loads) {
        if (load.magnitude <= 0) {
            alert(`Load magnitude must be positive for ${load.type} load.`);
            return false;
        }
        if (load.type === 'point') {
            if (load.position < 0 || load.position > L) {
                alert(`Point load position (${load.position}m) must be within beam length (0m to ${L}m).`);
                return false;
            }
        } else if (load.type === 'udl') {
            if (load.start < 0 || load.end > L || load.start >= load.end) {
                alert(`UDL span (start: ${load.start}m, end: ${load.end}m) must be valid and within beam length (0m to ${L}m).`);
                return false;
            }
        }
    }
    return true;
}

// --- Generate Text from Guided Input for History ---
function generateTextFromGuidedInput(guidedInputState) {
    let text = `${guidedInputState.type.toUpperCase()} L=${guidedInputState.length}m`;
    guidedInputState.loads.forEach(load => {
        if (load.type === 'point') text += ` P=${load.magnitude}kN @${load.position}m`;
        else if (load.type === 'udl') text += ` UDL=${load.magnitude}kN/m @${load.start}m to ${load.end}m`;
    });
    return text;
}

// --- Future Feature Stubs ---
function importQuestion() {
    alert("Import Question functionality is not yet implemented.");
    // Will support text/image-based parsing later
}

async function exportToPDF() {
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF("p", "mm", "a4");
        let y = 20;

        function addPageBorder() {
            pdf.setLineWidth(0.5);
            pdf.rect(5, 5, 200, 287);
        }

        addPageBorder();

        function addTextBlock(text, isTitle = false) {
            if (isTitle) {
                pdf.setFontSize(14);
                pdf.setFont("helvetica", "bold");
                y += 5; // Extra top margin for titles
            } else {
                pdf.setFontSize(11);
                pdf.setFont("helvetica", "normal");
            }
            
            const lines = pdf.splitTextToSize(text, 180);
            lines.forEach(line => {
                if (y > 280) { // Pagination
                    pdf.addPage();
                    addPageBorder();
                    y = 20;
                }
                pdf.text(line, 10, y);
                y += 7; // Line spacing
            });
            y += 3; // Bottom margin
        }

        // Parse steps HTML into readable study text
        function extractTextFromHTML(html) {
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const blocks = temp.querySelectorAll('.step-title, p, li, .math-block, h4, h5');
            blocks.forEach(b => {
                if(b.classList.contains('step-title')) b.prepend(document.createTextNode('\n\n--- '));
                if(b.classList.contains('step-title')) b.appendChild(document.createTextNode(' ---\n'));
                if(b.tagName === 'LI') b.prepend(document.createTextNode('• '));
                b.appendChild(document.createTextNode('\n'));
            });
            return temp.innerText.trim().replace(/\n{3,}/g, '\n\n');
        }

        addTextBlock("SOM Sandbox - Study Sheet", true);
        addTextBlock(`Input: ${state.currentInput}`);
        
        if (DOM.stepsContent && DOM.stepsContent.innerHTML) {
            addTextBlock("STEP-BY-STEP SOLUTION", true);
            addTextBlock(extractTextFromHTML(DOM.stepsContent.innerHTML));
        }

        if (DOM.resultsGrid && DOM.resultsGrid.innerHTML) {
            addTextBlock("RESULTS SUMMARY", true);
            addTextBlock(extractTextFromHTML(DOM.resultsGrid.innerHTML));
        }

        // Place diagrams last
        const diagrams = [
            { el: DOM.beamContainer, title: "Beam Diagram" },
            { el: DOM.sfdContainer, title: "Shear Force Diagram (SFD)" },
            { el: DOM.bmdContainer, title: "Bending Moment Diagram (BMD)" }
        ];

        for (let diag of diagrams) {
            if (diag.el && diag.el.innerHTML.includes('<svg')) {
                pdf.addPage();
                addPageBorder();
                y = 20;
                addTextBlock(diag.title, true);
                
                const canvas = await html2canvas(diag.el, { scale: 2, logging: false });
                const imgData = canvas.toDataURL("image/png");
                const imgWidth = 180;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                pdf.addImage(imgData, "PNG", 15, y + 5, imgWidth, imgHeight);
            }
        }

        pdf.save("SOM_Result.pdf");

    } catch (err) {
        console.error("Export error:", err);
        alert("Export failed. Check console.");
    }
}

// --- Modal System ---
function openModal(title, contentHTML) {
    if (DOM.modalTitle) DOM.modalTitle.textContent = title;
    safeSetHTML(DOM.modalContent, contentHTML, "modal-content");
    if (DOM.modalOverlay) DOM.modalOverlay.classList.add('active');
}

function closeModal() {
    if (DOM.modalOverlay) DOM.modalOverlay.classList.remove('active');
}

// --- Shell Menu Logic Generators ---
function openSettingsModal() {
    const html = `
        <div class="settings-group">
            <h4>[A] Units</h4>
            <label><input type="radio" name="forceUnit" value="kN" ${state.appSettings.forceUnit === 'kN' ? 'checked' : ''}> Force: kN</label>
            <label><input type="radio" name="forceUnit" value="N" ${state.appSettings.forceUnit === 'N' ? 'checked' : ''}> Force: N</label>
            <br/>
            <label><input type="radio" name="lengthUnit" value="m" ${state.appSettings.lengthUnit === 'm' ? 'checked' : ''}> Length: m</label>
            <label><input type="radio" name="lengthUnit" value="mm" ${state.appSettings.lengthUnit === 'mm' ? 'checked' : ''}> Length: mm</label>
        </div>
        <div class="settings-group">
            <h4>[B] Learning Mode Default</h4>
            <select id="setting-learning-mode" style="width: 100%; padding: 6px; border: 1px solid var(--border-color); border-radius: 4px;">
                <option value="fast" ${state.appSettings.defaultLearningMode === 'fast' ? 'selected' : ''}>Fast</option>
                <option value="standard" ${state.appSettings.defaultLearningMode === 'standard' ? 'selected' : ''}>Step-by-step (Standard)</option>
                <option value="detailed" ${state.appSettings.defaultLearningMode === 'detailed' ? 'selected' : ''}>Detailed</option>
            </select>
        </div>
        <div class="settings-group">
            <h4>[C] Export Settings</h4>
            <label><input type="checkbox" id="setting-exp-diagrams" ${state.appSettings.exportDiagrams ? 'checked' : ''}> Include diagrams</label>
            <label><input type="checkbox" id="setting-exp-steps" ${state.appSettings.exportSteps ? 'checked' : ''}> Include steps</label>
        </div>
        <button id="save-settings-btn" class="modal-btn">Save Settings</button>
    `;
    openModal("Settings", html);

    setTimeout(() => {
        safeAddListener('save-settings-btn', 'click', () => {
            const forceUnitEl = document.querySelector('input[name="forceUnit"]:checked');
            const lengthUnitEl = document.querySelector('input[name="lengthUnit"]:checked');
            const learningModeEl = document.getElementById('setting-learning-mode');
            const expDiagramsEl = document.getElementById('setting-exp-diagrams');
            const expStepsEl = document.getElementById('setting-exp-steps');
            
            if (forceUnitEl) state.appSettings.forceUnit = forceUnitEl.value;
            if (lengthUnitEl) state.appSettings.lengthUnit = lengthUnitEl.value;
            if (learningModeEl) state.appSettings.defaultLearningMode = learningModeEl.value;
            if (expDiagramsEl) state.appSettings.exportDiagrams = expDiagramsEl.checked;
            if (expStepsEl) state.appSettings.exportSteps = expStepsEl.checked;
            
            localStorage.setItem("som_settings", JSON.stringify(state.appSettings));
            closeModal();
        });
    }, 0);
}

function openHelpModal() {
    const html = `
        <div class="settings-group">
            <h4>[1] How to Input</h4>
            <p>Examples:</p>
            <ul>
                <li><code>SSB L=6m P=5kN @2m</code></li>
                <li><code>Cantilever 4m UDL 10kN/m</code></li>
            </ul>
        </div>
        <div class="settings-group">
            <h4>[2] Modes</h4>
            <ul>
                <li><b>Text Mode:</b> Fast command-based parsing.</li>
                <li><b>Guided Mode:</b> Easy visual input using dropdowns and fields.</li>
            </ul>
        </div>
        <div class="settings-group">
            <h4>[3] Output Meaning</h4>
            <ul>
                <li><b>SFD:</b> Shear Force Diagram</li>
                <li><b>BMD:</b> Bending Moment Diagram</li>
                <li><b>Reactions:</b> The support forces keeping the beam in equilibrium.</li>
            </ul>
        </div>
    `;
    openModal("Help & Instructions", html);
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    DOM.cmdInput = safeGet('cmd-input');
    DOM.btnRun = safeGet('btn-run');
    DOM.historyList = safeGet('history-list');
    DOM.stepsContent = safeGet('steps-content');
    DOM.interpretedAsDisplay = safeGet('interpreted-as-display');
    DOM.textInputPanel = safeGet('text-input-panel');
    DOM.guidedInputPanel = safeGet('guided-input-panel');
    DOM.textModeBtn = safeGet('text-mode-btn');
    DOM.guidedModeBtn = safeGet('guided-mode-btn');

    DOM.stepsContainer = safeGet('steps-container'); // Corrected ID reference
    DOM.resultsGrid = safeGet('results-grid');
    DOM.btnShowSteps = safeGet('btn-show-steps');
    DOM.btnFastResult = safeGet('btn-fast-result');
    DOM.btnDetailed = safeGet('btn-detailed');
    DOM.themeToggle = safeGet('theme-toggle');
    DOM.clearHistoryBtn = safeGet('clear-history-btn');
    DOM.beamContainer = safeGet('beam-container');
    DOM.sfdContainer = safeGet('sfd-container');
    DOM.bmdContainer = safeGet('bmd-container');
    DOM.learnTab = safeGet('tab-learn');
    DOM.designTab = safeGet('tab-design');
    DOM.leftPanel = document.querySelector('.left-panel'); // querySelector is fine here
    DOM.rightPanel = document.querySelector('.right-panel'); // querySelector is fine here
    DOM.guidedBeamType = safeGet('guided-beam-type');
    DOM.guidedBeamLength = safeGet('guided-beam-length');
    DOM.addPointLoadBtn = safeGet('add-point-load-btn');
    DOM.addUdlBtn = safeGet('add-udl-btn');
    DOM.guidedLoadsContainer = safeGet('guided-loads-container');
    DOM.importQuestionBtn = safeGet('btn-import-question');
    DOM.exportPdfBtn = safeGet('btn-export-pdf');
    DOM.viewToggleGroup = safeGet('view-toggle-group');

    DOM.hamburgerMenuBtn = safeGet('hamburger-menu-btn');
    DOM.sideMenu = safeGet('side-menu');
    DOM.modalOverlay = safeGet('modal-overlay');
    DOM.modalContent = safeGet('modal-content');
    DOM.modalTitle = safeGet('modal-title');
    DOM.modalCloseBtn = safeGet('modal-close-btn');
    
    // Helper function to convert HTML to plain text for PDF
    function htmlToPlainText(html) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || '';
    }
    console.log("App initialized"); // Temporary debug log

    // Load state and render initial UI
    loadStateFromLocalStorage();
    renderUI(); // Render initial UI based on loaded state

    // Event Listeners
    // Run button listener (now conditional based on input mode)
    if (DOM.btnRun) {
        DOM.btnRun.addEventListener('click', () => {
            executeAnalysis(DOM.cmdInput ? DOM.cmdInput.value : '');
        });
    }

    // Guided mode "Run" button
    if (DOM.guidedInputPanel) {
        const runBtn = DOM.guidedInputPanel.querySelector('.btn-primary');
        if (runBtn) {
            runBtn.addEventListener('click', () => {
                executeAnalysis(state.currentInput); 
            });
        }
    }

    // Text input field listener
    if (DOM.cmdInput) {
        DOM.cmdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && state.inputMode === 'text') {
                executeAnalysis(DOM.cmdInput.value);
            }
        });
    }

    // Input Mode Toggle
    if (DOM.textModeBtn) {
        DOM.textModeBtn.addEventListener('click', () => {
            state.inputMode = 'text';
            renderUI();
            saveStateToLocalStorage();
            if (DOM.cmdInput) executeAnalysis(DOM.cmdInput.value);
        });
    }
    if (DOM.guidedModeBtn) {
        DOM.guidedModeBtn.addEventListener('click', () => {
            state.inputMode = 'guided';
            renderUI();
            saveStateToLocalStorage();
            executeAnalysis(generateTextFromGuidedInput(state.guidedInput));
        });
    }

    // Guided Input Listeners
    if (DOM.guidedBeamType) {
        DOM.guidedBeamType.addEventListener('change', (e) => {
            state.guidedInput.type = e.target.value;
            renderUI();
            saveStateToLocalStorage();
        });
    }
    if (DOM.guidedBeamLength) {
        DOM.guidedBeamLength.addEventListener('change', (e) => {
            state.guidedInput.length = parseFloat(e.target.value);
            renderUI();
            saveStateToLocalStorage();
        });
    }
    if (DOM.addPointLoadBtn) DOM.addPointLoadBtn.addEventListener('click', () => addGuidedLoad('point'));
    if (DOM.addUdlBtn) DOM.addUdlBtn.addEventListener('click', () => addGuidedLoad('udl'));

    // Learning Mode Toggles (Show Steps / Fast Result / Detailed)
    if (DOM.btnShowSteps) {
        DOM.btnShowSteps.addEventListener('click', () => {
            state.showSteps = true; 
            state.learningMode = 'standard'; 
            renderUI();
            saveStateToLocalStorage();
        });
    }
    if (DOM.btnFastResult) {
        DOM.btnFastResult.addEventListener('click', () => {
            state.showSteps = false;
            state.learningMode = 'fast'; 
            renderUI();
            saveStateToLocalStorage();
        });
    }
    if (DOM.btnDetailed) {
        DOM.btnDetailed.addEventListener('click', () => {
            state.showSteps = true; 
            state.learningMode = 'detailed'; 
            renderUI();
            saveStateToLocalStorage();
        });
    }

    // Initial setup for learning mode display
    const displayToggleGroup = document.getElementById('display-toggle-group');
    if (displayToggleGroup) {
        displayToggleGroup.addEventListener('click', () => {
            renderUI(); 
        });
    }

    // Theme Toggle
    if (DOM.themeToggle) {
        DOM.themeToggle.addEventListener('click', () => {
            state.theme = state.theme === 'light' ? 'dark' : 'light';
            renderUI();
            saveStateToLocalStorage();
        });
    }

    // History Clear
    if (DOM.clearHistoryBtn) {
        DOM.clearHistoryBtn.addEventListener('click', () => {
            state.history = [];
            renderUI();
            saveStateToLocalStorage();
        });
    }

    // Navigation Tabs
    if (DOM.learnTab) {
        DOM.learnTab.addEventListener('click', () => {
            state.currentView = 'learn';
            renderUI();
            saveStateToLocalStorage();
        });
    }
    if (DOM.designTab) {
        DOM.designTab.addEventListener('click', () => {
            state.currentView = 'design';
            renderUI();
            saveStateToLocalStorage();
        });
    }

    // Future Feature Stubs
    if (DOM.importQuestionBtn) DOM.importQuestionBtn.addEventListener('click', importQuestion);
    if (DOM.exportPdfBtn) DOM.exportPdfBtn.addEventListener('click', exportToPDF);

    // Hamburger Menu Toggle
    if (DOM.hamburgerMenuBtn && DOM.sideMenu) {
        DOM.hamburgerMenuBtn.addEventListener('click', () => {
            DOM.sideMenu.classList.toggle('open');
            if (DOM.menuOverlay) DOM.menuOverlay.classList.toggle('active');
        });
    }
    
    // Hamburger menu outside click functionality
    document.addEventListener("click", (e) => {
        if (DOM.sideMenu?.classList.contains('open')) {
            if (!DOM.sideMenu.contains(e.target) && !DOM.hamburgerMenuBtn.contains(e.target)) {
                DOM.sideMenu.classList.remove('open');
                if (DOM.menuOverlay) DOM.menuOverlay.classList.remove('active');
            }
        }
    });
    
    // Modal Close Logic
    if (DOM.modalCloseBtn) {
        DOM.modalCloseBtn.addEventListener('click', closeModal);
    }
    if (DOM.modalOverlay) {
        DOM.modalOverlay.addEventListener("click", (e) => {
            if (e.target === DOM.modalOverlay) closeModal();
        });
    }
    
    // App Shell Menu Links
    const menuLinks = DOM.sideMenu ? DOM.sideMenu.querySelectorAll('a') : [];
    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            DOM.sideMenu.classList.remove('open'); // Close menu instantly
            if (DOM.menuOverlay) DOM.menuOverlay.classList.remove('active');
            
            const id = link.id;
            if (id === 'menu-privacy') {
                openModal("Privacy Policy", "<p>Your privacy is important to us. This app stores all configurations locally on your browser.</p>");
            } else if (id === 'menu-settings') {
                openSettingsModal();
            } else if (id === 'menu-feedback') {
                openModal("Feedback", `<textarea id="feedback-text" class="modal-textarea" placeholder="Tell us your feedback..."></textarea><button id="submit-feedback-btn" class="modal-btn">Submit</button>`);
                setTimeout(() => {
                    safeAddListener('submit-feedback-btn', 'click', () => { 
                        const feedbackInput = document.getElementById('feedback-text');
                        if(feedbackInput) console.log(feedbackInput.value); 
                        closeModal(); 
                    });
                }, 0);
            } else if (id === 'menu-help') {
                openHelpModal();
            } else if (id === 'menu-follow') {
                openModal("Follow Us", `<ul><li><a href="#" target="_blank">LinkedIn</a></li><li><a href="#" target="_blank">GitHub</a></li><li><a href="#" target="_blank">YouTube</a></li></ul>`);
            } else if (id === 'menu-support') {
                openModal("Support", `<p>Support development by sharing this tool with fellow engineers!</p>`);
            }
        });
    });

    // Initial analysis with the loaded or default input
    // Wrap initial execution in try-catch for global crash prevention
    try {
        executeAnalysis(state.currentInput); // This will now use the correct input mode based on loaded state
    } catch (err) {
        console.error("Initial application render failed:", err);
    }

    // --- Mobile Tab Navigation Logic ---
    const mobileTabs = document.querySelectorAll('.mobile-tab-btn');
    const centerPanel = document.querySelector('.center-panel');
    
    // Set default active panel for mobile
    if (DOM.leftPanel) DOM.leftPanel.classList.add('mobile-active');

    mobileTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active states
            mobileTabs.forEach(t => t.classList.remove('active'));
            if (DOM.leftPanel) DOM.leftPanel.classList.remove('mobile-active');
            if (centerPanel) centerPanel.classList.remove('mobile-active');
            if (DOM.rightPanel) DOM.rightPanel.classList.remove('mobile-active');

            // Set clicked tab and target panel to active
            btn.classList.add('active');
            const target = btn.getAttribute('data-target');
            if (target === 'left-panel' && DOM.leftPanel) DOM.leftPanel.classList.add('mobile-active');
            if (target === 'center-panel' && centerPanel) centerPanel.classList.add('mobile-active');
            if (target === 'right-panel' && DOM.rightPanel) DOM.rightPanel.classList.add('mobile-active');
        });
    });
});

// --- Preprocessing Function for Natural Language Input ---
// This function converts natural language input into a structured format
// that the Parser class can understand.
function preprocessInput(text) {
    const originalInput = text; // Keep original for safety fallback

    // Step 8 (Early Exit): If input already structured, return unchanged
    if (originalInput.includes("=") || originalInput.includes("@")) {
        console.log("Input already structured, returning unchanged:", originalInput);
        return originalInput;
    }

    let workingText = originalInput.toLowerCase();

    // Step 1: Normalize
    workingText = workingText.replace(/[.,]/g, ' '); // Replace commas/periods with space
    workingText = workingText.replace(/\s+/g, ' ').trim(); // Collapse multiple spaces
    workingText = workingText.replace(/kn\b/g, 'kN'); // Normalize "kn" to "kN"
    workingText = workingText.replace(/kn\/m\b/g, 'kN/m'); // Normalize "kn/m" to "kN/m"

    // Step 2: Remove Noise Words
    const noiseWords = [
        "determine", "find", "calculate", "draw", "sketch", "diagram",
        "shear", "bending", "moment", "reactions", "sfd", "bmd",
        "subjected to", "carrying", "carries", "is subjected to",
        "the", "a", "an", "for", "of", "and", "with", "beam"
    ];
    noiseWords.forEach(word => {
        workingText = workingText.replace(new RegExp(`\\b${word}\\b`, 'g'), '');
    });
    workingText = workingText.replace(/\s+/g, ' ').trim(); // Re-trim after removing noise

    // Initialize extracted components
    let extractedBeamType = 'ssb'; // Default
    let extractedLength = null;
    let extractedLoads = [];

    // Step 3: Detect Beam Type
    if (workingText.includes('cantilever')) {
        extractedBeamType = 'cantilever';
    } else if (workingText.includes('simply supported') || workingText.includes('ssb')) {
        extractedBeamType = 'ssb';
    }

    // Step 4: Extract Length
    const lengthRegex = /(\d+(?:\.\d+)?)\s*m/;
    const lengthMatch = workingText.match(lengthRegex);
    if (lengthMatch) {
        extractedLength = parseFloat(lengthMatch[1]);
    }

    // Step 8 (Safety Rule): If length not found, we can't process loads correctly, so fail safe early
    if (extractedLength === null) {
        console.log("Processed (length not found, returning original):", originalInput);
        return originalInput;
    }

    const beamLengthForUdl = extractedLength; // Use this for UDL full span default

    // Step 5: Extract Point Loads
    const pointLoadRegex = /(\d+(?:\.\d+)?)\s*kN(?:\s*at)?\s*(\d+(?:\.\d+)?)\s*m/gi;
    let plMatches = [...workingText.matchAll(pointLoadRegex)];
    plMatches.forEach(match => {
        const magnitude = parseFloat(match[1]);
        const position = parseFloat(match[2]);
        extractedLoads.push(`P=${magnitude}kN @${position}m`);
    });

    // Step 6: Extract UDL (with optional range)
    const udlFullRegex = /(\d+(?:\.\d+)?)\s*kN\/m(?:\s*(?:from|over)\s*(\d+(?:\.\d+)?)\s*(?:to|-)\s*(\d+(?:\.\d+)?)\s*m)?/gi;
    let udlMatches = [...workingText.matchAll(udlFullRegex)];

    udlMatches.forEach(match => {
        const magnitude = parseFloat(match[1]);
        let start = 0;
        let end = beamLengthForUdl;

        if (match[2] !== undefined && match[3] !== undefined) { // If range is explicitly found
            start = parseFloat(match[2]);
            end = parseFloat(match[3]);
        }
        extractedLoads.push(`UDL=${magnitude}kN/m @${start}m to ${end}m`);
    });

    // Step 7: Build Final String
    let finalStringParts = [];
    if (extractedBeamType) {
        finalStringParts.push(extractedBeamType);
    }
    if (extractedLength !== null) {
        finalStringParts.push(`L=${extractedLength}m`);
    }
    extractedLoads.forEach(load => finalStringParts.push(load));

    let finalString = finalStringParts.join(' ');

    // Step 9: Debug Output
    console.log("Processed:", finalString);

    return finalString.replace(/\s+/g, ' ').trim(); // Final trim and normalize spaces
}
