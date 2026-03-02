let MODEL;

fetch("risk_model.json")
  .then(r => r.json())
  .then(data => {
    MODEL = data;
    renderForm();
  });

function renderForm() {
  const form = document.getElementById("riskForm");
  const categories = {};

  MODEL.questions.forEach(q => {
    categories[q.category] ||= [];
    categories[q.category].push(q);
  });

  Object.entries(categories).forEach(([cat, questions]) => {
    const fs = document.createElement("fieldset");
    const lg = document.createElement("legend");
    lg.textContent = cat;
    fs.appendChild(lg);

    questions.forEach(q => {
      const label = document.createElement("label");
      label.textContent = q.label;

      let input;
      if (q.type === "numeric") {
        input = document.createElement("input");
        input.type = "number";
      } else {
        input = document.createElement("select");
        Object.entries(q.options).forEach(([k, v]) => {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = k;
          if (v === 1) opt.selected = true;
          input.appendChild(opt);
        });
      }

      input.id = q.id;
      fs.append(label, input);
    });

    form.appendChild(fs);
  });
}

document.getElementById("calculateBtn").onclick = () => {
  let total = 0;
  let details = [];

  MODEL.questions.forEach(q => {
    const el = document.getElementById(q.id);
    let points = 0;

    if (q.type === "numeric") {
      const val = Number(el.value);
      if (isNaN(val)) return;

      q.thresholds.forEach(t => {
        if ((t.max !== undefined && val <= t.max) ||
            (t.min !== undefined && val >= t.min)) {
          points = t.points;
        }
      });
    } else {
      points = Number(el.value);
    }

    total += points;
    details.push(`${q.label}: ${points} puntos`);
  });

  document.getElementById("results").hidden = false;
  document.getElementById("scoreBadge").textContent = `Puntaje Total: ${total}`;
  document.getElementById("riskDetails").innerHTML =
    details.map(d => `<li>${d}</li>`).join("");

  const recs = document.getElementById("recommendations");
  recs.innerHTML = total === MODEL.questions.length
    ? "<li>Continúe manteniendo hábitos saludables.</li>"
    : "<li>Evaluación médica recomendada según factores detectados.</li>";
};

document.getElementById("clearBtn").onclick = () => location.reload();

document.getElementById("downloadBtn").onclick = () => {
  const text = document.getElementById("results").innerText;
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "EVCH_reporte.txt";
  a.click();
};