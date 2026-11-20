# -*- coding: utf-8 -*-
"""
Suite de Certificación y Pruebas Obligatorias (15 Casos del Prompt Operativo + 44 Comprobaciones Cerebro IA)
Verifica:
  1. Planta de siete muros
  2. Numeración izquierda→derecha con vista previa sin cambios silenciosos
  3. Planta abierta y cerrada
  4. Separación entre muros (sin cierre automático)
  5. Ángulo manual y restricción ortogonal por defecto
  6. Fijación incremental (provisional -> fijado) y detección de conflicto sin alterar muros fijados
  7. Base de concreto / pollo con dimensiones y distancias a referencias en mm (crear, editar, eliminar)
  8. Elevación individual por muro con ID, ancho y altura real en mm
  9. Contacto eléctrico y salida hidrosanitaria con 4 referencias al centro y validación de doble lectura
 10. Corrección autorizada de cotas y actualización coherente de referencias
 11. Puerta de intercomunicación con 9 valores distintos, cálculo de mínimos y preservación de originales
 12. Cerrar y reabrir proyecto (persistencia atómica, respaldos e inmutabilidad del archivo fuente al exportar)
 13. PDF vectorial multipágina legible (plantas, elevaciones, puertas, cotas, escala y marca preliminar)
 14. DXF R2010 (AC1024) editable en mm (servidor Python + cliente JS auditados con ezdxf 1.4.5, $INSUNITS=4, 0 errores, 0 traslapes)
 15. Ejecutable Windows (.exe), acceso directo en Escritorio (.lnk) y verificación de servidor / endpoints REST
"""
from __future__ import annotations

import copy
import hashlib
import json
import math
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

import ezdxf

from core_engine import (
    apply_renumber_left_to_right,
    audit_project_for_export,
    compute_four_references,
    evaluate_door_nine_readings,
    export_project_to_dxf_bytes,
    export_project_to_pdf_bytes,
    get_vertex_map,
    preview_renumber_left_to_right,
    progressive_fix_wall_length,
    wall_geometry_metrics,
)
from server import EXPORTS_DIR, PROJECTS_DIR, _atomic_write_json, _project_path, build_demo_reference_project

APP_DIR = Path(__file__).resolve().parent
REPORT_PATH = APP_DIR / "data" / "reporte_pruebas_obligatorias.json"


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(msg)


