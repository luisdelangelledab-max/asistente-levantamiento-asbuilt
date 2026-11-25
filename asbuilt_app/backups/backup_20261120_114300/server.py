# -*- coding: utf-8 -*-
"""
Servidor Local y API REST — Aplicación AS-BUILT para Levantamientos de Mobiliario
Sirve la PWA / interfaz web en http://localhost:3120 y gestiona persistencia atómica,
respaldos locales y exportación certificada de PDF y DXF (Rhino 8 / ezdxf 1.4.5).
"""
from __future__ import annotations

import copy
import datetime
import hashlib
import json
import os
import re
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
import uvicorn

from core_engine import (
    CEREBRO_PRESETS,
    CONCEPT_TYPES,
    DXF_LAYERS_SPEC,
    apply_renumber_left_to_right,
    audit_project_for_export,
    compute_four_references,
    evaluate_door_nine_readings,
    export_project_to_dxf_bytes,
    export_project_to_pdf_bytes,
    new_id,
    now_iso,
    preview_renumber_left_to_right,
    progressive_fix_wall_length,
)

BASE_DIR = Path(__file__).resolve().parent
PUBLIC_DIR = BASE_DIR / "public"
DATA_DIR = BASE_DIR / "data"
PROJECTS_DIR = DATA_DIR / "projects"
BACKUPS_DIR = DATA_DIR / "backups"
EXPORTS_DIR = DATA_DIR / "exports"

