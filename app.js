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
            const label = document.createElement("label");
            label.setAttribute("for", q.id);
            label.textContent = q.label;

            let input;

            if (q.type === "numeric") {
                input = document.createElement("input");
                input.type = "number";
                input.placeholder = "Ingrese un valor";
                input.required = true;
                input.step = "1";

                /* Field-specific constraints */
                if (q.id === "pas") {
                    input.min = 50;
                    input.max = 300;
                    input.placeholder = "mmHg (50–300)";
                }

                if (q.id === "pad") {
                    input.min = 25;
                    input.max = 200;
                    input.placeholder = "mmHg (25–200)";
                }

                if (q.id === "glucosa") {
                    input.min = 40;
                    input.max = 600;
                    input.placeholder = "mg/dL (40–600)";
                }

                if (q.id === "edad") {
                    input.min = 0;
                    input.max = 120;
                    input.placeholder = "años (0–120)";
                }
            } else {
                input = document.createElement("select");
                Object.entries(q.options).forEach(([text, value]) => {
                    const opt = document.createElement("option");
                    opt.value = value;
                    opt.textContent = text;
                    if (value === 1) opt.selected = true; // lowest-risk default
                    input.appendChild(opt);
                });
            }

            input.id = q.id;
            fieldset.appendChild(label);
            fieldset.appendChild(input);
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

    MODEL.questions.forEach(q => {
        const el = document.getElementById(q.id);
        let points = 0;
        let rawValue = null;

        if (q.type === "numeric") {
            const val = Number(el.value);
            if (isNaN(val)) return;

            points = scoreNumeric(val, q.thresholds);
        } else {
            rawValue = el.options[el.selectedIndex].text;
            points = Number(el.value);
        }

        rawInputs[q.id] = rawValue;
        pointMap[q.id] = points;
        totalScore += points;

        breakdown.push({
            label: q.label,
            value: rawValue,
            points
        });
    });

    if (validationErrors.length > 0) {
        alert(
            "Errores en los datos ingresados:\n\n" +
            validationErrors.join("\n")
        );
        return; // stop calculation
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

    scoreBadge.textContent = `Puntaje Total EVCH: ${totalScore}`;

    detailsList.innerHTML = breakdown
        .map(
            b =>`<li><strong>${b.label}:</strong> ${b.value} → ${b.points} puntos</li>`
        )
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
    if (isNaN(value)) {
        return `${q.label}: valor no numérico.`;
    }

    if (q.id === "pas" && (value < 50 || value > 300)) {
        return `${q.label}: debe estar entre 50 y 300 mmHg.`;
    }

    if (q.id === "glucosa" && (value < 40 || value > 600)) {
        return `${q.label}: debe estar entre 40 y 600 mg/dL.`;
    }

    if (q.id === "edad" && (value < 0 || value > 120)) {
        return `${q.label}: debe estar entre 0 y 120 años.`;
    }

    return null; // valid
}