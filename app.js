/*****************************************************
 * GLOBAL STATE
 *****************************************************/
let MODEL = null;
let RECOMMENDATIONS = null;

/*****************************************************
 * LOAD MODELS
 *****************************************************/
Promise.all([
    fetch("risk_model.json").then(r => r.json()),
    fetch("recommendations.json").then(r => r.json())
]).then(([model, recs]) => {
    MODEL = model;
    RECOMMENDATIONS = recs;
    renderForm();
});

/*****************************************************
 * FORM RENDERING
 *****************************************************/
function renderForm() {
    const form = document.getElementById("riskForm");
    form.innerHTML = "";
    const categories = {};

    MODEL.questions.forEach(q => {
        categories[q.category] ||= [];
        categories[q.category].push(q);
    });

    Object.entries(categories).forEach(([category, questions]) => {
        const fieldset = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = category;
        fieldset.appendChild(legend);

        questions.forEach(q => {
            let input;

            if (q.type === "numeric") {
                const label = document.createElement("label");
                label.textContent = q.label;
                input = document.createElement("input");
                input.type = "number";
                input.id = q.id;
                
                if (q.range) {
                    input.min = q.range.min;
                    input.max = q.range.max;
                    input.placeholder = `${q.unit || ''} ${q.range.min} – ${q.range.max}`;
                }

                fieldset.appendChild(label);
                fieldset.appendChild(input);

            } else if (q.type === "binary") {
                // CHECKLIST ITEM
                const container = document.createElement("div");
                container.className = "checklist-item";
                
                input = document.createElement("input");
                input.type = "checkbox";
                input.id = q.id;
                
                const label = document.createElement("label");
                label.setAttribute("for", q.id);
                label.textContent = q.label;

                container.appendChild(input);
                container.appendChild(label);
                fieldset.appendChild(container);

            } else {
                // CATEGORICAL (Dropdown)
                const label = document.createElement("label");
                label.textContent = q.label;
                input = document.createElement("select");
                input.id = q.id;
                Object.entries(q.options).forEach(([text, value]) => {
                    const opt = document.createElement("option");
                    opt.value = value;
                    opt.textContent = text;
                    input.appendChild(opt);
                });
                fieldset.appendChild(label);
                fieldset.appendChild(input);
            }
        });
        form.appendChild(fieldset);
    });
}

function scoreNumeric(val, thresholds) {
    for (const t of thresholds) {
        if (
            (t.max !== undefined && val <= t.max) ||
            (t.min !== undefined && val >= t.min)
        ) {
            return t.points;
        }
    }
    return 0;
}

function computeScoreBounds(model) {
    let min = 0;
    let max = 0;

    model.questions.forEach(q => {
        if (q.type === "numeric") {
            const pts = q.thresholds.map(t => t.points);
            min += Math.min(...pts);
            max += Math.max(...pts);
        } else {
            // This works for both "binary" and "categorical"
            const pts = Object.values(q.options);
            min += Math.min(...pts);
            max += Math.max(...pts);
        }
    });

    return { min, max };
}

function classifyRisk(current, min, max) {
    const percentile = (current - min) / (max - min);

    if (percentile < 1 / 3) {
        return { label: "RIESGO BAJO", class: "risk-low", percentile };
    }
    if (percentile < 2 / 3) {
        return { label: "RIESGO MEDIO", class: "risk-medium", percentile };
    }
    return { label: "RIESGO ALTO", class: "risk-high", percentile };
}

/*****************************************************
 * SCORE CALCULATION
 *****************************************************/
