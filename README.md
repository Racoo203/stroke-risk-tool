# 🧠 Evaluación Clínica EVCH  
**Herramienta de Screening Aditivo para Riesgo de Evento Vascular Cerebral Hemorrágico**

---

## 📌 Descripción General

Este proyecto implementa una **aplicación web clínica de screening** para estimar el **riesgo relativo de EVCH (Evento Vascular Cerebral Hemorrágico)** a partir de un **modelo aditivo explícito**, basado en factores clínicos, demográficos y antecedentes médicos.

⚠️ **Importante**:  
Esta herramienta **NO es diagnóstica**, no sustituye la evaluación médica profesional y debe utilizarse únicamente como **apoyo para detección y estratificación inicial de riesgo**.

---

## 🎯 Objetivos del Proyecto

- Proveer una **estimación cuantitativa de riesgo** basada en reglas clínicas transparentes.
- Mantener **trazabilidad total** entre:
  - Respuestas del usuario  
  - Puntaje asignado  
  - Clasificación final de riesgo  
- Separar claramente:
  - **Modelo de datos**
  - **Lógica de scoring**
  - **Motor de recomendaciones**
  - **Interfaz de usuario**

---

## 🧩 Estructura del Proyecto

```text
├── index.html             # Estructura principal de la aplicación
├── styles.css             # Estilos y diseño visual
├── app.js                 # Lógica de la aplicación (render, scoring, UI)
├── risk_model.json        # Definición del modelo de riesgo (preguntas y puntajes)
├── recommendations.json   # Motor declarativo de recomendaciones clínicas