for d in (PUBLIC_DIR, DATA_DIR, PROJECTS_DIR, BACKUPS_DIR, EXPORTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="CODEX Asistente Levantamiento AS-BUILT para Mobiliario",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    if not request.url.path.startswith("/api/exports/download"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9_\-]+", "_", str(name or "proyecto")).strip("_")
    return cleaned or "proyecto"


def _project_path(project_id: str) -> Path:
    safe_id = _safe_filename(project_id)
    return PROJECTS_DIR / f"{safe_id}.asbuilt.json"


def _atomic_write_json(target: Path, data: Dict[str, Any]) -> str:
    import time
    payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    sha256_hex = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    tmp = target.with_suffix(f"{target.suffix}.tmp.{os.getpid()}.{time.time_ns()}")
    tmp.write_text(payload, encoding="utf-8", newline="\n")
    for attempt in range(6):
        try:
            tmp.replace(target)
            break
        except (PermissionError, OSError):
            time.sleep(0.04 * (attempt + 1))
    else:
        try:
            with open(target, "w", encoding="utf-8") as f:
                f.write(payload)
            if tmp.exists():
                tmp.unlink(missing_ok=True)
        except Exception:
            pass
    return sha256_hex


def build_demo_reference_project() -> Dict[str, Any]:
    """
    Crea un proyecto de referencia completo que cubre los casos obligatorios:
    - Cocina con 7 muros (orden izquierda->derecha Muro 1..Muro 7), separación entre tramos,
      ángulo manual, pollo de concreto con referencias a muros, elevaciones con contactos
      eléctricos y conjunto hidrosanitario posicionados por 4 referencias.
    - Baño cerrado de 4 muros con sardinel, salida hidrosanitaria y contacto GFCI.
    - Puerta de intercomunicación con 9 lecturas distintas y mínimos calculados sin holguras.
    """
    proj_id = "proy-asbuilt-referencia-2026"
    # Concepto 1: Cocina de 7 muros (con separación entre tramos y un tramo con ángulo manual 135°)
    v1, v2, v3, v4, v5, v6, v7, v8, v9 = [f"v-coc-{i}" for i in range(1, 10)]
    w1, w2, w3, w4, w5, w6, w7 = [f"w-coc-{i}" for i in range(1, 8)]

    cocina_vertices = [
        {"id": v1, "xMm": 0.0, "yMm": 2800.0},
        {"id": v2, "xMm": 0.0, "yMm": 0.0},
        {"id": v3, "xMm": 1600.0, "yMm": 0.0},
        # Separación / hueco de 900 mm entre v3 (1600,0) y v4 (2500,0)
        {"id": v4, "xMm": 2500.0, "yMm": 0.0},
        {"id": v5, "xMm": 4100.0, "yMm": 0.0},
        {"id": v6, "xMm": 4100.0, "yMm": 1900.0},
        # Tramo en chaflán manual a 135° (longitud 1272.792 mm -> dx=-900, dy=+900)
        {"id": v7, "xMm": 3200.0, "yMm": 2800.0},
        {"id": v8, "xMm": 1800.0, "yMm": 2800.0},
        {"id": v9, "xMm": 1800.0, "yMm": 3300.0},
    ]

    cocina_walls = [
        {
            "id": w1,
            "orderIndex": 1,
            "label": "Muro 1",
            "code": "M01",
            "startVertexId": v1,
            "endVertexId": v2,
            "provisionalLengthM": 2.80,
            "realLengthMm": 2800.0,
            "heightMm": 2600.0,
            "heightMode": "INHERITED",
            "thicknessMm": 150.0,
            "angleDeg": 270.0,
            "angleMode": "ORTHO",
            "outwardNormalSign": 1,
            "status": "fijado",
            "elements": [
                {
                    "id": "el-coc-e01",
                    "code": "E01",
                    "category": "ELECTRICAL",
                    "subType": "CONTACTO_GFCI",
                    "label": "Contacto GFCI Refrigerador",
                    "widthMm": 70.0,
                    "heightMm": 115.0,
                    "gfci": True,
                    "provenance": "MEASURED",
                    "references": {
                        "distLeftMm": 650.0,
                        "distRightMm": 2150.0,
                        "distFloorMm": 1150.0,
                        "distTopMm": 1450.0,
                        "horizontalAnchor": "LEFT",
                        "verticalAnchor": "FLOOR",
                    },
                }
            ],
        },
        {
            "id": w2,
            "orderIndex": 2,
            "label": "Muro 2",
            "code": "M02",
            "startVertexId": v2,
            "endVertexId": v3,
            "provisionalLengthM": 1.60,
            "realLengthMm": 1600.0,
            "heightMm": 2600.0,
            "heightMode": "INHERITED",
            "thicknessMm": 150.0,
            "angleDeg": 0.0,
            "angleMode": "ORTHO",
            "outwardNormalSign": 1,
            "status": "fijado",
            "elements": [],
        },
        {
            "id": w3,
            "orderIndex": 3,
            "label": "Muro 3",
            "code": "M03",
            "startVertexId": v7,
            "endVertexId": v8,
            "provisionalLengthM": 1.40,
            "realLengthMm": 1400.0,
            "heightMm": 2600.0,
            "heightMode": "INHERITED",
            "thicknessMm": 150.0,
            "angleDeg": 180.0,
            "angleMode": "ORTHO",
            "outwardNormalSign": 1,
            "status": "fijado",
            "elements": [],
        },
        {
            "id": w4,
            "orderIndex": 4,
            "label": "Muro 4",
            "code": "M04",
            "startVertexId": v8,
            "endVertexId": v9,
            "provisionalLengthM": 0.50,
            "realLengthMm": 500.0,
            "heightMm": 2600.0,
            "heightMode": "INHERITED",
            "thicknessMm": 120.0,
            "angleDeg": 90.0,
            "angleMode": "ORTHO",
            "outwardNormalSign": 1,
            "status": "fijado",
            "elements": [],
        },
        {
            "id": w5,
            "orderIndex": 5,
            "label": "Muro 5",
            "code": "M05",
            "startVertexId": v4,
            "endVertexId": v5,
            "provisionalLengthM": 1.60,
            "realLengthMm": 1600.0,
            "heightMm": 2600.0,
            "heightMode": "INHERITED",
            "thicknessMm": 150.0,
            "angleDeg": 0.0,
            "angleMode": "ORTHO",
            "outwardNormalSign": 1,
            "status": "fijado",
            "elements": [
                {
                    "id": "el-coc-h01",
                    "code": "H01",
                    "category": "PLUMBING",
                    "subType": "CONJUNTO_TARJA_CONAVI",
                    "label": "Conjunto Tarja (AC+AF+Drenaje)",
                    "isSet": True,
                    "separationAfAcMm": 200.0,
                    "hotOffsetUMm": -100.0,
                    "hotOffsetVMm": 50.0,
                    "coldOffsetUMm": 100.0,
                    "coldOffsetVMm": 50.0,
                    "drainDiameterMm": 50.0,
                    "supplyDiameterMm": 13.0,
                    "widthMm": 220.0,
                    "heightMm": 120.0,
                    "provenance": "MEASURED",
                    "references": {
                        "distLeftMm": 800.0,
                        "distRightMm": 800.0,
                        "distFloorMm": 500.0,
                        "distTopMm": 2100.0,
                        "horizontalAnchor": "LEFT",
                        "verticalAnchor": "FLOOR",
                    },
                },
                {
                    "id": "el-coc-e02",
                    "code": "E02",
                    "category": "ELECTRICAL",
                    "subType": "CONTACTO_GFCI",
                    "label": "Contacto GFCI Cubierta",
                    "widthMm": 70.0,
                    "heightMm": 115.0,
                    "gfci": True,
                    "provenance": "MEASURED",
                    "references": {
                        "distLeftMm": 350.0,
                        "distRightMm": 1250.0,
                        "distFloorMm": 1150.0,
                        "distTopMm": 1450.0,
                        "horizontalAnchor": "LEFT",
                        "verticalAnchor": "FLOOR",
                    },
                },
            ],
        },
        {
            "id": w6,
            "orderIndex": 6,
            "label": "Muro 6",
            "code": "M06",
            "startVertexId": v6,
            "endVertexId": v7,
            "provisionalLengthM": 1.27,
            "realLengthMm": 1272.792,
            "heightMm": 2600.0,
            "heightMode": "INHERITED",
            "thicknessMm": 150.0,
            "angleDeg": 135.0,
            "angleMode": "MANUAL",
            "outwardNormalSign": 1,
            "status": "fijado",
            "elements": [],
        },
        {
            "id": w7,
            "orderIndex": 7,
            "label": "Muro 7",
            "code": "M07",
            "startVertexId": v5,
            "endVertexId": v6,
            "provisionalLengthM": 1.90,
            "realLengthMm": 1900.0,
            "heightMm": 2600.0,
            "heightMode": "INHERITED",
            "thicknessMm": 150.0,
            "angleDeg": 90.0,
            "angleMode": "ORTHO",
            "outwardNormalSign": 1,
            "status": "fijado",
            "elements": [
                {
                    "id": "el-coc-v01",
                    "code": "V01",
                    "category": "WINDOW",
                    "subType": "VENTANA_ESTANDAR",
                    "label": "Ventana sobre tarja",
                    "widthMm": 1000.0,
                    "heightMm": 1100.0,
                    "sillHeightMm": 1100.0,
                    "provenance": "MEASURED",
                    "references": {
                        "distLeftMm": 950.0,
                        "distRightMm": 950.0,
                        "distFloorMm": 1650.0,
                        "distTopMm": 950.0,
                        "horizontalAnchor": "LEFT",
                        "verticalAnchor": "FLOOR",
                    },
                }
            ],
        },
    ]

    # Ordenar y garantizar etiquetas Muro 1..Muro 7 de izquierda a derecha
    cocina_concept = {
        "id": "conc-cocina-7m",
        "name": "Cocina Principal (7 Muros)",
        "conceptType": "COCINA",
        "mode": "PLAN_ELEVATION",
        "isClosedLoop": False,
        "heightMm": 2600.0,
        "heightMode": "INHERITED",
        "vertices": cocina_vertices,
        "walls": cocina_walls,
        "separations": [
            {
                "id": "sep-coc-01",
                "label": "Paso abierto a comedor",
                "x1Mm": 1600.0,
                "y1Mm": 0.0,
                "x2Mm": 2500.0,
                "y2Mm": 0.0,
                "distanceMm": 900.0,
            }
        ],
        "concreteBases": [
            {
                "id": "pollo-coc-01",
                "code": "P01",
                "kind": "POLLO",
                "label": "Base de concreto / Pollo Tarja",
                "xMm": 2500.0,
                "yMm": 0.0,
                "lengthMm": 1600.0,
                "widthMm": 580.0,
                "heightMm": 100.0,
                "angleDeg": 0.0,
                "hostWallId": w5,
                "references": {
                    "distLeftWallMm": 0.0,
                    "distRightWallMm": 0.0,
                    "distBackWallMm": 0.0,
                    "referenceWallLabel": "Muro 5 (M05)",
                },
            }
        ],
        "notes": "Levantamiento AS-BUILT verificado con distanciómetro láser ISO 16331-1. Hueco de 900 mm y chaflán a 135°.",
    }
    apply_renumber_left_to_right(cocina_concept)

    # Concepto 2: Puerta de intercomunicación con 9 lecturas distintas (Caso P-B / P-A del Cerebro IA)
    puerta_concept = {
        "id": "conc-puerta-01",
        "name": "Puerta Intercomunicación Cocina-Pasillo (P-01)",
        "conceptType": "PUERTA",
        "mode": "DOOR_FRONTAL",
        "doorSurvey": {
            "id": "door-p01",
            "code": "P-01",
            "ceilingHeightMm": 2600.0,
            "baseOffsetMm": 0.0,
            "widths": {"inferior": 904.0, "medio": 898.0, "superior": 901.0},
            "heights": {"izquierdo": 2115.0, "centro": 2112.0, "derecho": 2108.0},
            "thicknesses": {"superior": 152.0, "medio": 148.0, "inferior": 155.0},
            "notes": "9 lecturas originales en mm. Mínimos de referencia exportados: 898 x 2108 x 148 mm.",
        },
        "notes": "Vano medido en 9 posiciones sin descontar holguras de fabricación.",
    }

    project = {
        "id": proj_id,
        "schemaVersion": "1.0.0",
        "name": "Residencial Reforma · Levantamiento AS-BUILT Mobiliario",
        "client": "Arquitectura & Mobiliario Custom",
        "siteAddress": "Av. Paseo de la Reforma, CDMX",
        "author": "Ing. Levantador de Campo",
        "displayUnit": "mm",
        "predominantHeightMm": 2600.0,
        "createdAt": now_iso(),
        "updatedAt": now_iso(),
        "notes": "Expediente AS-BUILT en milímetros (mm) compatible con Rhinoceros 8.",
        "concepts": [cocina_concept, puerta_concept],
    }
    return project


# Sembrar proyecto de referencia al iniciar si aún no existe
if not _project_path("proy-asbuilt-referencia-2026").exists():
    demo_proj = build_demo_reference_project()
    _atomic_write_json(_project_path(demo_proj["id"]), demo_proj)


@app.get("/api/health")
def api_health() -> Dict[str, Any]:
    rhino_exe = Path(r"C:\Program Files\Rhino 8\System\Rhino.exe")
    return {
        "status": "ok",
        "app": "CODEX Asistente Levantamiento AS-BUILT",
        "version": "1.0.0",
        "units": "mm",
        "ezdxfInstalled": True,
        "rhino8Installed": rhino_exe.exists(),
        "rhino8Path": str(rhino_exe) if rhino_exe.exists() else None,
        "timestamp": now_iso(),
    }


@app.get("/api/catalog")
def api_catalog() -> Dict[str, Any]:
    return {
        "conceptTypes": CONCEPT_TYPES,
        "presets": CEREBRO_PRESETS,
        "dxfLayers": [
            {"name": name, "colorAci": col, "linetype": lt}
            for name, col, lt in DXF_LAYERS_SPEC
        ],
    }


@app.get("/api/projects")
def api_list_projects() -> Dict[str, Any]:
    items = []
    for fpath in PROJECTS_DIR.glob("*.asbuilt.json"):
        try:
            data = json.loads(fpath.read_text(encoding="utf-8"))
            items.append({
                "id": data.get("id", fpath.stem),
                "name": data.get("name", fpath.stem),
                "client": data.get("client", ""),
                "siteAddress": data.get("siteAddress", ""),
                "updatedAt": data.get("updatedAt", ""),
                "conceptsCount": len(data.get("concepts", [])),
                "predominantHeightMm": data.get("predominantHeightMm", 2600.0),
            })
        except Exception:
            continue
    items.sort(key=lambda x: x.get("updatedAt") or "", reverse=True)
    return {"projects": items}


@app.get("/api/projects/{project_id}")
def api_get_project(project_id: str) -> Dict[str, Any]:
    fpath = _project_path(project_id)
    if not fpath.exists():
        raise HTTPException(status_code=404, detail=f"Proyecto no encontrado: {project_id}")
    data = json.loads(fpath.read_text(encoding="utf-8"))
    return {"project": data}


@app.post("/api/projects")
async def api_save_project(request: Request) -> Dict[str, Any]:
    body = await request.json()
    project = body.get("project") if "project" in body else body
    if not isinstance(project, dict):
        raise HTTPException(status_code=400, detail="Payload de proyecto inválido.")

    proj_id = project.get("id") or new_id("proy")
    project["id"] = proj_id
    project["schemaVersion"] = "1.0.0"
    project["displayUnit"] = "mm"
    project["updatedAt"] = now_iso()
    if not project.get("createdAt"):
        project["createdAt"] = project["updatedAt"]

    target = _project_path(proj_id)
    sha256_hex = _atomic_write_json(target, project)

    # Crear respaldo versionado en data/backups/
    ts_compact = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_target = BACKUPS_DIR / f"{_safe_filename(proj_id)}_{ts_compact}_{sha256_hex[:8]}.asbuilt.json"
    _atomic_write_json(backup_target, project)

    return {
        "saved": True,
        "projectId": proj_id,
        "updatedAt": project["updatedAt"],
        "sha256": sha256_hex,
        "filePath": str(target),
        "backupPath": str(backup_target),
    }


@app.delete("/api/projects/{project_id}")
def api_delete_project(project_id: str) -> Dict[str, Any]:
    fpath = _project_path(project_id)
    if not fpath.exists():
        raise HTTPException(status_code=404, detail="Proyecto no encontrado.")
    ts_compact = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    trash_backup = BACKUPS_DIR / f"DELETED_{_safe_filename(project_id)}_{ts_compact}.asbuilt.json"
    trash_backup.write_bytes(fpath.read_bytes())
    fpath.unlink()
    return {"deleted": True, "projectId": project_id, "backupPath": str(trash_backup)}


@app.post("/api/seed-demo")
def api_seed_demo() -> Dict[str, Any]:
    demo = build_demo_reference_project()
    sha = _atomic_write_json(_project_path(demo["id"]), demo)
    return {"project": demo, "sha256": sha}


@app.post("/api/geometry/renumber-preview")
async def api_renumber_preview(request: Request) -> Dict[str, Any]:
    body = await request.json()
    concept = body.get("concept", body)
    return preview_renumber_left_to_right(concept)


@app.post("/api/geometry/renumber-apply")
async def api_renumber_apply(request: Request) -> Dict[str, Any]:
    body = await request.json()
    concept = copy.deepcopy(body.get("concept", body))
    res = apply_renumber_left_to_right(concept)
    return {"concept": concept, **res}


@app.post("/api/geometry/fix-wall")
async def api_fix_wall(request: Request) -> Dict[str, Any]:
    body = await request.json()
    concept = copy.deepcopy(body["concept"])
    wall_id = body["wallId"]
    length_mm = float(body["realLengthMm"])
    angle_deg = body.get("angleDeg")
    allow_unlock = bool(body.get("allowUnlock", False))
    result = progressive_fix_wall_length(
        concept,
        wall_id=wall_id,
        new_real_length_mm=length_mm,
        new_angle_deg=float(angle_deg) if angle_deg is not None else None,
        allow_unlock_fixed_target=allow_unlock,
    )
    return {"concept": concept, "result": result}


@app.post("/api/geometry/four-references")
async def api_four_references(request: Request) -> Dict[str, Any]:
    body = await request.json()
    try:
        res = compute_four_references(
            wall_width_mm=float(body["wallWidthMm"]),
            wall_height_mm=float(body["wallHeightMm"]),
            dist_left_mm=body.get("distLeftMm"),
            dist_right_mm=body.get("distRightMm"),
            dist_floor_mm=body.get("distFloorMm"),
            dist_top_mm=body.get("distTopMm"),
        )
        return res
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/geometry/door-evaluate")
async def api_door_evaluate(request: Request) -> Dict[str, Any]:
    body = await request.json()
    return evaluate_door_nine_readings(
        widths_mm=body.get("widths", {}),
        heights_mm=body.get("heights", {}),
        thicknesses_mm=body.get("thicknesses", {}),
        ceiling_height_mm=float(body.get("ceilingHeightMm") or 2600.0),
        base_offset_mm=float(body.get("baseOffsetMm") or 0.0),
    )


@app.post("/api/audit")
async def api_audit(request: Request) -> Dict[str, Any]:
    body = await request.json()
    project = body.get("project", body)
    return audit_project_for_export(project)


@app.post("/api/export/dxf")
async def api_export_dxf(request: Request) -> Response:
    body = await request.json()
    project = body.get("project", body)
    confirm_preliminary = bool(body.get("confirmPreliminary", True))
    try:
        dxf_bytes, summary = export_project_to_dxf_bytes(project, confirm_preliminary=confirm_preliminary)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    fname = f"{_safe_filename(project.get('name', 'Levantamiento'))}_ASBUILT_MM.dxf"
    out_file = EXPORTS_DIR / fname
    out_file.write_bytes(dxf_bytes)

    headers = {
        "Content-Disposition": f'attachment; filename="{fname}"',
        "X-ASBUILT-DXF-Version": summary["dxfVersion"],
        "X-ASBUILT-Audit-Errors": str(summary["ezdxfAuditErrors"]),
        "X-ASBUILT-View-Overlaps": str(summary["viewOverlapsCount"]),
        "X-ASBUILT-Export-Path": str(out_file),
    }
    return Response(content=dxf_bytes, media_type="application/dxf", headers=headers)


@app.post("/api/export/pdf")
async def api_export_pdf(request: Request) -> Response:
    body = await request.json()
    project = body.get("project", body)
    confirm_preliminary = bool(body.get("confirmPreliminary", True))
    try:
        pdf_bytes, summary = export_project_to_pdf_bytes(project, confirm_preliminary=confirm_preliminary)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc))

    fname = f"{_safe_filename(project.get('name', 'Levantamiento'))}_ASBUILT_MM.pdf"
    out_file = EXPORTS_DIR / fname
    out_file.write_bytes(pdf_bytes)

    headers = {
        "Content-Disposition": f'attachment; filename="{fname}"',
        "X-ASBUILT-PDF-Pages": str(summary["pagesCount"]),
        "X-ASBUILT-Export-Path": str(out_file),
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


# Montar archivos estáticos de la PWA al final para no interceptar /api/*
app.mount("/", StaticFiles(directory=str(PUBLIC_DIR), html=True), name="public")


if __name__ == "__main__":
    port = int(os.environ.get("ASBUILT_PORT", "3120"))
    host = os.environ.get("ASBUILT_HOST", "0.0.0.0")
    print(f"[*] Iniciando servidor CODEX Asistente Levantamiento AS-BUILT en http://localhost:{port} ...")
    uvicorn.run(app, host=host, port=port, log_level="info")