document.getElementById("calculateBtn").onclick = () => {
    const validationErrors = [];
    const rawInputs = {};
    const pointMap = {};
    const breakdown = [];
    let totalScore = 0;

    // Inside document.getElementById("calculateBtn").onclick ...
    MODEL.questions.forEach(q => {
        const el = document.getElementById(q.id);
        let points = 0;
        let rawValue = null;

        if (q.type === "numeric") {
            const error = validateNumericInput(q, el.value);
            if (error) validationErrors.push(error);
            const val = Number(el.value);
            rawValue = val; 
            points = scoreNumeric(val, q.thresholds);
        } 
        else if (q.type === "binary") {
            // If checked, use the 'SI' points. If not, use 'NO' points.
            const isChecked = el.checked;
            rawValue = isChecked ? "SI" : "NO";
            points = isChecked ? q.options["SI"] : q.options["NO"];
        } 
        else {
            // Categorical dropdown
            rawValue = el.options[el.selectedIndex].text;
            points = Number(el.value);
        }

        rawInputs[q.id] = rawValue;
        pointMap[q.id] = points;
        totalScore += points;
        breakdown.push({ label: q.label, value: rawValue, points });
    });

    // Check for errors before rendering results
    if (validationErrors.length > 0) {
        alert("Errores en los datos ingresados:\n\n" + validationErrors.join("\n"));
        return; 
    }

    renderResults(totalScore, breakdown, rawInputs, pointMap);

    const { min, max } = computeScoreBounds(MODEL);
    const risk = classifyRisk(totalScore, min, max);

    // UI population
    document.getElementById("riskSummary").classList.remove("hidden");

    document.getElementById("scoreRatio").textContent =
    `${totalScore} / ${max}`;

    document.getElementById("scorePercentile").textContent =
    `${(risk.percentile * 100).toFixed(1)}%`;

    const badge = document.getElementById("riskBadge");
    badge.textContent = risk.label;
    badge.className = `risk-badge ${risk.class}`;

    const bar = document.getElementById("riskProgress");
    bar.style.width = `${risk.percentile * 100}%`;
    bar.className = `progress-bar ${risk.class}`;
};

/*****************************************************
 * RESULTS RENDERING
 *****************************************************/
function renderResults(totalScore, breakdown, rawInputs, pointMap) {
    const resultsSection = document.getElementById("results");
    const scoreBadge = document.getElementById("scoreBadge");
    const detailsList = document.getElementById("riskDetails");
    const recsList = document.getElementById("recommendations");

    resultsSection.hidden = false;

    scoreBadge.innerHTML = `Puntaje Total Calculado: <u>${totalScore} puntos</u>`;

    detailsList.innerHTML = breakdown
        .map(b => `<li><strong>${b.label}:</strong> ${b.value} &rarr; ${b.points} pts</li>`)
        .join("");

    const generatedRecs = generateRecommendations(rawInputs, pointMap);

    recsList.innerHTML = generatedRecs
        .map(r => `<li>${r}</li>`)
        .join("");

    window.scrollTo({ top: resultsSection.offsetTop - 20, behavior: "smooth" });
}

/*****************************************************
 * RECOMMENDATION ENGINE
 *****************************************************/
function generateRecommendations(rawInputs, pointMap) {
    const recs = [];

    RECOMMENDATIONS.rules.forEach(rule => {
        const { field, min, minPoints, exactPoints } = rule.trigger;

        if (
            min !== undefined &&
            rawInputs[field] !== undefined &&
            rawInputs[field] >= min
        ) {
            recs.push(rule.recommendation);
        }

        if (
            minPoints !== undefined &&
            pointMap[field] !== undefined &&
            pointMap[field] >= minPoints
        ) {
            recs.push(rule.recommendation);
        }

        if (
            exactPoints !== undefined &&
            pointMap[field] !== undefined &&
            pointMap[field] === exactPoints
        ) {
            recs.push(rule.recommendation);
        }
    });

    if (recs.length === 0) {
        recs.push(RECOMMENDATIONS.default);
    }

    return recs;
}

/*****************************************************
 * CLEAR FIELDS
 *****************************************************/
document.getElementById("clearBtn").onclick = () => {
    location.reload();
};

/*****************************************************
 * DOWNLOAD REPORT
 *****************************************************/
document.getElementById("downloadBtn").onclick = () => {
    const resultsText = document.getElementById("results").innerText;

    const blob = new Blob([resultsText], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = "Reporte_EVCH.txt";
    link.click();
};


function validateNumericInput(q, value) {
    if (value === "" || isNaN(value)) {
        return `${q.label}: Por favor ingrese un número válido.`;
    }

    const val = Number(value);

    if (q.range) {
        if (val < q.range.min || val > q.range.max) {
            return `${q.label}: Debe estar entre ${q.range.min} y ${q.range.max} ${q.unit || ""}.`;
        }
    }

    return null; // Valid
}