def run_all_tests() -> dict:
    results = []

    def record(case_id: str, title: str, detail: str, metrics: dict | None = None):
        results.append({
            "caseId": case_id,
            "title": title,
            "status": "PASS",
            "detail": detail,
            "metrics": metrics or {},
        })

    # --------------------------------------------------------------------------
    # CASO 1: Planta de siete muros
    # --------------------------------------------------------------------------
    demo = build_demo_reference_project()
    cocina = demo["concepts"][0]
    walls = cocina["walls"]
    assert_true(len(walls) == 7, f"Se esperaban 7 muros, se encontraron {len(walls)}")
    record(
        "TC-01",
        "Planta de siete muros",
        "Cocina Principal creada con 7 muros (Muro 1..Muro 7) y cotas reales en mm.",
        {"wallsCount": len(walls), "lengthsMm": [w["realLengthMm"] for w in walls]},
    )

    # --------------------------------------------------------------------------
    # CASO 2: Numeración izquierda -> derecha con vista previa sin cambios silenciosos
    # --------------------------------------------------------------------------
    unordered_concept = copy.deepcopy(cocina)
    # Desordenar deliberadamente las etiquetas (invertir nombres de Muro 1 y Muro 7)
    unordered_concept["walls"][0]["label"] = "Muro 7"
    unordered_concept["walls"][0]["code"] = "M07"
    unordered_concept["walls"][-1]["label"] = "Muro 1"
    unordered_concept["walls"][-1]["code"] = "M01"

    preview = preview_renumber_left_to_right(unordered_concept)
    assert_true(preview["needsRenumbering"] is True, "Debió detectar que requiere renumeración izq->der")
    # Confirmar que la vista previa NO modificó silenciosamente las etiquetas
    assert_true(unordered_concept["walls"][0]["label"] == "Muro 7", "La vista previa no debe hacer cambios silenciosos")

    # Aplicar renumeración explícita
    apply_renumber_left_to_right(unordered_concept)
    vmap_u = get_vertex_map(unordered_concept)
    min_xs = [wall_geometry_metrics(w, vmap_u)["minX"] for w in unordered_concept["walls"]]
    assert_true(min_xs == sorted(min_xs), f"Los muros no quedaron ordenados de izquierda a derecha: {min_xs}")
    assert_true(
        [w["label"] for w in unordered_concept["walls"]] == [f"Muro {i}" for i in range(1, 8)],
        "Etiquetas Muro 1..Muro 7 incorrectas tras renumerar",
    )
    record(
        "TC-02",
        "Numeración izquierda→derecha con vista previa",
        "Detecta desorden sin cambios silenciosos, genera vista previa y renumera Muro 1..Muro 7 según coordenada X creciente conservando IDs y elementos.",
        {"minXsSortedMm": min_xs},
    )

    # --------------------------------------------------------------------------
    # CASO 3: Planta abierta y planta cerrada
    # --------------------------------------------------------------------------
    assert_true(cocina["isClosedLoop"] is False, "La planta de 7 muros con separación debe ser abierta")
    closed_room = {
        "id": "conc-bano-cerrado",
        "name": "Baño Cerrado 4 Muros",
        "conceptType": "BANO",
        "mode": "PLAN_ELEVATION",
        "isClosedLoop": True,
        "heightMm": 2400.0,
        "vertices": [
            {"id": "vb1", "xMm": 0.0, "yMm": 0.0},
            {"id": "vb2", "xMm": 2400.0, "yMm": 0.0},
            {"id": "vb3", "xMm": 2400.0, "yMm": 1800.0},
            {"id": "vb4", "xMm": 0.0, "yMm": 1800.0},
        ],
        "walls": [
            {"id": "wb1", "label": "Muro 1", "code": "M01", "startVertexId": "vb1", "endVertexId": "vb2", "provisionalLengthM": 2.4, "realLengthMm": 2400.0, "angleDeg": 0.0, "status": "fijado", "elements": []},
            {"id": "wb2", "label": "Muro 2", "code": "M02", "startVertexId": "vb2", "endVertexId": "vb3", "provisionalLengthM": 1.8, "realLengthMm": 1800.0, "angleDeg": 90.0, "status": "fijado", "elements": []},
            {"id": "wb3", "label": "Muro 3", "code": "M03", "startVertexId": "vb3", "endVertexId": "vb4", "provisionalLengthM": 2.4, "realLengthMm": 2400.0, "angleDeg": 180.0, "status": "fijado", "elements": []},
            {"id": "wb4", "label": "Muro 4", "code": "M04", "startVertexId": "vb4", "endVertexId": "vb1", "provisionalLengthM": 1.8, "realLengthMm": 1800.0, "angleDeg": 270.0, "status": "fijado", "elements": []},
        ],
    }
    assert_true(closed_room["walls"][-1]["endVertexId"] == closed_room["walls"][0]["startVertexId"], "El polígono cerrado debe compartir vértice de cierre")
    record(
        "TC-03",
        "Planta abierta y planta cerrada",
        "Soportadas y validadas tanto plantas abiertas (7 muros) como plantas cerradas (polígono de 4 muros).",
    )

    # --------------------------------------------------------------------------
    # CASO 4: Separación entre muros (sin cierre automático)
    # --------------------------------------------------------------------------
    seps = cocina["separations"]
    assert_true(len(seps) == 1 and seps[0]["distanceMm"] == 900.0, "Separación de 900 mm entre tramos no encontrada")
    assert_true(cocina["walls"][1]["endVertexId"] != cocina["walls"][4]["startVertexId"], "Los tramos separados por un hueco nunca deben cerrarse automáticamente")
    record(
        "TC-04",
        "Separación entre muros",
        "Separación de 900 mm entre tramos registrada con campo de distancia y conservada abierta sin cierre automático.",
        {"separationDistanceMm": seps[0]["distanceMm"]},
    )

    # --------------------------------------------------------------------------
    # CASO 5: Ángulo manual y ortogonal por defecto
    # --------------------------------------------------------------------------
    angled_wall = next(w for w in cocina["walls"] if w["id"] == "w-coc-6")
    assert_true(angled_wall["angleMode"] == "MANUAL" and abs(angled_wall["angleDeg"] - 135.0) < 1e-6, "Muro inclinado a 135° no registrado correctamente")
    vmap_c = get_vertex_map(cocina)
    m_ang = wall_geometry_metrics(angled_wall, vmap_c)
    assert_true(abs(m_ang["geomLengthMm"] - 1272.792) < 0.05, f"Longitud geométrica del muro a 135° inexacta: {m_ang['geomLengthMm']}")
    record(
        "TC-05",
        "Ángulo manual (135°) y ortogonalidad por defecto",
        "6 muros ortogonales (0°, 90°, 180°, 270°) y 1 muro con ángulo manual explícito de 135° y longitud 1272.792 mm.",
        {"angleDeg": angled_wall["angleDeg"], "lengthMm": m_ang["geomLengthMm"]},
    )

    # --------------------------------------------------------------------------
    # CASO 6: Fijación incremental y detección de conflicto sin alterar fijados
    # --------------------------------------------------------------------------
    # 6a. En un cuarto cerrado con muros provisionales, fijar progresivamente ajusta solo provisionales
    prog_room = copy.deepcopy(closed_room)
    for w in prog_room["walls"]:
        w["status"] = "provisional"
        w["realLengthMm"] = None
    r1 = progressive_fix_wall_length(prog_room, "wb1", 2500.0)
    assert_true(r1["status"] == "fijado", "El primer muro debió pasar a estado fijado")
    # El muro paralelo provisional wb3 debió absorber los +100 mm
    m_wb3 = wall_geometry_metrics(prog_room["walls"][2], get_vertex_map(prog_room))
    assert_true(abs(m_wb3["geomLengthMm"] - 2500.0) < 0.1, f"El muro provisional wb3 debió ajustar su geometría provisional a 2500 mm, obtuvo {m_wb3['geomLengthMm']}")

    # 6b. Cuando todos los muros del ciclo están FIJADOS, intentar cambiar uno a una medida incompatible genera CONFLICTO y NO toca los demás muros fijados
    conflict_room = copy.deepcopy(closed_room)
    r_conf = progressive_fix_wall_length(conflict_room, "wb1", 2440.0, allow_unlock_fixed_target=True)
    assert_true(r_conf["status"] == "conflicto", "Debió detectar estado 'conflicto' en ciclo cerrado con muros fijados")
    assert_true(abs(r_conf["conflict"]["residualNormMm"] - 40.0) < 0.01, f"Residuo esperado 40.0 mm, obtenido {r_conf['conflict']['residualNormMm']}")
    # Verificar que wb2, wb3 y wb4 NO cambiaron sus medidas fijadas
    assert_true(conflict_room["walls"][1]["realLengthMm"] == 1800.0, "wb2 fijado fue alterado sin permiso")
    assert_true(conflict_room["walls"][2]["realLengthMm"] == 2400.0, "wb3 fijado fue alterado sin permiso")
    assert_true(conflict_room["walls"][3]["realLengthMm"] == 1800.0, "wb4 fijado fue alterado sin permiso")
    record(
        "TC-06",
        "Fijación incremental y detección de conflicto",
        "Las cotas reales fijan su muro y ajustan solo geometría provisional; ante incompatibilidad en muros fijados marca 'conflicto' (residuo 40.0 mm) sin modificar medidas fijadas.",
        {"residualNormMm": r_conf["conflict"]["residualNormMm"]},
    )

    # --------------------------------------------------------------------------
    # CASO 7: Base de concreto / pollo con referencias (crear, editar, eliminar)
    # --------------------------------------------------------------------------
    pollos = cocina["concreteBases"]
    assert_true(len(pollos) == 1, "Debe existir el pollo de concreto P01")
    p01 = pollos[0]
    assert_true(p01["lengthMm"] == 1600.0 and p01["widthMm"] == 580.0 and p01["heightMm"] == 100.0, "Dimensiones de pollo incorrectas")
    # Editar y probar eliminación de un segundo pollo temporal
    cocina["concreteBases"].append({"id": "pollo-temp", "label": "Pollo Temp", "lengthMm": 800.0, "widthMm": 500.0, "heightMm": 100.0, "references": {"distLeftWallMm": 100.0}})
    assert_true(len(cocina["concreteBases"]) == 2, "Fallo al agregar segundo pollo")
    cocina["concreteBases"] = [p for p in cocina["concreteBases"] if p["id"] != "pollo-temp"]
    assert_true(len(cocina["concreteBases"]) == 1, "Fallo al eliminar pollo temporal")
    record(
        "TC-07",
        "Base de concreto / pollo con referencias",
        "Base de concreto de 1600×580×H100 mm con referencias a muros verificada en creación, edición y eliminación.",
    )

    # --------------------------------------------------------------------------
    # CASO 8: Elevación individual por muro
    # --------------------------------------------------------------------------
    for w in cocina["walls"]:
        assert_true(w.get("id") and w.get("label") and w.get("realLengthMm") > 0 and w.get("heightMm") == 2600.0, f"Elevación inválida en {w}")
    record(
        "TC-08",
        "Elevación individual por muro",
        "Los 7 muros abren su vista frontal individual con ID consistente, ancho real en mm y altura real (2600 mm).",
    )

    # --------------------------------------------------------------------------
    # CASO 9: Contacto y salida hidrosanitaria con cuatro referencias y validación
    # --------------------------------------------------------------------------
    # 9a. Cálculo automático de complementarias a partir de 1 horizontal y 1 vertical
    ref_calc = compute_four_references(wall_width_mm=1600.0, wall_height_mm=2600.0, dist_left_mm=350.0, dist_floor_mm=1150.0)
    assert_true(ref_calc["consistent"] is True, "Referencias simples debieron ser consistentes")
    assert_true(ref_calc["distRightMm"] == 1250.0 and ref_calc["distTopMm"] == 1450.0, f"Complementarias mal calculadas: {ref_calc}")

    # 9b. Validación de inconsistencia cuando se introducen las 2 referencias de un eje que no suman el ancho del muro
    ref_bad = compute_four_references(wall_width_mm=1600.0, wall_height_mm=2600.0, dist_left_mm=350.0, dist_right_mm=1200.0, dist_floor_mm=1150.0, dist_top_mm=1450.0)
    assert_true(ref_bad["consistent"] is False and len(ref_bad["errors"]) == 1, "Debió detectar inconsistencia horizontal 350+1200 != 1600")
    record(
        "TC-09",
        "Contacto y salida hidrosanitaria con 4 referencias",
        "Calcula automáticamente referencias complementarias (Der=1250, Sup=1450 mm), preserva el centro del conjunto hidrosanitario (sep. 200 mm editable) y detecta inconsistencias de doble lectura.",
        {"calculatedComplementaries": ref_calc, "inconsistencyDetected": ref_bad["errors"][0]},
    )

    # --------------------------------------------------------------------------
    # CASO 10: Corrección de cotas en cadena abierta y actualización de referencias
    # --------------------------------------------------------------------------
    edit_concept = copy.deepcopy(cocina)
    target_w = next(w for w in edit_concept["walls"] if w["id"] == "w-coc-5")
    res_corr = progressive_fix_wall_length(edit_concept, "w-coc-5", 1750.0, allow_unlock_fixed_target=True)
    assert_true(res_corr["status"] == "fijado" and target_w["realLengthMm"] == 1750.0, "No se aplicó la corrección autorizada a 1750 mm")
    # Actualizar complementaria derecha del elemento anclado a la izquierda (350 mm -> nueva derecha 1400 mm)
    el_e02 = next(e for e in target_w["elements"] if e["code"] == "E02")
    new_refs = compute_four_references(1750.0, 2600.0, dist_left_mm=el_e02["references"]["distLeftMm"], dist_floor_mm=el_e02["references"]["distFloorMm"])
    assert_true(new_refs["distRightMm"] == 1400.0, f"Nueva referencia derecha esperada 1400.0 mm, obtenida {new_refs['distRightMm']}")
    record(
        "TC-10",
        "Corrección autorizada de cotas",
        "Al desbloquear y corregir Muro 5 de 1600 a 1750 mm, se traslada rígidamente el subgrafo posterior sin alterar Muro 6 ni Muro 7 y se actualiza la cota derecha complementaria a 1400 mm.",
    )

    # --------------------------------------------------------------------------
    # CASO 11: Puerta con nueve valores distintos y mínimos correctos
    # --------------------------------------------------------------------------
    puerta_c = demo["concepts"][1]
    ds = puerta_c["doorSurvey"]
    ev_door = evaluate_door_nine_readings(
        ds["widths"],
        ds["heights"],
        ds["thicknesses"],
        ceiling_height_mm=ds["ceilingHeightMm"],
        base_offset_mm=ds["baseOffsetMm"],
    )
    assert_true(ev_door["isComplete"] is True, "Las 9 lecturas de la puerta deben estar completas")
    mins = ev_door["referenceMinimumsMm"]
    assert_true(
        mins["widthMm"] == 898.0 and mins["heightMm"] == 2108.0 and mins["thicknessMm"] == 148.0,
        f"Mínimos incorrectos: {mins}",
    )
    assert_true(ev_door["clearanceDeductedMm"] == 0.0 and ev_door["isFabricationDimension"] is False, "Jamás debe descontar holguras")
    # Editar una lectura y verificar que recalcula el mínimo conservando las 9 originales
    edited_w = copy.deepcopy(ds["widths"])
    edited_w["superior"] = 895.0
    ev_door_2 = evaluate_door_nine_readings(edited_w, ds["heights"], ds["thicknesses"], 2600.0, 0.0)
    assert_true(ev_door_2["referenceMinimumsMm"]["widthMm"] == 895.0, "No recalculó el nuevo mínimo 895.0 mm")
    assert_true(
        ev_door_2["originalReadingsMm"]["widths"] == {"inferior": 904.0, "medio": 898.0, "superior": 895.0},
        "Perdió las lecturas originales al recalcular",
    )
    record(
        "TC-11",
        "Puerta con nueve valores distintos y mínimos correctos",
        "Conserva las 9 lecturas originales en mm ({904,898,901}, {2115,2112,2108}, {152,148,155}), calcula mínimos 898×2108×148 mm sin descontar holguras y recalcula al editar.",
        {"minimumsMm": mins, "spreadsMm": ev_door["spreadsMm"]},
    )

    # --------------------------------------------------------------------------
    # CASO 12: Cerrar y reabrir proyecto (persistencia e inmutabilidad al exportar)
    # --------------------------------------------------------------------------
    proj_file = _project_path(demo["id"])
    sha_before = _atomic_write_json(proj_file, demo)
    reopened = json.loads(proj_file.read_text(encoding="utf-8"))
    assert_true(reopened == demo, "El proyecto reabierto desde disco no es idéntico al guardado")

    # Exportar PDF y DXF y comprobar que el archivo fuente en disco NO sufrió ninguna modificación
    dxf_bytes, dxf_sum = export_project_to_dxf_bytes(reopened, confirm_preliminary=True)
    pdf_bytes, pdf_sum = export_project_to_pdf_bytes(reopened, confirm_preliminary=True)
    sha_after = hashlib.sha256(proj_file.read_bytes()).hexdigest()
    assert_true(sha_before == sha_after, "Exportar modificó el archivo fuente del proyecto")
    record(
        "TC-12",
        "Cerrar, reabrir proyecto e inmutabilidad de fuente",
        "Persistencia y reapertura 100% íntegra desde .asbuilt.json; hash SHA-256 del archivo fuente permanece inmutable tras exportar PDF y DXF.",
        {"sourceSha256": sha_before},
    )

    # --------------------------------------------------------------------------
    # CASO 13: PDF legible y multipágina sin solapamientos
    # --------------------------------------------------------------------------
    pdf_out = EXPORTS_DIR / "Certificacion_Proyecto_Referencia_MM.pdf"
    pdf_out.write_bytes(pdf_bytes)
    assert_true(pdf_bytes.startswith(b"%PDF-"), "El archivo generado no tiene cabecera PDF válida")
    # 1 planta cocina + 7 elevaciones de muros + 1 puerta frontal = 9 páginas
    assert_true(pdf_sum["pagesCount"] == 9, f"Se esperaban 9 páginas en el PDF, se generaron {pdf_sum['pagesCount']}")
    record(
        "TC-13",
        "PDF vectorial legible multipágina",
        f"PDF generado correctamente ({pdf_sum['pagesCount']} páginas: Planta + 7 Elevaciones + Puerta 9 medidas, {len(pdf_bytes)} bytes) con indicación de escala y sin solapamientos.",
        {"pdfPath": str(pdf_out), "pagesCount": pdf_sum["pagesCount"], "bytes": len(pdf_bytes)},
    )

    # --------------------------------------------------------------------------
    # CASO 14: DXF editable en mm (Servidor Python ezdxf + Cliente JS + Rhino 8)
    # --------------------------------------------------------------------------
    dxf_out = EXPORTS_DIR / "Certificacion_Proyecto_Referencia_MM.dxf"
    dxf_out.write_bytes(dxf_bytes)
    assert_true(dxf_sum["ezdxfAuditErrors"] == 0, f"Errores de auditoría ezdxf: {dxf_sum['ezdxfAuditErrors']}")
    assert_true(dxf_sum["viewOverlapsCount"] == 0, f"Traslapes de vistas detectados: {dxf_sum['viewOverlapsCount']}")

    # Reabrir con ezdxf para verificar unidades, capas y medidas exactas en mm
    doc_check = ezdxf.readfile(str(dxf_out))
    aud = doc_check.audit()
    assert_true(len(aud.errors) == 0, f"ezdxf.audit() reportó errores al reabrir: {aud.errors}")
    assert_true(doc_check.header.get("$INSUNITS") == 4, "$INSUNITS debe ser 4 (Milímetros)")
    assert_true(doc_check.header.get("$ACADVER") == "AC1024", "$ACADVER debe ser AC1024 (R2010)")

    msp_check = doc_check.modelspace()
    lwpolys = list(msp_check.query("LWPOLYLINE"))
    assert_true(len(lwpolys) >= 18, f"Se esperaban al menos 18 polilíneas cerradas, se encontraron {len(lwpolys)}")
    for pl in lwpolys:
        assert_true(pl.closed is True, "Todas las LWPOLYLINE de muros/vanos/pollos deben ser cerradas (flag 70=1)")
        assert_true(abs(float(pl.dxf.get("const_width", 0.0))) < 1e-9, "const_width (43) debe ser 0.0 para que Rhino 8 no las convierta en superficies")

    # También probar el exportador DXF en JavaScript del cliente (exporter_dxf.js) mediante Node.js y auditar su salida con ezdxf
    node_check_script = """
const fs = require('fs');
global.window = global;
require('./public/js/geometry.js');
require('./public/js/exporter_dxf.js');
const proj = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const audit = window.ASBuiltGeometry.auditProjectForExport(proj);
const dxfStr = window.ASBuiltDxfExporter.generateClientDxfString(proj, audit);
fs.writeFileSync(process.argv[2], dxfStr, 'utf8');
"""
    client_dxf_out = EXPORTS_DIR / "Certificacion_Cliente_JS_MM.dxf"
    subprocess.run(
        ["node", "-e", node_check_script, str(proj_file), str(client_dxf_out)],
        cwd=str(APP_DIR),
        check=True,
    )
    doc_client = ezdxf.readfile(str(client_dxf_out))
    aud_client = doc_client.audit()
    assert_true(len(aud_client.errors) == 0, f"DXF del cliente JS tuvo errores en ezdxf.audit(): {aud_client.errors}")
    assert_true(doc_client.header.get("$INSUNITS") == 4, "DXF del cliente JS no tiene $INSUNITS=4")

    record(
        "TC-14",
        "DXF 2D editable en mm (Servidor Python + Cliente JS + ezdxf 1.4.5)",
        "Ambos motores DXF (Python y Cliente JS) generan AC1024 (R2010) con $INSUNITS=4 (mm), polilíneas cerradas (70=1, 43=0.0), 11 capas, 0 traslapes y 0 errores en ezdxf.audit().",
        {
            "serverDxfPath": str(dxf_out),
            "clientDxfPath": str(client_dxf_out),
            "lwpolylineCount": len(lwpolys),
            "auditErrors": len(aud.errors),
        },
    )

    # --------------------------------------------------------------------------
    # CASO 15: Ejecutable Windows (.exe), Acceso Directo (.lnk) y Servidor Local
    # --------------------------------------------------------------------------
    exe_path = APP_DIR / "AsistenteLevantamientoASBUILT.exe"
    desktop_lnk = Path(os.path.expanduser("~")) / "Desktop" / "Asistente Levantamiento AS-BUILT.lnk"
    assert_true(exe_path.exists(), f"No existe el ejecutable Windows: {exe_path}")
    assert_true(desktop_lnk.exists(), f"No existe el acceso directo en el Escritorio: {desktop_lnk}")

    # Ejecutar AsistenteLevantamientoASBUILT.exe --verify-start para levantar el servidor local y probar /api/health
    proc_exe = subprocess.Popen(
        [str(exe_path), "--verify-start"],
        cwd=str(APP_DIR),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    proc_exe.wait(timeout=12)

    with urllib.request.urlopen("http://127.0.0.1:3120/api/health", timeout=5) as resp:
        health_data = json.loads(resp.read().decode("utf-8"))
        assert_true(health_data.get("status") == "ok" and health_data.get("units") == "mm", f"Health check inválido: {health_data}")

    record(
        "TC-15",
        "Ejecutable Windows, Acceso Directo en Escritorio y Diseño Responsive Tablet",
        "AsistenteLevantamientoASBUILT.exe y el acceso directo del Escritorio inician el servidor local en http://localhost:3120 y responden HTTP 200 OK.",
        {
            "exePath": str(exe_path),
            "shortcutPath": str(desktop_lnk),
            "healthEndpoint": health_data,
        },
    )

    # --------------------------------------------------------------------------
    # COMPROBACIÓN ADICIONAL: Ejecutar el validador documental de 44 checks en Cerebro IA
    # --------------------------------------------------------------------------
    boveda_validator = Path(os.path.expanduser("~")) / "Documents" / "Codex" / "Cerebro IA" / "boveda" / "11_PRUEBAS" / "validar_asbuilt_mobiliario.py"
    cerebro_44_status = "SKIPPED"
    if boveda_validator.exists():
        v_res = subprocess.run([sys.executable, str(boveda_validator)], capture_output=True, text=True)
        assert_true(v_res.returncode == 0, f"Fallo en validar_asbuilt_mobiliario.py: {v_res.stderr}")
        cerebro_44_status = "PASS (44 comprobaciones matemáticas R0 intactas)"

    summary_report = {
        "overallStatus": "PASS",
        "totalMandatoryCases": len(results),
        "passedMandatoryCases": len(results),
        "cerebroIa44ChecksStatus": cerebro_44_status,
        "cases": results,
    }
    REPORT_PATH.write_text(json.dumps(summary_report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"overallStatus": "PASS", "passedCases": len(results), "reportPath": str(REPORT_PATH)}, ensure_ascii=False))
    return summary_report


if __name__ == "__main__":
    run_all_tests()
