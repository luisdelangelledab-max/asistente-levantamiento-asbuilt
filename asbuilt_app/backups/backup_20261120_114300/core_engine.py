# -*- coding: utf-8 -*-
"""
Núcleo Geométrico, Topológico, de Persistencia y Exportación (DXF R2010 + PDF Vectorial)
Aplicación de Levantamientos AS-BUILT para Mobiliario (2026)
Compatible con Rhinoceros 8 (Windows) y verificado con Cerebro IA (R0 / 44 comprobaciones).
"""
from __future__ import annotations

import copy
import datetime
import hashlib
import io
import json
import math
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import ezdxf
from ezdxf import units as dxf_units
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.units import mm as rl_mm
from reportlab.pdfgen import canvas as pdf_canvas


# ==============================================================================
# 1. CATÁLOGO Y PRESETS RECUPERADOS DEL CEREBRO IA (VALORES EDITABLES, NO MEDIDAS)
# ==============================================================================

CONCEPT_TYPES = [
    {"id": "COCINA", "label": "Cocina", "mode": "PLAN_ELEVATION", "icon": "utensils"},
    {"id": "BANO", "label": "Baño", "mode": "PLAN_ELEVATION", "icon": "bath"},
    {"id": "CLOSET", "label": "Clóset", "mode": "PLAN_ELEVATION", "icon": "wardrobe"},
    {"id": "VESTIDOR", "label": "Vestidor", "mode": "PLAN_ELEVATION", "icon": "shirt"},
    {"id": "SALA", "label": "Sala", "mode": "PLAN_ELEVATION", "icon": "sofa"},
    {"id": "COMEDOR", "label": "Comedor", "mode": "PLAN_ELEVATION", "icon": "table"},
    {"id": "PASILLO", "label": "Pasillo", "mode": "PLAN_ELEVATION", "icon": "corridor"},
    {"id": "OTRO", "label": "Otro ambiente", "mode": "PLAN_ELEVATION", "icon": "box"},
    {"id": "PUERTA", "label": "Puerta de intercomunicación", "mode": "DOOR_FRONTAL", "icon": "door"},
]

CEREBRO_PRESETS = {
    "electrical": {
        "CONTACTO_DUPLEX": {
            "label": "Contacto Dúplex 127V (Placa 1-Gang)",
            "widthMm": 70.0,
            "heightMm": 115.0,
            "boxWidthMm": 54.0,
            "boxHeightMm": 102.0,
            "gfci": False,
            "defaultHeightNptMm": 1150.0,
            "source": "Leviton 80703 / NMX-J-136-ANCE-2019 (Preset editable)",
            "provenance": "DEFAULT_PRESET",
        },
        "CONTACTO_GFCI": {
            "label": "Contacto GFCI / ICFT (Zona Húmeda)",
            "widthMm": 70.0,
            "heightMm": 115.0,
            "boxWidthMm": 54.0,
            "boxHeightMm": 102.0,
            "gfci": True,
            "defaultHeightNptMm": 1150.0,
            "source": "NOM-001-SEDE-2012 Art. 210-8 / Placa 1-Gang (Preset editable)",
            "provenance": "DEFAULT_PRESET",
        },
        "CONTACTO_MODUS": {
            "label": "Contacto Modular (Placa 85×120 mm)",
            "widthMm": 85.0,
            "heightMm": 120.0,
            "boxWidthMm": 54.0,
            "boxHeightMm": 102.0,
            "gfci": False,
            "defaultHeightNptMm": 300.0,
            "source": "Bticino Modus Pro E5N1PTL (Preset editable)",
            "provenance": "DEFAULT_PRESET",
        },
        "TOMA_220V": {
            "label": "Toma Especial 220V (Caja 4×4\")",
            "widthMm": 102.0,
            "heightMm": 102.0,
            "boxWidthMm": 102.0,
            "boxHeightMm": 102.0,
            "gfci": False,
            "defaultHeightNptMm": 600.0,
            "source": "Caja cuadrada 4x4\" RACO/Hubbell (Preset editable)",
            "provenance": "DEFAULT_PRESET",
        },
        "APAGADOR": {
            "label": "Apagador / Interruptor (Placa 1-Gang)",
            "widthMm": 70.0,
            "heightMm": 115.0,
            "boxWidthMm": 54.0,
            "boxHeightMm": 102.0,
            "gfci": False,
            "defaultHeightNptMm": 1100.0,
            "source": "NMX-J-136-ANCE-2019 (Preset editable)",
            "provenance": "DEFAULT_PRESET",
        },
    },
    "plumbing": {
        "CONJUNTO_TARJA_CONAVI": {
            "label": "Conjunto Hidrosanitario Tarja Cocina (AC+AF+Drenaje)",
            "isSet": True,
            "separationAfAcMm": 200.0,
            "hotOffsetUMm": -100.0,
            "hotOffsetVMm": 50.0,
            "coldOffsetUMm": 100.0,
            "coldOffsetVMm": 50.0,
            "drainOffsetUMm": 0.0,
            "drainOffsetVMm": 0.0,
            "drainDiameterMm": 50.0,
            "supplyDiameterMm": 13.0,
            "defaultHeightNptMm": 500.0,
            "source": "CONAVI 2023 / UNAM (Sep. 200 mm edit., Dren. 500 mm, Alim. 550 mm)",
            "provenance": "DEFAULT_PRESET",
        },
        "CONJUNTO_LAVABO_CONAVI": {
            "label": "Conjunto Hidrosanitario Lavabo Baño (AC+AF+Drenaje)",
            "isSet": True,
            "separationAfAcMm": 200.0,
            "hotOffsetUMm": -100.0,
            "hotOffsetVMm": 50.0,
            "coldOffsetUMm": 100.0,
            "coldOffsetVMm": 50.0,
            "drainOffsetUMm": 0.0,
            "drainOffsetVMm": 0.0,
            "drainDiameterMm": 50.0,
            "supplyDiameterMm": 13.0,
            "defaultHeightNptMm": 500.0,
            "source": "CONAVI 2023 / Helvex (Sep. 200 mm edit., Dren. 500 mm, Alim. 550 mm)",
            "provenance": "DEFAULT_PRESET",
        },
        "CONJUNTO_TARJA_PROFUNDA": {
            "label": "Conjunto Tarja Profunda / Triturador",
            "isSet": True,
            "separationAfAcMm": 203.0,
            "hotOffsetUMm": -101.5,
            "hotOffsetVMm": 150.0,
            "coldOffsetUMm": 101.5,
            "coldOffsetVMm": 150.0,
            "drainOffsetUMm": 0.0,
            "drainOffsetVMm": 0.0,
            "drainDiameterMm": 50.0,
            "supplyDiameterMm": 13.0,
            "defaultHeightNptMm": 400.0,
            "source": "IPC / Kohler 8\" (203 mm edit., Dren. 400 mm, Alim. 550 mm)",
            "provenance": "DEFAULT_PRESET",
        },
        "SALIDA_AGUA_FRIA": {
            "label": "Salida Aislada Agua Fría (AF)",
            "isSet": False,
            "kind": "AF",
            "diameterMm": 13.0,
            "defaultHeightNptMm": 550.0,
            "source": "Salida hidráulica Ø13 mm (1/2\") editable",
            "provenance": "DEFAULT_PRESET",
        },
        "SALIDA_AGUA_CALIENTE": {
            "label": "Salida Aislada Agua Caliente (AC)",
            "isSet": False,
            "kind": "AC",
            "diameterMm": 13.0,
            "defaultHeightNptMm": 550.0,
            "source": "Salida hidráulica Ø13 mm (1/2\") editable",
            "provenance": "DEFAULT_PRESET",
        },
        "SALIDA_DRENAJE": {
            "label": "Salida Aislada Drenaje Sanitario",
            "isSet": False,
            "kind": "DRENAJE",
            "diameterMm": 50.0,
            "defaultHeightNptMm": 500.0,
            "source": "Salida sanitaria Ø50 mm (2\") editable",
            "provenance": "DEFAULT_PRESET",
        },
    },
    "openings": {
        "VENTANA_ESTANDAR": {
            "label": "Ventana Acotada en Muro",
            "kind": "WINDOW",
            "widthMm": 1200.0,
            "heightMm": 1100.0,
            "sillHeightMm": 1100.0,
            "referenceType": "CLARO_ACABADO",
            "source": "Vano de ventana (dimensiones editables)",
            "provenance": "DEFAULT_PRESET",
        },
        "VANO_PASO": {
            "label": "Vano Abierto en Muro",
            "kind": "OPENING",
            "widthMm": 900.0,
            "heightMm": 2100.0,
            "sillHeightMm": 0.0,
            "referenceType": "CLARO_ACABADO",
            "source": "Vano libre sin marco (dimensiones editables)",
            "provenance": "DEFAULT_PRESET",
        },
    },
}

DXF_LAYERS_SPEC = [
    ("A_MUROS_CONTORNO", 7, "CONTINUOUS"),
    ("A_MUROS_EJES", 8, "CENTER"),
    ("A_BASES_CONCRETO", 9, "DASHED"),
    ("A_SARDINELES", 6, "CONTINUOUS"),
    ("A_VANOS", 30, "CONTINUOUS"),
    ("A_VENTANAS", 4, "CONTINUOUS"),
    ("I_ELECTRICA", 1, "CONTINUOUS"),
    ("I_HIDROSANITARIA", 5, "CONTINUOUS"),
    ("C_COTAS", 3, "CONTINUOUS"),
    ("C_IDENTIFICADORES", 2, "CONTINUOUS"),
    ("REF_ELEVACIONES", 8, "DASHED"),
]


def now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec="seconds")


def new_id(prefix: str = "id") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


# ==============================================================================
# 2. FUNCIONES GEOMÉTRICAS Y MATEMÁTICAS (CONTRATO CEREBRO IA §§5, 6, 7)
# ==============================================================================

def snap_orthogonal_angle(angle_deg: float) -> float:
    """Ajusta un ángulo en grados al ortogonal más cercano: 0, 90, 180, 270."""
    norm = angle_deg % 360.0
    candidates = [0.0, 90.0, 180.0, 270.0, 360.0]
    best = min(candidates, key=lambda c: abs(norm - c))
    return 0.0 if best == 360.0 else best


def unit_vector_deg(angle_deg: float) -> Tuple[float, float]:
    rad = math.radians(angle_deg)
    cx = math.cos(rad)
    sy = math.sin(rad)
    # Limpiar ruido de punto flotante en ángulos ortogonales
    if abs(cx) < 1e-12:
        cx = 0.0
    if abs(sy) < 1e-12:
        sy = 0.0
    return (cx, sy)


def outward_normal_for_wall(tx: float, ty: float, sign: int = 1) -> Tuple[float, float]:
    """
    Según §5.1 de Cerebro IA:
    n_derecha = (t_y, -t_x). En recorrido CCW con interior a la izquierda,
    el espesor exterior usa n_espesor = n_derecha (sign = +1).
    """
    s = 1.0 if sign >= 0 else -1.0
    return (s * ty, -s * tx)


def visible_u_from_topological_s(length_mm: float, s_mm: float, view_face: str = "FRONT", ccw_interior: bool = True) -> float:
    """
    Según §5.3 de Cerebro IA:
    En un recinto CCW con espesor hacia el exterior, mirando la cara interior (FRONT),
    la derecha visual se opone a la tangente t (dot(r, t) = -1 < 0), por lo que
    u_visible = L - s. En vista posterior (BACK), u_visible = s.
    """
    if view_face == "FRONT" and ccw_interior:
        return round(length_mm - s_mm, 4)
    return round(s_mm, 4)


def topological_s_from_visible_u(length_mm: float, u_visible_mm: float, view_face: str = "FRONT", ccw_interior: bool = True) -> float:
    if view_face == "FRONT" and ccw_interior:
        return round(length_mm - u_visible_mm, 4)
    return round(u_visible_mm, 4)


def compute_four_references(
    wall_width_mm: float,
    wall_height_mm: float,
    dist_left_mm: Optional[float] = None,
    dist_right_mm: Optional[float] = None,
    dist_floor_mm: Optional[float] = None,
    dist_top_mm: Optional[float] = None,
    tolerance_mm: float = 0.5,
) -> Dict[str, Any]:
    """
    Sección 4 del Prompt Operativo:
    Cada símbolo registra la ubicación de su centro respecto a cuatro referencias visibles:
    - Distancia desde el extremo izquierdo (distLeftMm)
    - Distancia desde el extremo derecho (distRightMm)
    - Altura desde el piso (distFloorMm)
    - Distancia desde la parte superior del muro (distTopMm)
    Si se introduce una referencia por eje, calcula automáticamente la complementaria.
    Si se introducen las dos de un eje, valida consistencia contra ancho (L) y altura (H).
    """
    L = float(wall_width_mm)
    H = float(wall_height_mm)
    if L <= 0 or H <= 0:
        raise ValueError("El ancho y la altura del muro deben ser mayores a 0 mm.")

    errors: List[str] = []
    warnings: List[str] = []

    # Eje horizontal
    if dist_left_mm is not None and dist_right_mm is not None:
        sum_x = float(dist_left_mm) + float(dist_right_mm)
        delta_x = sum_x - L
        if abs(delta_x) > tolerance_mm:
            errors.append(
                f"Inconsistencia horizontal: Izquierda ({dist_left_mm:.1f} mm) + Derecha ({dist_right_mm:.1f} mm) = "
                f"{sum_x:.1f} mm != Ancho del muro ({L:.1f} mm). Diferencia: {delta_x:+.1f} mm."
            )
        x_left = float(dist_left_mm)
        x_right = float(dist_right_mm)
        horiz_anchor = "BOTH_VALIDATED" if abs(delta_x) <= tolerance_mm else "CONFLICT"
    elif dist_left_mm is not None:
        x_left = float(dist_left_mm)
        x_right = round(L - x_left, 3)
        horiz_anchor = "LEFT"
    elif dist_right_mm is not None:
        x_right = float(dist_right_mm)
        x_left = round(L - x_right, 3)
        horiz_anchor = "RIGHT"
    else:
        raise ValueError("Debe proporcionar al menos una referencia horizontal (izquierda o derecha).")

    # Eje vertical
    if dist_floor_mm is not None and dist_top_mm is not None:
        sum_y = float(dist_floor_mm) + float(dist_top_mm)
        delta_y = sum_y - H
        if abs(delta_y) > tolerance_mm:
            errors.append(
                f"Inconsistencia vertical: Piso ({dist_floor_mm:.1f} mm) + Superior ({dist_top_mm:.1f} mm) = "
                f"{sum_y:.1f} mm != Altura del muro ({H:.1f} mm). Diferencia: {delta_y:+.1f} mm."
            )
        y_floor = float(dist_floor_mm)
        y_top = float(dist_top_mm)
        vert_anchor = "BOTH_VALIDATED" if abs(delta_y) <= tolerance_mm else "CONFLICT"
    elif dist_floor_mm is not None:
        y_floor = float(dist_floor_mm)
        y_top = round(H - y_floor, 3)
        vert_anchor = "FLOOR"
    elif dist_top_mm is not None:
        y_top = float(dist_top_mm)
        y_floor = round(H - y_top, 3)
        vert_anchor = "TOP"
    else:
        raise ValueError("Debe proporcionar al menos una referencia vertical (piso o parte superior).")

    if x_left < 0 or x_right < 0 or x_left > L:
        warnings.append(f"El centro horizontal ({x_left:.1f} mm desde izq.) queda fuera del ancho del muro [0, {L:.1f} mm].")
    if y_floor < 0 or y_top < 0 or y_floor > H:
        warnings.append(f"El centro vertical ({y_floor:.1f} mm desde piso) queda fuera de la altura del muro [0, {H:.1f} mm].")

    return {
        "distLeftMm": round(x_left, 3),
        "distRightMm": round(x_right, 3),
        "distFloorMm": round(y_floor, 3),
        "distTopMm": round(y_top, 3),
        "horizontalAnchor": horiz_anchor,
        "verticalAnchor": vert_anchor,
        "consistent": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
    }


def evaluate_door_nine_readings(
    widths_mm: Dict[str, Any],
    heights_mm: Dict[str, Any],
    thicknesses_mm: Dict[str, Any],
    ceiling_height_mm: float = 2600.0,
    base_offset_mm: float = 0.0,
    spread_warning_threshold_mm: float = 5.0,
) -> Dict[str, Any]:
    """
    Sección 5 del Prompt Operativo y §7.4 / §16.2 de Cerebro IA:
    Captura y preserva las 9 lecturas originales en mm:
      - Ancho del vano: inferior, medio, superior
      - Alto del vano: izquierdo, centro, derecho
      - Espesor del muro: superior, medio, inferior
    Calcula mínimo de ancho, alto y espesor por separado para la geometría de referencia.
    No descuenta holguras ni da medidas definitivas de fabricación.
    """
    req_w = ["inferior", "medio", "superior"]
    req_h = ["izquierdo", "centro", "derecho"]
    req_t = ["superior", "medio", "inferior"]

    def validate_group(group_dict: Dict[str, Any], keys: List[str], label: str) -> Tuple[List[float], List[str]]:
        vals: List[float] = []
        missing: List[str] = []
        for k in keys:
            v = group_dict.get(k)
            if v is None or isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or float(v) <= 0:
                missing.append(f"{label}.{k}")
            else:
                vals.append(round(float(v), 3))
        return vals, missing

    w_vals, w_miss = validate_group(widths_mm, req_w, "ancho")
    h_vals, h_miss = validate_group(heights_mm, req_h, "alto")
    t_vals, t_miss = validate_group(thicknesses_mm, req_t, "espesor")
    missing_all = w_miss + h_miss + t_miss

    if missing_all:
        return {
            "isComplete": False,
            "missingFields": missing_all,
            "originalReadingsMm": {
                "widths": copy.deepcopy(widths_mm),
                "heights": copy.deepcopy(heights_mm),
                "thicknesses": copy.deepcopy(thicknesses_mm),
            },
            "referenceMinimumsMm": None,
            "maximumsMm": None,
            "spreadsMm": None,
            "topStripConceptualMm": None,
            "warnings": [f"Faltan lecturas válidas (>0 mm): {', '.join(missing_all)}"],
            "fabricationNotice": "GEOMETRÍA AS-BUILT DE REFERENCIA (MÍNIMOS DEL VANO). NO DESCUENTA HOLGURAS NI AUTORIZA FABRICACIÓN.",
        }

    w_min, w_max = min(w_vals), max(w_vals)
    h_min, h_max = min(h_vals), max(h_vals)
    t_min, t_max = min(t_vals), max(t_vals)
    w_spread = round(w_max - w_min, 3)
    h_spread = round(h_max - h_min, 3)
    t_spread = round(t_max - t_min, 3)

    # Franja superior con datum compatible (§7.3 Cerebro IA)
    z_header = float(base_offset_mm) + h_min
    top_strip = round(float(ceiling_height_mm) - z_header, 3)

    warnings: List[str] = []
    if w_spread > spread_warning_threshold_mm:
        warnings.append(f"Variación de ancho ΔW = {w_spread:.1f} mm (> {spread_warning_threshold_mm:.1f} mm): posible desplome en jambas.")
    if h_spread > spread_warning_threshold_mm:
        warnings.append(f"Variación de alto ΔH = {h_spread:.1f} mm (> {spread_warning_threshold_mm:.1f} mm): posible desnivel en piso o cabezal.")
    if t_spread > spread_warning_threshold_mm:
        warnings.append(
            f"Variación de espesor ΔT = {t_spread:.1f} mm (mín {t_min:.1f} mm / máx {t_max:.1f} mm): "
            "el mínimo rige la geometría de referencia exportada, pero verificar chambrana/muro en el espesor máximo."
        )
    if top_strip < 0:
        warnings.append(
            f"Conflicto de datum vertical: el cabezal del vano ({z_header:.1f} mm) supera la altura de techo local ({ceiling_height_mm:.1f} mm)."
        )

    return {
        "isComplete": True,
        "missingFields": [],
        "originalReadingsMm": {
            "widths": {"inferior": w_vals[0], "medio": w_vals[1], "superior": w_vals[2]},
            "heights": {"izquierdo": h_vals[0], "centro": h_vals[1], "derecho": h_vals[2]},
            "thicknesses": {"superior": t_vals[0], "medio": t_vals[1], "inferior": t_vals[2]},
        },
        "referenceMinimumsMm": {
            "widthMm": w_min,
            "heightMm": h_min,
            "thicknessMm": t_min,
        },
        "maximumsMm": {
            "widthMm": w_max,
            "heightMm": h_max,
            "thicknessMm": t_max,
        },
        "spreadsMm": {
            "widthMm": w_spread,
            "heightMm": h_spread,
            "thicknessMm": t_spread,
        },
        "topStripConceptualMm": top_strip,
        "ceilingHeightRefMm": float(ceiling_height_mm),
        "baseOffsetMm": float(base_offset_mm),
        "warnings": warnings,
        "isFabricationDimension": False,
        "clearanceDeductedMm": 0.0,
        "fabricationNotice": "GEOMETRÍA AS-BUILT DE REFERENCIA (MÍNIMOS DEL VANO). NO DESCUENTA HOLGURAS NI AUTORIZA FABRICACIÓN.",
    }


# ==============================================================================
# 3. ENUMERACIÓN IZQUIERDA -> DERECHA Y FIJACIÓN PROGRESIVA DE MUROS
# ==============================================================================

def get_vertex_map(concept: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    return {v["id"]: v for v in concept.get("vertices", [])}


def wall_geometry_metrics(wall: Dict[str, Any], vmap: Dict[str, Dict[str, Any]]) -> Dict[str, float]:
    va = vmap[wall["startVertexId"]]
    vb = vmap[wall["endVertexId"]]
    ax, ay = float(va["xMm"]), float(va["yMm"])
    bx, by = float(vb["xMm"]), float(vb["yMm"])
    dx, dy = bx - ax, by - ay
    dist = math.hypot(dx, dy)
    ang = (math.degrees(math.atan2(dy, dx)) + 360.0) % 360.0 if dist > 1e-9 else float(wall.get("angleDeg", 0.0))
    return {
        "ax": ax,
        "ay": ay,
        "bx": bx,
        "by": by,
        "minX": min(ax, bx),
        "maxX": max(ax, bx),
        "midX": 0.5 * (ax + bx),
        "minY": min(ay, by),
        "midY": 0.5 * (ay + by),
        "geomLengthMm": round(dist, 3),
        "provisionalLengthM": round(dist / 1000.0, 2),
        "geomAngleDeg": round(ang, 3),
    }


def compute_left_to_right_wall_order(concept: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Sección 2 del Prompt Operativo:
    Enumeración: «Muro 1», «Muro 2»… en orden izquierda→derecha, comenzando por el de la izquierda.
    Criterio determinista: menor minX (extremo más a la izquierda), desempate por midX, luego minY, luego orden previo.
    """
    vmap = get_vertex_map(concept)
    walls = concept.get("walls", [])
    enriched = []
    for idx, w in enumerate(walls):
        m = wall_geometry_metrics(w, vmap)
        enriched.append((round(m["minX"], 2), round(m["midX"], 2), round(m["minY"], 2), idx, w, m))

    enriched.sort(key=lambda item: (item[0], item[1], item[2], item[3]))
    proposal = []
    for new_pos, (_, _, _, old_idx, w, m) in enumerate(enriched, start=1):
        new_label = f"Muro {new_pos}"
        new_code = f"M{new_pos:02d}"
        old_label = w.get("label", f"Muro {old_idx + 1}")
        old_code = w.get("code", f"M{old_idx + 1:02d}")
        proposal.append({
            "wallId": w["id"],
            "oldOrder": w.get("orderIndex", old_idx + 1),
            "newOrder": new_pos,
            "oldLabel": old_label,
            "newLabel": new_label,
            "oldCode": old_code,
            "newCode": new_code,
            "changed": (old_label != new_label) or (old_code != new_code),
            "minX": m["minX"],
            "midX": m["midX"],
            "minY": m["minY"],
        })
    return proposal


def preview_renumber_left_to_right(concept: Dict[str, Any]) -> Dict[str, Any]:
    proposal = compute_left_to_right_wall_order(concept)
    needs_change = any(item["changed"] for item in proposal)
    return {
        "needsRenumbering": needs_change,
        "preview": proposal,
        "message": (
            "Se detectó que el orden actual difiere del orden espacial izquierda→derecha. "
            "Revise la vista previa y confirme para aplicar la renumeración sin perder referencias."
            if needs_change
            else "Los muros ya están numerados en estricto orden izquierda→derecha."
        ),
    }


def apply_renumber_left_to_right(concept: Dict[str, Any]) -> Dict[str, Any]:
    """Aplica la renumeración izquierda->derecha preservando wall.id en elevaciones y elementos."""
    proposal = compute_left_to_right_wall_order(concept)
    map_by_id = {p["wallId"]: p for p in proposal}
    walls = concept.get("walls", [])
    for w in walls:
        p = map_by_id[w["id"]]
        w["orderIndex"] = p["newOrder"]
        w["label"] = p["newLabel"]
        w["code"] = p["newCode"]
    walls.sort(key=lambda w: w["orderIndex"])
    return {
        "applied": True,
        "wallsCount": len(walls),
        "renumberMap": proposal,
    }


def progressive_fix_wall_length(
    concept: Dict[str, Any],
    wall_id: str,
    new_real_length_mm: float,
    new_angle_deg: Optional[float] = None,
    allow_unlock_fixed_target: bool = False,
    closure_tolerance_mm: float = 0.5,
) -> Dict[str, Any]:
    """
    Sección 2 del Prompt Operativo: Fijación Progresiva:
    - Cada cota real fija su muro (status = 'fijado').
    - Las cotas posteriores ajustan solo geometría provisional, respetando conexiones y ángulos ya fijados.
    - Estados: 'provisional', 'fijado', 'conflicto'.
    - Ante incompatibilidades (ej. lazo cerrado con muros fijados cuyas cotas no cierran),
      avisa con el residuo exacto y permite corregir/desbloquear; NUNCA cambia medidas fijadas sin permiso.
    """
    if new_real_length_mm is None or not math.isfinite(new_real_length_mm) or new_real_length_mm <= 0:
        raise ValueError("La longitud real del muro debe ser un número positivo en milímetros (mm).")

    walls = concept.get("walls", [])
    vmap = get_vertex_map(concept)
    target_idx = next((i for i, w in enumerate(walls) if w["id"] == wall_id), None)
    if target_idx is None:
        raise KeyError(f"No se encontró el muro con ID {wall_id}")

    target_wall = walls[target_idx]
    if target_wall.get("status") == "fijado" and not allow_unlock_fixed_target:
        return {
            "status": "blocked_by_lock",
            "wallId": wall_id,
            "message": (
                f"El muro {target_wall.get('label')} ya tiene una medida FIJADA ({target_wall.get('realLengthMm')} mm). "
                "Para modificarlo, autorice desbloquearlo explícitamente."
            ),
            "requiresPermission": True,
        }

    va = vmap[target_wall["startVertexId"]]
    vb = vmap[target_wall["endVertexId"]]
    ax, ay = float(va["xMm"]), float(va["yMm"])
    bx_old, by_old = float(vb["xMm"]), float(vb["yMm"])

    # Determinar ángulo efectivo
    if new_angle_deg is not None:
        angle_deg = float(new_angle_deg) % 360.0
        target_wall["angleMode"] = "MANUAL"
    elif target_wall.get("angleDeg") is not None:
        angle_deg = float(target_wall["angleDeg"]) % 360.0
    else:
        angle_deg = math.degrees(math.atan2(by_old - ay, bx_old - ax)) % 360.0
        if target_wall.get("angleMode", "ORTHO") == "ORTHO":
            angle_deg = snap_orthogonal_angle(angle_deg)

    tx, ty = unit_vector_deg(angle_deg)
    bx_new = round(ax + float(new_real_length_mm) * tx, 4)
    by_new = round(ay + float(new_real_length_mm) * ty, 4)
    dx_shift = bx_new - bx_old
    dy_shift = by_new - by_old

    is_closed = bool(concept.get("isClosedLoop", False))
    first_vertex_id = walls[0]["startVertexId"] if walls else None
    last_vertex_id = walls[-1]["endVertexId"] if walls else None
    topologically_closed = is_closed or (len(walls) >= 3 and first_vertex_id == last_vertex_id)

    if not topologically_closed:
        # Cadena abierta: trasladar rígidamente el subgrafo aguas abajo desde endVertexId
        # Esto mantiene INTACTAS todas las longitudes y ángulos de los muros posteriores (fijados o provisionales)
        visited_vertices = set()
        curr_vid = target_wall["endVertexId"]
        visited_vertices.add(curr_vid)
        for w in walls[target_idx + 1:]:
            if w["startVertexId"] in visited_vertices:
                visited_vertices.add(w["endVertexId"])
            if w["endVertexId"] in visited_vertices:
                visited_vertices.add(w["startVertexId"])

        for vid in visited_vertices:
            v = vmap[vid]
            v["xMm"] = round(float(v["xMm"]) + dx_shift, 4)
            v["yMm"] = round(float(v["yMm"]) + dy_shift, 4)

        target_wall["realLengthMm"] = round(float(new_real_length_mm), 3)
        target_wall["provisionalLengthM"] = round(float(new_real_length_mm) / 1000.0, 2)
        target_wall["angleDeg"] = round(angle_deg, 3)
        target_wall["status"] = "fijado"
        target_wall["conflictInfo"] = None
        return {
            "status": "fijado",
            "wallId": wall_id,
            "realLengthMm": target_wall["realLengthMm"],
            "angleDeg": target_wall["angleDeg"],
            "translatedVertices": list(visited_vertices),
            "conflict": None,
        }

    # Caso: Planta cerrada (ciclo topológico)
    # Verificar si existen muros provisionales posteriores que puedan absorber el ajuste sin tocar ningún muro fijado
    other_walls = [w for i, w in enumerate(walls) if i != target_idx]
    provisional_others = [w for w in other_walls if w.get("status", "provisional") == "provisional"]

    # Calcular vector residual si respetamos todos los muros fijados y aplicamos la nueva longitud a target_wall
    # Intentamos reconstruir la cadena aplicando nueva longitud en target_wall y trasladando hasta donde haya provisionales
    if len(provisional_others) > 0:
        # Buscamos si podemos absorber (dx_shift, dy_shift) únicamente en muros provisionales
        # Estrategia limpia:
        # 1) Si un muro provisional paralelo al desplazamiento puede ajustar su longitud provisional (> 10 mm) sin cambiar su ángulo
        # 2) O si hay dos muros provisionales ortogonales que pueden absorber dx_shift y dy_shift sin alterar ningún muro fijado
        absorbed = _try_absorb_shift_in_provisional_walls(walls, vmap, target_idx, dx_shift, dy_shift)
        if absorbed["success"]:
            target_wall["realLengthMm"] = round(float(new_real_length_mm), 3)
            target_wall["provisionalLengthM"] = round(float(new_real_length_mm) / 1000.0, 2)
            target_wall["angleDeg"] = round(angle_deg, 3)
            target_wall["status"] = "fijado"
            target_wall["conflictInfo"] = None
            return {
                "status": "fijado",
                "wallId": wall_id,
                "realLengthMm": target_wall["realLengthMm"],
                "angleDeg": target_wall["angleDeg"],
                "adjustedProvisionalWalls": absorbed["adjustedWalls"],
                "conflict": None,
            }

    # Si no se pudo absorber en muros provisionales (p. ej. todos los muros relevantes ya están FIJADOS),
    # evaluamos el residuo de cierre R = sum(L_i * t_i)
    rx, ry = 0.0, 0.0
    for i, w in enumerate(walls):
        L_i = float(new_real_length_mm) if i == target_idx else float(w.get("realLengthMm") or wall_geometry_metrics(w, vmap)["geomLengthMm"])
        ang_i = angle_deg if i == target_idx else float(w.get("angleDeg", wall_geometry_metrics(w, vmap)["geomAngleDeg"]))
        ux, uy = unit_vector_deg(ang_i)
        rx += L_i * ux
        ry += L_i * uy

    res_norm = math.hypot(rx, ry)
    if res_norm <= closure_tolerance_mm:
        # Cierra perfectamente dentro de la tolerancia computacional
        _rebuild_closed_loop_coordinates(walls, vmap, target_idx, float(new_real_length_mm), angle_deg)
        target_wall["realLengthMm"] = round(float(new_real_length_mm), 3)
        target_wall["provisionalLengthM"] = round(float(new_real_length_mm) / 1000.0, 2)
        target_wall["angleDeg"] = round(angle_deg, 3)
        target_wall["status"] = "fijado"
        target_wall["conflictInfo"] = None
        for w in walls:
            if w.get("status") == "conflicto":
                w["status"] = "fijado"
                w["conflictInfo"] = None
        return {
            "status": "fijado",
            "wallId": wall_id,
            "realLengthMm": target_wall["realLengthMm"],
            "residualMm": round(res_norm, 4),
            "conflict": None,
        }

    # INCOMPATIBILIDAD GEOMÉTRICA: Hay conflicto con muros ya fijados.
    # Regla estricta del Prompt: NUNCA cambiar medidas fijadas sin permiso.
    conflict_payload = {
        "wallId": wall_id,
        "wallLabel": target_wall.get("label", wall_id),
        "attemptedLengthMm": round(float(new_real_length_mm), 3),
        "previousLengthMm": target_wall.get("realLengthMm") or wall_geometry_metrics(target_wall, vmap)["geomLengthMm"],
        "residualVectorMm": {"rx": round(rx, 3), "ry": round(ry, 3)},
        "residualNormMm": round(res_norm, 3),
        "message": (
            f"Conflicto geométrico de cierre: Al fijar {target_wall.get('label')} en {new_real_length_mm:.1f} mm, "
            f"los muros fijados producen un descuadre/residuo de cierre de {res_norm:.1f} mm "
            f"(ΔX = {rx:+.1f} mm, ΔY = {ry:+.1f} mm). Ninguna medida fijada fue alterada."
        ),
        "options": [
            "Corregir la medida introducida",
            "Abrir perímetro para conservar todas las medidas reales fijadas con brecha documentada",
            "Desbloquear explícitamente el muro opuesto o ángulo para ajustar",
        ],
    }
    target_wall["status"] = "conflicto"
    target_wall["conflictInfo"] = conflict_payload
    return {
        "status": "conflicto",
        "wallId": wall_id,
        "conflict": conflict_payload,
    }


def _try_absorb_shift_in_provisional_walls(
    walls: List[Dict[str, Any]],
    vmap: Dict[str, Dict[str, Any]],
    target_idx: int,
    dx_shift: float,
    dy_shift: float,
) -> Dict[str, Any]:
    """
    Intenta absorber el desplazamiento (dx_shift, dy_shift) generado por fijar target_idx
    modificando únicamente la longitud provisional de muros con status == 'provisional',
    conservando intactos los ángulos y longitudes de todos los muros con status == 'fijado'.
    """
    n = len(walls)
    # Recalcular longitudes actuales y vectores unitarios
    lengths = []
    angles = []
    statuses = []
    for i, w in enumerate(walls):
        m = wall_geometry_metrics(w, vmap)
        L = float(w.get("realLengthMm") or m["geomLengthMm"])
        ang = float(w.get("angleDeg", m["geomAngleDeg"]))
        lengths.append(L)
        angles.append(ang)
        statuses.append(w.get("status", "provisional"))

    # Candidatos provisionales distintos del muro editado
    prov_indices = [i for i in range(n) if i != target_idx and statuses[i] == "provisional"]
    if not prov_indices:
        return {"success": False, "adjustedWalls": []}

    # Necesitamos que la suma vectorial de los muros siga cerrando:
    # El muro target_idx cambió en (dx_shift, dy_shift).
    # Por tanto, los muros provisionales deben absorber (-dx_shift, -dy_shift) cambiando solo sus longitudes L_j > 50 mm.
    rem_x = -dx_shift
    rem_y = -dy_shift
    adjusted_ids = []
    new_lengths = list(lengths)

    # Primero intentar absorber componente horizontal y vertical en muros provisionales colineales
    for idx in prov_indices:
        ux, uy = unit_vector_deg(angles[idx])
        if abs(ux) > 0.999 and abs(uy) < 1e-6 and abs(rem_x) > 1e-4:
            delta_L = rem_x / ux
            if new_lengths[idx] + delta_L >= 50.0:
                new_lengths[idx] += delta_L
                rem_x = 0.0
                adjusted_ids.append(walls[idx]["id"])
        elif abs(uy) > 0.999 and abs(ux) < 1e-6 and abs(rem_y) > 1e-4:
            delta_L = rem_y / uy
            if new_lengths[idx] + delta_L >= 50.0:
                new_lengths[idx] += delta_L
                rem_y = 0.0
                adjusted_ids.append(walls[idx]["id"])

    if math.hypot(rem_x, rem_y) > 0.5:
        return {"success": False, "adjustedWalls": []}

    # Aplicar nuevas coordenadas recorriendo el polígono desde el vértice 0
    v0 = vmap[walls[0]["startVertexId"]]
    cx, cy = float(v0["xMm"]), float(v0["yMm"])
    for i, w in enumerate(walls):
        L_i = (lengths[i] + math.hypot(dx_shift, dy_shift) if False else new_lengths[i])
        if i == target_idx:
            ux, uy = unit_vector_deg(angles[i])
            # Longitud nueva del target_idx
            va = vmap[w["startVertexId"]]
            vb = vmap[w["endVertexId"]]
            old_L = lengths[i]
            # Proyección del cambio
            L_i = old_L + (dx_shift * ux + dy_shift * uy)
            new_lengths[i] = L_i
        ux, uy = unit_vector_deg(angles[i])
        nx = round(cx + new_lengths[i] * ux, 4)
        ny = round(cy + new_lengths[i] * uy, 4)
        vend = vmap[w["endVertexId"]]
        if i < n - 1 or w["endVertexId"] != walls[0]["startVertexId"]:
            vend["xMm"] = nx
            vend["yMm"] = ny
        cx, cy = nx, ny
        if i != target_idx and statuses[i] == "provisional":
            w["provisionalLengthM"] = round(new_lengths[i] / 1000.0, 2)

    return {"success": True, "adjustedWalls": adjusted_ids}


def _rebuild_closed_loop_coordinates(
    walls: List[Dict[str, Any]],
    vmap: Dict[str, Dict[str, Any]],
    target_idx: int,
    target_length_mm: float,
    target_angle_deg: float,
) -> None:
    v0 = vmap[walls[0]["startVertexId"]]
    cx, cy = float(v0["xMm"]), float(v0["yMm"])
    n = len(walls)
    for i, w in enumerate(walls):
        m = wall_geometry_metrics(w, vmap)
        L_i = target_length_mm if i == target_idx else float(w.get("realLengthMm") or m["geomLengthMm"])
        ang_i = target_angle_deg if i == target_idx else float(w.get("angleDeg", m["geomAngleDeg"]))
        ux, uy = unit_vector_deg(ang_i)
        nx = round(cx + L_i * ux, 4)
        ny = round(cy + L_i * uy, 4)
        if i < n - 1 or w["endVertexId"] != walls[0]["startVertexId"]:
            vend = vmap[w["endVertexId"]]
            vend["xMm"] = nx
            vend["yMm"] = ny
        cx, cy = nx, ny


def compute_wall_footprint_polygon(
    wall: Dict[str, Any],
    vmap: Dict[str, Dict[str, Any]],
    all_walls: Optional[List[Dict[str, Any]]] = None,
) -> List[Tuple[float, float]]:
    """
    Calcula los 4 vértices CCW de la huella cerrada del muro en planta (A_MUROS_CONTORNO),
    resolviendo ingletes (miters) con muros vecinos conectados cuando el ángulo es razonable,
    o remate perpendicular limpio cuando es extremo libre o muro aislado.
    Garantiza área positiva, cero vértices repetidos y cero retrocesos A->B->A (Rhino 8.36 safe).
    """
    m = wall_geometry_metrics(wall, vmap)
    ax, ay, bx, by = m["ax"], m["ay"], m["bx"], m["by"]
    L = m["geomLengthMm"]
    if L < 1e-3:
        return []

    tx, ty = (bx - ax) / L, (by - ay) / L
    thickness = float(wall.get("thicknessMm") or 150.0)
    sign = int(wall.get("outwardNormalSign", 1))
    nx, ny = outward_normal_for_wall(tx, ty, sign)

    # Recta exterior desplazada por thickness
    q_start = (ax + thickness * nx, ay + thickness * ny)
    q_end = (bx + thickness * nx, by + thickness * ny)

    if all_walls:
        # Buscar vecino en startVertexId y en endVertexId
        prev_w = next(
            (w for w in all_walls if w["id"] != wall["id"] and w["endVertexId"] == wall["startVertexId"]),
            None,
        )
        next_w = next(
            (w for w in all_walls if w["id"] != wall["id"] and w["startVertexId"] == wall["endVertexId"]),
            None,
        )
        if prev_w:
            inter = _intersect_offset_lines(prev_w, wall, vmap)
            if inter is not None:
                q_start = inter
        if next_w:
            inter = _intersect_offset_lines(wall, next_w, vmap)
            if inter is not None:
                q_end = inter

    poly = [
        (round(ax, 3), round(ay, 3)),
        (round(bx, 3), round(by, 3)),
        (round(q_end[0], 3), round(q_end[1], 3)),
        (round(q_start[0], 3), round(q_start[1], 3)),
    ]
    return poly


def _intersect_offset_lines(
    w1: Dict[str, Any],
    w2: Dict[str, Any],
    vmap: Dict[str, Dict[str, Any]],
    miter_limit_factor: float = 3.0,
) -> Optional[Tuple[float, float]]:
    m1 = wall_geometry_metrics(w1, vmap)
    m2 = wall_geometry_metrics(w2, vmap)
    if m1["geomLengthMm"] < 1e-3 or m2["geomLengthMm"] < 1e-3:
        return None

    t1x, t1y = (m1["bx"] - m1["ax"]) / m1["geomLengthMm"], (m1["by"] - m1["ay"]) / m1["geomLengthMm"]
    t2x, t2y = (m2["bx"] - m2["ax"]) / m2["geomLengthMm"], (m2["by"] - m2["ay"]) / m2["geomLengthMm"]
    th1 = float(w1.get("thicknessMm") or 150.0)
    th2 = float(w2.get("thicknessMm") or 150.0)
    n1x, n1y = outward_normal_for_wall(t1x, t1y, int(w1.get("outwardNormalSign", 1)))
    n2x, n2y = outward_normal_for_wall(t2x, t2y, int(w2.get("outwardNormalSign", 1)))

    p1x, p1y = m1["bx"] + th1 * n1x, m1["by"] + th1 * n1y
    p2x, p2y = m2["ax"] + th2 * n2x, m2["ay"] + th2 * n2y

    det = t1x * t2y - t1y * t2x
    if abs(det) < 1e-4:
        # Colineales o casi paralelos
        return (0.5 * (p1x + p2x), 0.5 * (p1y + p2y))

    dx = p2x - p1x
    dy = p2y - p1y
    lam = (dx * t2y - dy * t2x) / det
    ix = p1x + lam * t1x
    iy = p1y + lam * t1y

    # Comprobar límite de inglete para evitar picos degenerados (COR-04 Cerebro IA)
    dist_corner = math.hypot(ix - m2["ax"], iy - m2["ay"])
    if dist_corner > miter_limit_factor * max(th1, th2):
        return (0.5 * (p1x + p2x), 0.5 * (p1y + p2y))
    return (ix, iy)


# ==============================================================================
# 4. AUDITORÍA PRE-VUELO (VALIDACIÓN ANTES DE EXPORTAR PDF / DXF)
# ==============================================================================

def audit_project_for_export(project: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sección 6 del Prompt Operativo:
    Advertir datos faltantes o conflictos. Exportación preliminar solo con confirmación
    y marca de incompleta. Nunca modificar el archivo fuente al exportar.
    """
    blocking_conflicts: List[str] = []
    missing_data_warnings: List[str] = []
    preset_unconfirmed_warnings: List[str] = []

    concepts = project.get("concepts", [])
    if not concepts:
        missing_data_warnings.append("El proyecto no contiene ningún concepto o ambiente registrado.")

    for c in concepts:
        cname = c.get("name", c.get("id", "Concepto"))
        ctype = c.get("conceptType", "OTRO")

        if ctype == "PUERTA" or c.get("mode") == "DOOR_FRONTAL":
            ds = c.get("doorSurvey") or {}
            ev = evaluate_door_nine_readings(
                ds.get("widths", {}),
                ds.get("heights", {}),
                ds.get("thicknesses", {}),
                ceiling_height_mm=float(ds.get("ceilingHeightMm") or project.get("predominantHeightMm") or 2600.0),
                base_offset_mm=float(ds.get("baseOffsetMm") or 0.0),
            )
            if not ev["isComplete"]:
                missing_data_warnings.append(
                    f"[{cname}] Puerta con lecturas incompletas ({len(ev['missingFields'])} faltantes de las 9 obligatorias)."
                )
            for wmsg in ev.get("warnings", []):
                if "Conflicto" in wmsg:
                    blocking_conflicts.append(f"[{cname}] {wmsg}")
                else:
                    missing_data_warnings.append(f"[{cname}] {wmsg}")
            continue

        walls = c.get("walls", [])
        if not walls:
            missing_data_warnings.append(f"[{cname}] No tiene muros dibujados en planta.")

        # Verificar si la numeración izquierda->derecha tiene cambios pendientes
        renum = preview_renumber_left_to_right(c)
        if renum["needsRenumbering"]:
            missing_data_warnings.append(
                f"[{cname}] El orden de creación de los muros no coincide con el orden izquierda→derecha (renumeración disponible con vista previa)."
            )

        vmap = get_vertex_map(c)
        for w in walls:
            wlabel = w.get("label", w["id"])
            status = w.get("status", "provisional")
            if status == "conflicto":
                cinfo = (w.get("conflictInfo") or {}).get("message", "Conflicto geométrico de cierre.")
                blocking_conflicts.append(f"[{cname} · {wlabel}] {cinfo}")
            elif status == "provisional" or not w.get("realLengthMm"):
                missing_data_warnings.append(
                    f"[{cname} · {wlabel}] Permanece con longitud PROVISIONAL ({w.get('provisionalLengthM', 0):.2f} m) sin cota real fijada en mm."
                )

            L = float(w.get("realLengthMm") or wall_geometry_metrics(w, vmap)["geomLengthMm"])
            H = float(w.get("heightMm") or c.get("heightMm") or project.get("predominantHeightMm") or 2600.0)

            for el in w.get("elements", []):
                el_label = el.get("label") or el.get("code") or el["id"]
                refs = el.get("references") or {}
                try:
                    chk = compute_four_references(
                        L,
                        H,
                        dist_left_mm=refs.get("distLeftMm"),
                        dist_right_mm=refs.get("distRightMm"),
                        dist_floor_mm=refs.get("distFloorMm"),
                        dist_top_mm=refs.get("distTopMm"),
                    )
                    for err in chk["errors"]:
                        blocking_conflicts.append(f"[{cname} · {wlabel} · {el_label}] {err}")
                    for warn in chk["warnings"]:
                        missing_data_warnings.append(f"[{cname} · {wlabel} · {el_label}] {warn}")
                except Exception as exc:
                    missing_data_warnings.append(f"[{cname} · {wlabel} · {el_label}] Referencias incompletas: {exc}")

                if el.get("provenance") == "DEFAULT_PRESET":
                    preset_unconfirmed_warnings.append(
                        f"[{cname} · {wlabel} · {el_label}] Conserva dimensiones/separaciones de plantilla (DEFAULT_PRESET) sin confirmar como medida de campo."
                    )

        for pb in c.get("concreteBases", []):
            pblabel = pb.get("label", pb.get("code", "Pollo"))
            if not pb.get("widthMm") or not pb.get("lengthMm"):
                missing_data_warnings.append(f"[{cname} · {pblabel}] Base de concreto sin ancho o largo real en mm.")

    is_clean = (len(blocking_conflicts) == 0) and (len(missing_data_warnings) == 0)
    requires_preliminary_mark = not is_clean

    return {
        "isCleanForFinalExport": is_clean,
        "requiresPreliminaryConfirmation": requires_preliminary_mark,
        "blockingConflicts": blocking_conflicts,
        "missingDataWarnings": missing_data_warnings,
        "presetNotices": preset_unconfirmed_warnings,
        "stampText": (
            "LEVANTAMIENTO AS-BUILT VALIDADO (COTAS EN MM)"
            if is_clean
            else "EXPORTACION PRELIMINAR / INCOMPLETA - CONTIENE DATOS PENDIENTES O CONFLICTOS"
        ),
    }


# ==============================================================================
# 5. EXPORTADOR DXF 2D DETERMINISTA (R2010 / AC1024 COMPATIBLE CON RHINO 8)
# ==============================================================================

def export_project_to_dxf_bytes(
    project: Dict[str, Any],
    confirm_preliminary: bool = True,
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Sección 6 del Prompt Operativo y §10 de Cerebro IA:
    - Geometría 2D editable en mm ($ACADVER = AC1024, $INSUNITS = 4, $MEASUREMENT = 1), nunca imagen.
    - Capas: A_MUROS_CONTORNO, A_MUROS_EJES, A_BASES_CONCRETO, A_SARDINELES, A_VANOS,
      A_VENTANAS, I_ELECTRICA, I_HIDROSANITARIA, C_COTAS, C_IDENTIFICADORES, REF_ELEVACIONES.
    - Planta y elevaciones separadas con referencias consistentes y 0 traslapes de cajas envolventes.
    - Entidades estándar para Rhino 8: LWPOLYLINE cerrada (flag 1, const_width 43 = 0.0), LINE, CIRCLE, TEXT.
    - Puertas con geometría mínima y las 9 lecturas originales anotadas.
    - Nunca modifica el proyecto fuente.
    """
    project_snapshot = copy.deepcopy(project)
    audit_info = audit_project_for_export(project_snapshot)
    if audit_info["requiresPreliminaryConfirmation"] and not confirm_preliminary:
        raise ValueError(
            "El proyecto tiene datos faltantes o conflictos. Debe confirmar la exportación preliminar para continuar."
        )

    doc = ezdxf.new(dxfversion="R2010", setup=True)
    doc.units = dxf_units.MM
    doc.header["$INSUNITS"] = 4  # 4 = Millimeters
    doc.header["$MEASUREMENT"] = 1  # 1 = Metric
    doc.header["$LUNITS"] = 2  # Decimal
    doc.header["$AUNITS"] = 0  # Decimal degrees

    for layer_name, color_aci, ltype in DXF_LAYERS_SPEC:
        if layer_name not in doc.layers:
            use_ltype = ltype if ltype in doc.linetypes else "CONTINUOUS"
            doc.layers.add(name=layer_name, color=color_aci, linetype=use_ltype)

    msp = doc.modelspace()
    view_boxes: List[Dict[str, Any]] = []

    current_band_y = 0.0
    band_gap_y = 3500.0
    view_gap_x = 1800.0

    # Encabezado general del proyecto
    proj_name = _sanitize_dxf_text(project_snapshot.get("name", "Proyecto AS-BUILT"))
    stamp_text = _sanitize_dxf_text(audit_info["stampText"])
    msp.add_text(
        f"PROYECTO AS-BUILT: {proj_name} | UNIDADES: MILIMETROS (MM)",
        dxfattribs={"layer": "C_IDENTIFICADORES", "height": 140.0, "insert": (0.0, -900.0)},
    )
    msp.add_text(
        f"ESTADO: {stamp_text} | FECHA: {now_iso()[:10]}",
        dxfattribs={"layer": "C_IDENTIFICADORES", "height": 95.0, "insert": (0.0, -1120.0)},
    )

    for c_idx, concept in enumerate(project_snapshot.get("concepts", [])):
        cname = _sanitize_dxf_text(concept.get("name", f"Concepto {c_idx + 1}"))
        ctype = concept.get("conceptType", "OTRO")

        if ctype == "PUERTA" or concept.get("mode") == "DOOR_FRONTAL":
            box = _draw_door_concept_dxf(msp, concept, origin_x=0.0, origin_y=current_band_y, stamp_text=stamp_text)
            view_boxes.append(box)
            current_band_y = box["maxY"] + band_gap_y
            continue

        # 1. Dibujar PLANTA del concepto en (0, current_band_y)
        plan_box = _draw_plan_concept_dxf(msp, concept, origin_x=0.0, origin_y=current_band_y, stamp_text=stamp_text)
        view_boxes.append(plan_box)

        # 2. Dibujar ELEVACIONES de cada muro separadas hacia la derecha sin traslapes
        next_elev_x = plan_box["maxX"] + view_gap_x
        band_max_y = plan_box["maxY"]
        vmap = get_vertex_map(concept)
        for wall in concept.get("walls", []):
            elev_box = _draw_wall_elevation_dxf(
                msp,
                concept,
                wall,
                vmap,
                origin_x=next_elev_x,
                origin_y=current_band_y,
                project_height_mm=float(project_snapshot.get("predominantHeightMm") or 2600.0),
            )
            view_boxes.append(elev_box)
            next_elev_x = elev_box["maxX"] + view_gap_x
            band_max_y = max(band_max_y, elev_box["maxY"])

        current_band_y = band_max_y + band_gap_y

    # Comprobar 0 traslapes entre todas las cajas de vistas (Planta y Elevaciones)
    overlap_pairs = []
    for i in range(len(view_boxes)):
        for j in range(i + 1, len(view_boxes)):
            a, b = view_boxes[i], view_boxes[j]
            if a["minX"] < b["maxX"] and a["maxX"] > b["minX"] and a["minY"] < b["maxY"] and a["maxY"] > b["minY"]:
                overlap_pairs.append((a["title"], b["title"]))

    # Ejecutar auditoría oficial ezdxf
    auditor = doc.audit()
    stream = io.StringIO()
    doc.write(stream)
    raw_text = stream.getvalue()
    # Garantizar saltos CRLF estrictos para Rhino 8 (RH-86319)
    raw_crlf = raw_text.replace("\r\n", "\n").replace("\r", "\n").replace("\n", "\r\n")
    dxf_bytes = raw_crlf.encode("utf-8")

    summary = {
        "dxfVersion": "AC1024 (R2010)",
        "insunits": 4,
        "unitsLabel": "Millimeters (mm)",
        "viewsExported": len(view_boxes),
        "viewBoxes": view_boxes,
        "viewOverlapsCount": len(overlap_pairs),
        "ezdxfAuditErrors": len(auditor.errors),
        "ezdxfAuditFixes": len(auditor.fixes),
        "isPreliminary": audit_info["requiresPreliminaryConfirmation"],
        "stampText": audit_info["stampText"],
        "byteSize": len(dxf_bytes),
    }
    return dxf_bytes, summary


def _sanitize_dxf_text(val: Any) -> str:
    s = str(val or "").replace("\r", " ").replace("\n", " ").strip()
    return s[:240]


def _add_closed_lwpolyline(msp: Any, pts: List[Tuple[float, float]], layer: str) -> Any:
    """
    Agrega una LWPOLYLINE cerrada con flag 70=1, grosor constante 43=0.0,
    filtrando vértices consecutivos duplicados (<0.01 mm) para evitar el bug Rhino 8.36.
    """
    cleaned: List[Tuple[float, float]] = []
    for p in pts:
        if not cleaned or math.hypot(p[0] - cleaned[-1][0], p[1] - cleaned[-1][1]) >= 0.01:
            cleaned.append((round(float(p[0]), 3), round(float(p[1]), 3)))
    if len(cleaned) >= 2 and math.hypot(cleaned[0][0] - cleaned[-1][0], cleaned[0][1] - cleaned[-1][1]) < 0.01:
        cleaned.pop()
    if len(cleaned) < 3:
        return None
    pline = msp.add_lwpolyline(cleaned, format="xy", close=True, dxfattribs={"layer": layer, "const_width": 0.0, "elevation": 0.0})
    return pline


def _add_linear_dim_dxf(
    msp: Any,
    p1: Tuple[float, float],
    p2: Tuple[float, float],
    offset: float,
    text_str: str,
    layer: str = "C_COTAS",
    text_height: float = 55.0,
) -> Tuple[float, float, float, float]:
    """Dibuja una cota lineal vectorial limpia (líneas de extensión, línea de dimensión y texto en mm) en C_COTAS."""
    x1, y1 = p1
    x2, y2 = p2
    dx, dy = x2 - x1, y2 - y1
    L = math.hypot(dx, dy)
    if L < 1e-3:
        return (x1, y1, x2, y2)
    tx, ty = dx / L, dy / L
    nx, ny = -ty, tx
    sign = 1.0 if offset >= 0 else -1.0
    d1x, d1y = x1 + offset * nx, y1 + offset * ny
    d2x, d2y = x2 + offset * nx, y2 + offset * ny

    # Líneas de extensión y línea de cota
    msp.add_line((x1, y1), (d1x + sign * 25.0 * nx, d1y + sign * 25.0 * ny), dxfattribs={"layer": layer})
    msp.add_line((x2, y2), (d2x + sign * 25.0 * nx, d2y + sign * 25.0 * ny), dxfattribs={"layer": layer})
    msp.add_line((d1x, d1y), (d2x, d2y), dxfattribs={"layer": layer})

    # Ticks arquitectónicos a 45 grados en extremos
    tick = 35.0
    for px, py in [(d1x, d1y), (d2x, d2y)]:
        msp.add_line(
            (px - tick * (tx + nx) * 0.5, py - tick * (ty + ny) * 0.5),
            (px + tick * (tx + nx) * 0.5, py + tick * (ty + ny) * 0.5),
            dxfattribs={"layer": layer},
        )

    mx = 0.5 * (d1x + d2x) + sign * 35.0 * nx
    my = 0.5 * (d1y + d2y) + sign * 35.0 * ny
    msp.add_text(
        _sanitize_dxf_text(text_str),
        dxfattribs={"layer": layer, "height": text_height, "insert": (mx - len(text_str) * text_height * 0.22, my)},
    )
    min_x = min(x1, x2, d1x, d2x, mx) - 120.0
    max_x = max(x1, x2, d1x, d2x, mx) + 120.0
    min_y = min(y1, y2, d1y, d2y, my) - 120.0
    max_y = max(y1, y2, d1y, d2y, my) + 120.0
    return (min_x, min_y, max_x, max_y)


def _draw_plan_concept_dxf(
    msp: Any,
    concept: Dict[str, Any],
    origin_x: float,
    origin_y: float,
    stamp_text: str,
) -> Dict[str, Any]:
    vmap = get_vertex_map(concept)
    walls = concept.get("walls", [])
    cname = _sanitize_dxf_text(concept.get("name", "Ambiente"))
    ctype = _sanitize_dxf_text(concept.get("conceptType", "AMBIENTE"))

    # Calcular desplazamiento para que el mínimo X,Y de la planta quede anclado limpio respecto a (origin_x, origin_y)
    raw_xs = [float(v["xMm"]) for v in concept.get("vertices", [])] or [0.0]
    raw_ys = [float(v["yMm"]) for v in concept.get("vertices", [])] or [0.0]
    shift_x = origin_x - min(raw_xs) + 500.0
    shift_y = origin_y - min(raw_ys) + 500.0

    min_x, min_y = origin_x, origin_y
    max_x, max_y = origin_x + 2500.0, origin_y + 2000.0

    for w in walls:
        poly = compute_wall_footprint_polygon(w, vmap, walls)
        shifted_poly = [(p[0] + shift_x, p[1] + shift_y) for p in poly]
        if shifted_poly:
            _add_closed_lwpolyline(msp, shifted_poly, "A_MUROS_CONTORNO")
            for px, py in shifted_poly:
                min_x, max_x = min(min_x, px), max(max_x, px)
                min_y, max_y = min(min_y, py), max(max_y, py)

        m = wall_geometry_metrics(w, vmap)
        p1 = (m["ax"] + shift_x, m["ay"] + shift_y)
        p2 = (m["bx"] + shift_x, m["by"] + shift_y)
        msp.add_line(p1, p2, dxfattribs={"layer": "A_MUROS_EJES"})

        # Etiqueta ID del muro (Muro 1 / M01) y Cota en mm
        wlabel = _sanitize_dxf_text(f"{w.get('label', 'Muro')} ({w.get('code', 'M01')})")
        status = w.get("status", "provisional")
        real_mm = w.get("realLengthMm")
        cota_str = f"{real_mm:.1f} mm [FIJADO]" if (real_mm and status == "fijado") else f"~{m['provisionalLengthM']:.2f} m [{status.upper()}]"
        dbx = _add_linear_dim_dxf(msp, p1, p2, offset=-240.0, text_str=f"{wlabel}: {cota_str}")
        min_x, min_y = min(min_x, dbx[0]), min(min_y, dbx[1])
        max_x, max_y = max(max_x, dbx[2]), max(max_y, dbx[3])

        # Proyección de ventanas/vanos en planta sobre el espesor del muro
        L = m["geomLengthMm"]
        if L > 1e-3:
            tx, ty = (m["bx"] - m["ax"]) / L, (m["by"] - m["ay"]) / L
            th = float(w.get("thicknessMm") or 150.0)
            nx, ny = outward_normal_for_wall(tx, ty, int(w.get("outwardNormalSign", 1)))
            for el in w.get("elements", []):
                if el.get("category") in ("WINDOW", "OPENING"):
                    refs = el.get("references") or {}
                    u_left = float(refs.get("distLeftMm") or (L * 0.5))
                    s_center = topological_s_from_visible_u(L, u_left, el.get("face", "FRONT"))
                    ew = float(el.get("widthMm") or 900.0)
                    s0 = max(0.0, s_center - ew * 0.5)
                    s1 = min(L, s_center + ew * 0.5)
                    if s1 > s0:
                        w_pts = [
                            (p1[0] + s0 * tx, p1[1] + s0 * ty),
                            (p1[0] + s1 * tx, p1[1] + s1 * ty),
                            (p1[0] + s1 * tx + th * nx, p1[1] + s1 * ty + th * ny),
                            (p1[0] + s0 * tx + th * nx, p1[1] + s0 * ty + th * ny),
                        ]
                        lyr = "A_VENTANAS" if el.get("category") == "WINDOW" else "A_VANOS"
                        _add_closed_lwpolyline(msp, w_pts, lyr)

    # Separaciones / huecos entre muros (nunca se cierran automáticamente)
    for sep in concept.get("separations", []):
        s1 = (float(sep.get("x1Mm", 0.0)) + shift_x, float(sep.get("y1Mm", 0.0)) + shift_y)
        s2 = (float(sep.get("x2Mm", 0.0)) + shift_x, float(sep.get("y2Mm", 0.0)) + shift_y)
        msp.add_line(s1, s2, dxfattribs={"layer": "A_MUROS_EJES"})
        dist_mm = float(sep.get("distanceMm") or math.hypot(s2[0] - s1[0], s2[1] - s1[1]))
        _add_linear_dim_dxf(msp, s1, s2, offset=180.0, text_str=f"SEPARACION: {dist_mm:.1f} mm")

    # Bases de concreto / pollos y sardineles en planta
    for pb in concept.get("concreteBases", []):
        x0 = float(pb.get("xMm", 0.0)) + shift_x
        y0 = float(pb.get("yMm", 0.0)) + shift_y
        length_mm = float(pb.get("lengthMm", 1000.0))
        width_mm = float(pb.get("widthMm", 600.0))
        ang = math.radians(float(pb.get("angleDeg", 0.0)))
        ux, uy = math.cos(ang), math.sin(ang)
        vx, vy = -uy, ux
        pts = [
            (x0, y0),
            (x0 + length_mm * ux, y0 + length_mm * uy),
            (x0 + length_mm * ux + width_mm * vx, y0 + length_mm * uy + width_mm * vy),
            (x0 + width_mm * vx, y0 + width_mm * vy),
        ]
        layer_name = "A_SARDINELES" if pb.get("kind") == "SARDINEL" else "A_BASES_CONCRETO"
        _add_closed_lwpolyline(msp, pts, layer_name)
        pblabel = _sanitize_dxf_text(
            f"{pb.get('label', 'Pollo')} ({length_mm:.0f}x{width_mm:.0f}xH{float(pb.get('heightMm', 100)):.0f} mm)"
        )
        msp.add_text(
            pblabel,
            dxfattribs={"layer": "C_IDENTIFICADORES", "height": 50.0, "insert": (x0 + 60.0, y0 + 60.0)},
        )
        refs = pb.get("references") or {}
        ref_txt = (
            f"Ref Izq:{refs.get('distLeftWallMm', 0)} Der:{refs.get('distRightWallMm', 0)} "
            f"Fondo:{refs.get('distBackWallMm', 0)} mm"
        )
        msp.add_text(
            _sanitize_dxf_text(ref_txt),
            dxfattribs={"layer": "C_COTAS", "height": 42.0, "insert": (x0 + 60.0, y0 + 130.0)},
        )
        for px, py in pts:
            min_x, max_x = min(min_x, px), max(max_x, px)
            min_y, max_y = min(min_y, py), max(max_y, py)

    # Marco y título de la vista de Planta
    pad = 450.0
    box_min_x, box_min_y = min_x - pad, min_y - pad
    box_max_x, box_max_y = max_x + pad, max_y + pad
    _add_closed_lwpolyline(
        msp,
        [(box_min_x, box_min_y), (box_max_x, box_min_y), (box_max_x, box_max_y), (box_min_x, box_max_y)],
        "REF_ELEVACIONES",
    )
    title_str = f"PLANTA: {cname} ({ctype}) | {stamp_text}"
    msp.add_text(
        _sanitize_dxf_text(title_str),
        dxfattribs={"layer": "C_IDENTIFICADORES", "height": 85.0, "insert": (box_min_x + 80.0, box_max_y + 110.0)},
    )
    return {
        "title": f"PLANTA_{cname}",
        "minX": round(box_min_x, 2),
        "minY": round(box_min_y, 2),
        "maxX": round(box_max_x, 2),
        "maxY": round(box_max_y + 260.0, 2),
    }


def _draw_wall_elevation_dxf(
    msp: Any,
    concept: Dict[str, Any],
    wall: Dict[str, Any],
    vmap: Dict[str, Dict[str, Any]],
    origin_x: float,
    origin_y: float,
    project_height_mm: float,
) -> Dict[str, Any]:
    m = wall_geometry_metrics(wall, vmap)
    L = float(wall.get("realLengthMm") or m["geomLengthMm"] or 1000.0)
    H = float(wall.get("heightMm") or concept.get("heightMm") or project_height_mm or 2600.0)
    wlabel = _sanitize_dxf_text(f"{wall.get('label', 'Muro')} ({wall.get('code', 'M01')})")
    cname = _sanitize_dxf_text(concept.get("name", "Ambiente"))

    x0 = origin_x + 400.0
    y0 = origin_y + 500.0

    # Contorno frontal del muro en elevación
    wall_rect = [(x0, y0), (x0 + L, y0), (x0 + L, y0 + H), (x0, y0 + H)]
    _add_closed_lwpolyline(msp, wall_rect, "A_MUROS_CONTORNO")
    # Línea de piso terminado NPT = 0
    msp.add_line((x0 - 200.0, y0), (x0 + L + 200.0, y0), dxfattribs={"layer": "REF_ELEVACIONES"})
    msp.add_text("NPT ±0.00 mm", dxfattribs={"layer": "C_IDENTIFICADORES", "height": 45.0, "insert": (x0 - 180.0, y0 - 80.0)})

    # Cotas generales del muro (Ancho L y Altura H)
    _add_linear_dim_dxf(msp, (x0, y0), (x0 + L, y0), offset=-240.0, text_str=f"ANCHO {wlabel}: {L:.1f} mm")
    _add_linear_dim_dxf(msp, (x0 + L, y0), (x0 + L, y0 + H), offset=-240.0, text_str=f"ALTURA: {H:.1f} mm")

    # Proyección de pollos de concreto adyacentes a este muro
    for pb in concept.get("concreteBases", []):
        if pb.get("hostWallId") == wall["id"]:
            pb_h = float(pb.get("heightMm") or 100.0)
            pb_len = min(L, float(pb.get("lengthMm") or L))
            pb_u0 = float((pb.get("references") or {}).get("distLeftWallMm") or 0.0)
            pb_u1 = min(L, pb_u0 + pb_len)
            if pb_u1 > pb_u0:
                _add_closed_lwpolyline(
                    msp,
                    [(x0 + pb_u0, y0), (x0 + pb_u1, y0), (x0 + pb_u1, y0 + pb_h), (x0 + pb_u0, y0 + pb_h)],
                    "A_BASES_CONCRETO",
                )

    # Elementos e instalaciones del muro con sus 4 referencias
    for idx, el in enumerate(wall.get("elements", []), start=1):
        refs = el.get("references") or {}
        u_left = float(refs.get("distLeftMm") if refs.get("distLeftMm") is not None else L * 0.5)
        u_right = float(refs.get("distRightMm") if refs.get("distRightMm") is not None else (L - u_left))
        v_floor = float(refs.get("distFloorMm") if refs.get("distFloorMm") is not None else 1100.0)
        v_top = float(refs.get("distTopMm") if refs.get("distTopMm") is not None else (H - v_floor))

        cx = x0 + u_left
        cy = y0 + v_floor
        cat = el.get("category", "ELECTRICAL")
        el_code = _sanitize_dxf_text(el.get("code") or f"EL{idx:02d}")
        prov_tag = "MED" if el.get("provenance") == "MEASURED" else "PRESET"

        if cat == "ELECTRICAL":
            ew = float(el.get("widthMm") or 70.0)
            eh = float(el.get("heightMm") or 115.0)
            pts = [
                (cx - ew * 0.5, cy - eh * 0.5),
                (cx + ew * 0.5, cy - eh * 0.5),
                (cx + ew * 0.5, cy + eh * 0.5),
                (cx - ew * 0.5, cy + eh * 0.5),
            ]
            _add_closed_lwpolyline(msp, pts, "I_ELECTRICA")
            # Símbolo cruz de centro
            msp.add_line((cx - 25.0, cy), (cx + 25.0, cy), dxfattribs={"layer": "I_ELECTRICA"})
            msp.add_line((cx, cy - 25.0), (cx, cy + 25.0), dxfattribs={"layer": "I_ELECTRICA"})
        elif cat == "PLUMBING":
            if el.get("isSet", False):
                # Conjunto hidrosanitario: drenaje en centro, AC a izq, AF a der, conservando centro del conjunto
                d_rad = float(el.get("drainDiameterMm") or 50.0) * 0.5
                s_rad = float(el.get("supplyDiameterMm") or 13.0) * 0.5
                hot_dx = float(el.get("hotOffsetUMm", -100.0))
                hot_dy = float(el.get("hotOffsetVMm", 50.0))
                cold_dx = float(el.get("coldOffsetUMm", 100.0))
                cold_dy = float(el.get("coldOffsetVMm", 50.0))
                msp.add_circle((cx, cy), radius=d_rad, dxfattribs={"layer": "I_HIDROSANITARIA"})
                msp.add_circle((cx + hot_dx, cy + hot_dy), radius=max(s_rad, 12.0), dxfattribs={"layer": "I_HIDROSANITARIA"})
                msp.add_circle((cx + cold_dx, cy + cold_dy), radius=max(s_rad, 12.0), dxfattribs={"layer": "I_HIDROSANITARIA"})
                msp.add_line((cx + hot_dx, cy), (cx + cold_dx, cy), dxfattribs={"layer": "I_HIDROSANITARIA"})
            else:
                rad = max(float(el.get("diameterMm") or 25.0) * 0.5, 15.0)
                msp.add_circle((cx, cy), radius=rad, dxfattribs={"layer": "I_HIDROSANITARIA"})
            msp.add_line((cx - 30.0, cy), (cx + 30.0, cy), dxfattribs={"layer": "I_HIDROSANITARIA"})
            msp.add_line((cx, cy - 30.0), (cx, cy + 30.0), dxfattribs={"layer": "I_HIDROSANITARIA"})
        elif cat in ("WINDOW", "OPENING"):
            ew = float(el.get("widthMm") or 1200.0)
            eh = float(el.get("heightMm") or 1100.0)
            lyr = "A_VENTANAS" if cat == "WINDOW" else "A_VANOS"
            pts = [
                (cx - ew * 0.5, cy - eh * 0.5),
                (cx + ew * 0.5, cy - eh * 0.5),
                (cx + ew * 0.5, cy + eh * 0.5),
                (cx - ew * 0.5, cy + eh * 0.5),
            ]
            _add_closed_lwpolyline(msp, pts, lyr)

        # Líneas auxiliares de las 4 referencias al centro (Izq, Der, Piso, Arriba) en C_COTAS
        msp.add_line((x0, cy), (cx, cy), dxfattribs={"layer": "C_COTAS"})
        msp.add_line((cx, cy), (x0 + L, cy), dxfattribs={"layer": "C_COTAS"})
        msp.add_line((cx, y0), (cx, cy), dxfattribs={"layer": "C_COTAS"})
        msp.add_line((cx, cy), (cx, y0 + H), dxfattribs={"layer": "C_COTAS"})

        ref_note = f"{el_code}[{prov_tag}] Izq:{u_left:.0f} Der:{u_right:.0f} Piso:{v_floor:.0f} Sup:{v_top:.0f}mm"
        msp.add_text(
            _sanitize_dxf_text(ref_note),
            dxfattribs={"layer": "C_IDENTIFICADORES", "height": 38.0, "insert": (cx + 35.0, cy + 35.0)},
        )

    box_min_x = origin_x
    box_min_y = origin_y
    box_max_x = x0 + L + 650.0
    box_max_y = y0 + H + 450.0
    _add_closed_lwpolyline(
        msp,
        [(box_min_x, box_min_y), (box_max_x, box_min_y), (box_max_x, box_max_y), (box_min_x, box_max_y)],
        "REF_ELEVACIONES",
    )
    msp.add_text(
        _sanitize_dxf_text(f"ELEVACION FRONTAL: {cname} - {wlabel} ({L:.0f} x {H:.0f} mm)"),
        dxfattribs={"layer": "C_IDENTIFICADORES", "height": 75.0, "insert": (box_min_x + 60.0, box_max_y + 90.0)},
    )
    return {
        "title": f"ELEVACION_{cname}_{wlabel}",
        "minX": round(box_min_x, 2),
        "minY": round(box_min_y, 2),
        "maxX": round(box_max_x, 2),
        "maxY": round(box_max_y + 220.0, 2),
    }


def _draw_door_concept_dxf(
    msp: Any,
    concept: Dict[str, Any],
    origin_x: float,
    origin_y: float,
    stamp_text: str,
) -> Dict[str, Any]:
    cname = _sanitize_dxf_text(concept.get("name", "Puerta de Intercomunicación"))
    ds = concept.get("doorSurvey") or {}
    ev = evaluate_door_nine_readings(
        ds.get("widths", {}),
        ds.get("heights", {}),
        ds.get("thicknesses", {}),
        ceiling_height_mm=float(ds.get("ceilingHeightMm") or 2600.0),
        base_offset_mm=float(ds.get("baseOffsetMm") or 0.0),
    )

    mins = ev.get("referenceMinimumsMm") or {"widthMm": 900.0, "heightMm": 2100.0, "thicknessMm": 150.0}
    w_min = float(mins["widthMm"])
    h_min = float(mins["heightMm"])
    t_min = float(mins["thicknessMm"])

    x0 = origin_x + 450.0
    y0 = origin_y + 550.0

    # 1. Geometría frontal de referencia del vano usando los MÍNIMOS (Sección 5 del Prompt)
    door_frontal = [(x0, y0), (x0 + w_min, y0), (x0 + w_min, y0 + h_min), (x0, y0 + h_min)]
    _add_closed_lwpolyline(msp, door_frontal, "A_VANOS")

    # Franja conceptual superior si el techo local es mayor que el vano
    top_strip = ev.get("topStripConceptualMm")
    if isinstance(top_strip, (int, float)) and top_strip > 0:
        strip_pts = [
            (x0, y0 + h_min),
            (x0 + w_min, y0 + h_min),
            (x0 + w_min, y0 + h_min + top_strip),
            (x0, y0 + h_min + top_strip),
        ]
        _add_closed_lwpolyline(msp, strip_pts, "REF_ELEVACIONES")

    # 2. Vista superior / corte de espesor mínimo separada a la derecha
    sec_x0 = x0 + w_min + 700.0
    sec_pts = [(sec_x0, y0), (sec_x0 + t_min, y0), (sec_x0 + t_min, y0 + h_min), (sec_x0, y0 + h_min)]
    _add_closed_lwpolyline(msp, sec_pts, "A_VANOS")

    # Cotas de los 3 mínimos exportados
    _add_linear_dim_dxf(msp, (x0, y0), (x0 + w_min, y0), offset=-220.0, text_str=f"ANCHO MIN REF: {w_min:.1f} mm")
    _add_linear_dim_dxf(msp, (x0, y0), (x0, y0 + h_min), offset=220.0, text_str=f"ALTO MIN REF: {h_min:.1f} mm")
    _add_linear_dim_dxf(msp, (sec_x0, y0), (sec_x0 + t_min, y0), offset=-220.0, text_str=f"ESPESOR MIN REF: {t_min:.1f} mm")

    # Tabla textual con las 9 lecturas originales en mm y los mínimos (Sección 5 y 6 del Prompt)
    raw = ev.get("originalReadingsMm") or {}
    rw = raw.get("widths") or {}
    rh = raw.get("heights") or {}
    rt = raw.get("thicknesses") or {}
    tx_table = sec_x0 + t_min + 500.0
    ty_table = y0 + h_min - 100.0
    lines = [
        f"PUERTA DE INTERCOMUNICACION: {cname}",
        "9 LECTURAS ORIGINALES CAPTURADAS EN CAMPO (MM):",
        f"  ANCHOS   -> Inf: {rw.get('inferior', '-')} | Med: {rw.get('medio', '-')} | Sup: {rw.get('superior', '-')} mm",
        f"  ALTOS    -> Izq: {rh.get('izquierdo', '-')} | Cen: {rh.get('centro', '-')} | Der: {rh.get('derecho', '-')} mm",
        f"  ESPESOR  -> Sup: {rt.get('superior', '-')} | Med: {rt.get('medio', '-')} | Inf: {rt.get('inferior', '-')} mm",
        "MINIMOS DE REFERENCIA EXPORTADOS (SIN DESCONTAR HOLGURAS):",
        f"  ANCHO MIN: {w_min:.1f} mm | ALTO MIN: {h_min:.1f} mm | ESPESOR MIN: {t_min:.1f} mm",
        "NOTA: MEDIDAS AS-BUILT DEL VANO. NO SON MEDIDAS DEFINITIVAS DE FABRICACION.",
    ]
    for l_idx, line in enumerate(lines):
        msp.add_text(
            _sanitize_dxf_text(line),
            dxfattribs={"layer": "C_IDENTIFICADORES", "height": 50.0, "insert": (tx_table, ty_table - l_idx * 95.0)},
        )

    box_min_x = origin_x
    box_min_y = origin_y
    box_max_x = tx_table + 2600.0
    box_max_y = y0 + h_min + max(float(top_strip or 0.0), 0.0) + 450.0
    _add_closed_lwpolyline(
        msp,
        [(box_min_x, box_min_y), (box_max_x, box_min_y), (box_max_x, box_max_y), (box_min_x, box_max_y)],
        "REF_ELEVACIONES",
    )
    msp.add_text(
        _sanitize_dxf_text(f"VISTA FRONTAL VANO PUERTA: {cname} | {stamp_text}"),
        dxfattribs={"layer": "C_IDENTIFICADORES", "height": 80.0, "insert": (box_min_x + 60.0, box_max_y + 90.0)},
    )
    return {
        "title": f"PUERTA_{cname}",
        "minX": round(box_min_x, 2),
        "minY": round(box_min_y, 2),
        "maxX": round(box_max_x, 2),
        "maxY": round(box_max_y + 220.0, 2),
    }


# ==============================================================================
# 6. EXPORTADOR PDF VECTORIAL MULTIPÁGINA (SIN SOLAPAMIENTOS, CON ESCALA)
# ==============================================================================

def export_project_to_pdf_bytes(
    project: Dict[str, Any],
    confirm_preliminary: bool = True,
) -> Tuple[bytes, Dict[str, Any]]:
    """
    Sección 6 del Prompt Operativo:
    PDF: plantas, elevaciones, cotas, IDs, accesorios, notas y datos de proyecto.
    Puertas con esquema, nueve medidas y mínimos. Evitar solapamientos e indicar escala o 'sin escala'.
    """
    project_snapshot = copy.deepcopy(project)
    audit_info = audit_project_for_export(project_snapshot)
    if audit_info["requiresPreliminaryConfirmation"] and not confirm_preliminary:
        raise ValueError(
            "El proyecto contiene datos faltantes o conflictos. Confirme la exportación preliminar para generar el PDF."
        )

    buf = io.BytesIO()
    page_w, page_h = landscape(A4)
    c = pdf_canvas.Canvas(buf, pagesize=(page_w, page_h))
    pages_count = 0

    def draw_header_footer(title: str, subtitle: str, scale_label: str) -> None:
        nonlocal pages_count
        pages_count += 1
        # Marco exterior
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.setLineWidth(1)
        c.rect(10 * rl_mm, 10 * rl_mm, page_w - 20 * rl_mm, page_h - 20 * rl_mm)

        # Banda superior
        c.setFillColor(colors.HexColor("#f8fafc"))
        c.rect(10 * rl_mm, page_h - 28 * rl_mm, page_w - 20 * rl_mm, 18 * rl_mm, fill=1, stroke=1)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 12)
        c.drawString(14 * rl_mm, page_h - 17 * rl_mm, f"LEVANTAMIENTO AS-BUILT: {project_snapshot.get('name', 'Proyecto')}")
        c.setFont("Helvetica", 9)
        c.setFillColor(colors.HexColor("#334155"))
        c.drawString(14 * rl_mm, page_h - 23 * rl_mm, f"{title}  |  {subtitle}")

        # Indicador de escala y unidades
        c.setFont("Helvetica-Bold", 9)
        c.drawRightString(page_w - 14 * rl_mm, page_h - 17 * rl_mm, f"UNIDADES: MILÍMETROS (mm)  |  {scale_label}")
        c.setFont("Helvetica", 8)
        c.drawRightString(
            page_w - 14 * rl_mm,
            page_h - 23 * rl_mm,
            f"Cliente/Obra: {project_snapshot.get('client', 'N/A')} | Altura Gral: {project_snapshot.get('predominantHeightMm', 2600)} mm",
        )

        # Sello preliminar si aplica
        if audit_info["requiresPreliminaryConfirmation"]:
            c.setFillColor(colors.HexColor("#fef2f2"))
            c.setStrokeColor(colors.HexColor("#dc2626"))
            c.rect(14 * rl_mm, 12 * rl_mm, 145 * rl_mm, 7 * rl_mm, fill=1, stroke=1)
            c.setFillColor(colors.HexColor("#b91c1c"))
            c.setFont("Helvetica-Bold", 8)
            c.drawString(16 * rl_mm, 14.2 * rl_mm, "EXPORTACIÓN PRELIMINAR / INCOMPLETA - CONTIENE DATOS PENDIENTES O CONFLICTOS")
        else:
            c.setFillColor(colors.HexColor("#ecfdf5"))
            c.setStrokeColor(colors.HexColor("#059669"))
            c.rect(14 * rl_mm, 12 * rl_mm, 110 * rl_mm, 7 * rl_mm, fill=1, stroke=1)
            c.setFillColor(colors.HexColor("#047857"))
            c.setFont("Helvetica-Bold", 8)
            c.drawString(16 * rl_mm, 14.2 * rl_mm, "EXPEDIENTE AS-BUILT VALIDADO - GEOMETRÍA EN MILÍMETROS (mm)")

        c.setFillColor(colors.HexColor("#475569"))
        c.setFont("Helvetica", 8)
        c.drawRightString(
            page_w - 14 * rl_mm,
            14.2 * rl_mm,
            f"AS-BUILT (No constituye plano de fabricación) | Pág. {pages_count}",
        )

    # Cada concepto genera sus láminas sin solapamientos
    for concept in project_snapshot.get("concepts", []):
        cname = concept.get("name", "Concepto")
        ctype = concept.get("conceptType", "OTRO")

        if ctype == "PUERTA" or concept.get("mode") == "DOOR_FRONTAL":
            _draw_pdf_door_page(c, page_w, page_h, concept, project_snapshot, draw_header_footer)
            c.showPage()
            continue

        # Lámina de Planta del Concepto
        _draw_pdf_plan_page(c, page_w, page_h, concept, project_snapshot, draw_header_footer)
        c.showPage()

        # Lámina de Elevación por cada Muro del Concepto
        vmap = get_vertex_map(concept)
        for wall in concept.get("walls", []):
            _draw_pdf_elevation_page(c, page_w, page_h, concept, wall, vmap, project_snapshot, draw_header_footer)
            c.showPage()

    if pages_count == 0:
        draw_header_footer("Resumen de Proyecto", "Sin conceptos registrados", "Sin escala")
        c.showPage()

    c.save()
    pdf_bytes = buf.getvalue()
    return pdf_bytes, {
        "pagesCount": pages_count,
        "byteSize": len(pdf_bytes),
        "isPreliminary": audit_info["requiresPreliminaryConfirmation"],
        "stampText": audit_info["stampText"],
    }


def _draw_pdf_plan_page(
    c: Any,
    page_w: float,
    page_h: float,
    concept: Dict[str, Any],
    project: Dict[str, Any],
    draw_header_footer: Any,
) -> None:
    cname = concept.get("name", "Ambiente")
    ctype = concept.get("conceptType", "AMBIENTE")
    vmap = get_vertex_map(concept)
    walls = concept.get("walls", [])

    # Calcular bounding box en mm para determinar escala
    xs = [float(v["xMm"]) for v in concept.get("vertices", [])] or [0.0, 3000.0]
    ys = [float(v["yMm"]) for v in concept.get("vertices", [])] or [0.0, 2500.0]
    for pb in concept.get("concreteBases", []):
        xs.extend([float(pb.get("xMm", 0)), float(pb.get("xMm", 0)) + float(pb.get("lengthMm", 1000))])
        ys.extend([float(pb.get("yMm", 0)), float(pb.get("yMm", 0)) + float(pb.get("widthMm", 600))])

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    span_x = max(max_x - min_x, 1000.0)
    span_y = max(max_y - min_y, 1000.0)

    draw_area_x = 16 * rl_mm
    draw_area_y = 26 * rl_mm
    draw_area_w = 165 * rl_mm
    draw_area_h = page_h - 62 * rl_mm

    scale_px_per_mm = min((draw_area_w - 24 * rl_mm) / span_x, (draw_area_h - 24 * rl_mm) / span_y)
    # Escala aproximada (1 : N)
    approx_denom = max(1, int(round(rl_mm / scale_px_per_mm)))
    scale_label = f"Escala aprox. 1:{approx_denom} (Cotas en mm gobiernan)"

    draw_header_footer(
        f"PLANTA ARQUITECTÓNICA AS-BUILT · {cname} ({ctype})",
        f"Muros: {len(walls)} | Bases/Pollos: {len(concept.get('concreteBases', []))} | Separaciones: {len(concept.get('separations', []))}",
        scale_label,
    )

    def to_pt(xmm: float, ymm: float) -> Tuple[float, float]:
        px = draw_area_x + 12 * rl_mm + (xmm - min_x) * scale_px_per_mm
        py = draw_area_y + 12 * rl_mm + (ymm - min_y) * scale_px_per_mm
        return (px, py)

    # Lienzo de dibujo
    c.setStrokeColor(colors.HexColor("#e2e8f0"))
    c.rect(draw_area_x, draw_area_y, draw_area_w, draw_area_h, fill=0, stroke=1)

    # Dibujar bases de concreto / pollos
    for pb in concept.get("concreteBases", []):
        x0, y0 = float(pb.get("xMm", 0)), float(pb.get("yMm", 0))
        l_mm, w_mm = float(pb.get("lengthMm", 1000)), float(pb.get("widthMm", 600))
        p_bl = to_pt(x0, y0)
        p_tr = to_pt(x0 + l_mm, y0 + w_mm)
        c.setFillColor(colors.HexColor("#f1f5f9"))
        c.setStrokeColor(colors.HexColor("#64748b"))
        c.setDash(3, 2)
        c.rect(p_bl[0], p_bl[1], p_tr[0] - p_bl[0], p_tr[1] - p_bl[1], fill=1, stroke=1)
        c.setDash()
        c.setFillColor(colors.HexColor("#334155"))
        c.setFont("Helvetica-Bold", 7)
        c.drawString(p_bl[0] + 4, p_bl[1] + 5, f"{pb.get('label', 'Pollo')}: {l_mm:.0f}×{w_mm:.0f} mm (H={pb.get('heightMm', 100)} mm)")

    # Dibujar separaciones / huecos
    for sep in concept.get("separations", []):
        p1 = to_pt(float(sep.get("x1Mm", 0)), float(sep.get("y1Mm", 0)))
        p2 = to_pt(float(sep.get("x2Mm", 0)), float(sep.get("y2Mm", 0)))
        c.setStrokeColor(colors.HexColor("#d97706"))
        c.setDash(4, 3)
        c.setLineWidth(1.5)
        c.line(p1[0], p1[1], p2[0], p2[1])
        c.setDash()
        c.setFillColor(colors.HexColor("#b45309"))
        c.setFont("Helvetica-Bold", 7.5)
        c.drawCentredString(0.5 * (p1[0] + p2[0]), 0.5 * (p1[1] + p2[1]) + 6, f"Hueco: {float(sep.get('distanceMm', 0)):.0f} mm")

    # Dibujar muros con IDs y cotas evitando solapamiento
    for idx, w in enumerate(walls):
        m = wall_geometry_metrics(w, vmap)
        p1 = to_pt(m["ax"], m["ay"])
        p2 = to_pt(m["bx"], m["by"])
        status = w.get("status", "provisional")
        if status == "conflicto":
            c.setStrokeColor(colors.HexColor("#dc2626"))
        elif status == "fijado":
            c.setStrokeColor(colors.HexColor("#0f172a"))
        else:
            c.setStrokeColor(colors.HexColor("#2563eb"))
            c.setDash(4, 2)

        c.setLineWidth(3.0)
        c.line(p1[0], p1[1], p2[0], p2[1])
        c.setDash()

        mx, my = 0.5 * (p1[0] + p2[0]), 0.5 * (p1[1] + p2[1])
        dx, dy = p2[0] - p1[0], p2[1] - p1[1]
        seg_len = max(math.hypot(dx, dy), 1.0)
        nx, ny = -dy / seg_len, dx / seg_len
        offset_pt = 14.0 + (idx % 2) * 8.0

        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 8)
        wlabel = w.get("label", f"Muro {idx + 1}")
        real_mm = w.get("realLengthMm")
        dim_label = f"{wlabel}: {real_mm:.0f} mm" if (real_mm and status == "fijado") else f"{wlabel}: ~{m['provisionalLengthM']:.2f} m (Prov.)"
        c.drawCentredString(mx + nx * offset_pt, my + ny * offset_pt, dim_label)

    # Tabla lateral derecha de Muros, Bases de Concreto y Notas
    tx = draw_area_x + draw_area_w + 5 * rl_mm
    ty = page_h - 36 * rl_mm
    tw = page_w - tx - 12 * rl_mm

    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 9.5)
    c.drawString(tx, ty, "TABLA DE MUROS (ORDEN IZQ → DER)")
    ty -= 5 * rl_mm
    c.setFont("Helvetica-Bold", 7.5)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawString(tx, ty, "ID / Muro")
    c.drawString(tx + 28 * rl_mm, ty, "Cota Real (mm)")
    c.drawString(tx + 54 * rl_mm, ty, "Ángulo")
    c.drawString(tx + 70 * rl_mm, ty, "Estado")
    ty -= 2 * rl_mm
    c.line(tx, ty, tx + tw, ty)
    ty -= 4 * rl_mm

    c.setFont("Helvetica", 7.5)
    for w in walls[:18]:
        m = wall_geometry_metrics(w, vmap)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.drawString(tx, ty, f"{w.get('label', 'Muro')} ({w.get('code', 'M')})")
        real_mm = w.get("realLengthMm")
        c.drawString(tx + 28 * rl_mm, ty, f"{real_mm:.1f} mm" if real_mm else f"~{m['provisionalLengthM']:.2f} m")
        c.drawString(tx + 54 * rl_mm, ty, f"{float(w.get('angleDeg', m['geomAngleDeg'])):.1f}°")
        st = w.get("status", "provisional").upper()
        c.drawString(tx + 70 * rl_mm, ty, st)
        ty -= 4.2 * rl_mm

    if concept.get("concreteBases"):
        ty -= 3 * rl_mm
        c.setFont("Helvetica-Bold", 9)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.drawString(tx, ty, "BASES DE CONCRETO / POLLOS")
        ty -= 4.5 * rl_mm
        c.setFont("Helvetica", 7.2)
        for pb in concept.get("concreteBases", [])[:6]:
            refs = pb.get("references") or {}
            c.drawString(
                tx,
                ty,
                f"• {pb.get('label', 'Pollo')}: {pb.get('lengthMm', 0)}×{pb.get('widthMm', 0)}×H{pb.get('heightMm', 100)} mm "
                f"(Izq:{refs.get('distLeftWallMm', 0)} / Der:{refs.get('distRightWallMm', 0)} mm)",
            )
            ty -= 4 * rl_mm

    if concept.get("notes") or project.get("notes"):
        ty -= 3 * rl_mm
        c.setFont("Helvetica-Bold", 8.5)
        c.drawString(tx, ty, "NOTAS DE CAMPO:")
        ty -= 4 * rl_mm
        c.setFont("Helvetica", 7.2)
        note_str = f"{concept.get('notes', '')} {project.get('notes', '')}".strip()
        c.drawString(tx, ty, note_str[:95])


def _draw_pdf_elevation_page(
    c: Any,
    page_w: float,
    page_h: float,
    concept: Dict[str, Any],
    wall: Dict[str, Any],
    vmap: Dict[str, Dict[str, Any]],
    project: Dict[str, Any],
    draw_header_footer: Any,
) -> None:
    cname = concept.get("name", "Ambiente")
    wlabel = wall.get("label", "Muro")
    wcode = wall.get("code", "M01")
    m = wall_geometry_metrics(wall, vmap)
    L = float(wall.get("realLengthMm") or m["geomLengthMm"] or 1000.0)
    H = float(wall.get("heightMm") or concept.get("heightMm") or project.get("predominantHeightMm") or 2600.0)

    draw_area_x = 18 * rl_mm
    draw_area_y = 28 * rl_mm
    draw_area_w = 155 * rl_mm
    draw_area_h = page_h - 65 * rl_mm

    scale_px = min((draw_area_w - 25 * rl_mm) / max(L, 1.0), (draw_area_h - 25 * rl_mm) / max(H, 1.0))
    approx_denom = max(1, int(round(rl_mm / scale_px)))
    draw_header_footer(
        f"ELEVACIÓN FRONTAL · {cname} · {wlabel} ({wcode})",
        f"Ancho Real: {L:.1f} mm  |  Altura Real: {H:.1f} mm  |  Dispositivos: {len(wall.get('elements', []))}",
        f"Escala aprox. 1:{approx_denom} (Cotas en mm gobiernan)",
    )

    wx0 = draw_area_x + 12 * rl_mm
    wy0 = draw_area_y + 12 * rl_mm
    ww = L * scale_px
    wh = H * scale_px

    # Contorno del muro en elevación
    c.setFillColor(colors.HexColor("#ffffff"))
    c.setStrokeColor(colors.HexColor("#0f172a"))
    c.setLineWidth(2.0)
    c.rect(wx0, wy0, ww, wh, fill=1, stroke=1)

    # Cotas de ancho y alto del muro
    c.setFont("Helvetica-Bold", 8.5)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.drawCentredString(wx0 + ww * 0.5, wy0 - 6 * rl_mm, f"Ancho {wlabel}: {L:.1f} mm")
    c.drawString(wx0 + ww + 3 * rl_mm, wy0 + wh * 0.5, f"H = {H:.1f} mm")

    # Elementos posicionados con sus 4 referencias
    elements = wall.get("elements", [])
    for idx, el in enumerate(elements, start=1):
        refs = el.get("references") or {}
        u_left = float(refs.get("distLeftMm") if refs.get("distLeftMm") is not None else L * 0.5)
        u_right = float(refs.get("distRightMm") if refs.get("distRightMm") is not None else (L - u_left))
        v_floor = float(refs.get("distFloorMm") if refs.get("distFloorMm") is not None else 1100.0)
        v_top = float(refs.get("distTopMm") if refs.get("distTopMm") is not None else (H - v_floor))

        cx = wx0 + u_left * scale_px
        cy = wy0 + v_floor * scale_px
        ew = max(float(el.get("widthMm") or 70.0) * scale_px, 8.0)
        eh = max(float(el.get("heightMm") or 115.0) * scale_px, 8.0)

        # Líneas punteadas hacia las 4 referencias (Izquierda, Derecha, Piso, Arriba)
        c.setStrokeColor(colors.HexColor("#94a3b8"))
        c.setLineWidth(0.6)
        c.setDash(2, 2)
        c.line(wx0, cy, cx, cy)
        c.line(cx, cy, wx0 + ww, cy)
        c.line(cx, wy0, cx, cy)
        c.line(cx, cy, cx, wy0 + wh)
        c.setDash()

        cat = el.get("category", "ELECTRICAL")
        if cat == "ELECTRICAL":
            c.setStrokeColor(colors.HexColor("#dc2626"))
            c.setFillColor(colors.HexColor("#fef2f2"))
            c.rect(cx - ew * 0.5, cy - eh * 0.5, ew, eh, fill=1, stroke=1)
        elif cat == "PLUMBING":
            c.setStrokeColor(colors.HexColor("#2563eb"))
            c.setFillColor(colors.HexColor("#eff6ff"))
            c.circle(cx, cy, max(ew * 0.35, 5.0), fill=1, stroke=1)
        else:
            c.setStrokeColor(colors.HexColor("#0891b2"))
            c.setFillColor(colors.HexColor("#ecfeff"))
            c.rect(cx - ew * 0.5, cy - eh * 0.5, ew, eh, fill=1, stroke=1)

        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 7)
        el_code = el.get("code") or f"EL{idx:02d}"
        c.drawString(cx + 5, cy + 4, f"{el_code} ({u_left:.0f}/{u_right:.0f} | {v_floor:.0f}/{v_top:.0f})")

    # Tabla lateral con las 4 referencias exactas de cada elemento
    tx = draw_area_x + draw_area_w + 4 * rl_mm
    ty = page_h - 36 * rl_mm
    tw = page_w - tx - 12 * rl_mm
    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 9)
    c.drawString(tx, ty, "INSTALACIONES Y VANOS (4 REFERENCIAS EN MM)")
    ty -= 5 * rl_mm
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawString(tx, ty, "ID / Tipo")
    c.drawString(tx + 34 * rl_mm, ty, "Izq (mm)")
    c.drawString(tx + 49 * rl_mm, ty, "Der (mm)")
    c.drawString(tx + 64 * rl_mm, ty, "Piso (mm)")
    c.drawString(tx + 79 * rl_mm, ty, "Sup (mm)")
    c.drawString(tx + 93 * rl_mm, ty, "Origen")
    ty -= 2 * rl_mm
    c.line(tx, ty, tx + tw, ty)
    ty -= 4 * rl_mm

    c.setFont("Helvetica", 7)
    for idx, el in enumerate(elements[:20], start=1):
        refs = el.get("references") or {}
        u_l = float(refs.get("distLeftMm") or 0)
        u_r = float(refs.get("distRightMm") or (L - u_l))
        v_f = float(refs.get("distFloorMm") or 0)
        v_t = float(refs.get("distTopMm") or (H - v_f))
        c.setFillColor(colors.HexColor("#0f172a"))
        c.drawString(tx, ty, f"{el.get('code', f'E{idx}')} · {str(el.get('label', el.get('subType', '')))[:16]}")
        c.drawString(tx + 34 * rl_mm, ty, f"{u_l:.1f}")
        c.drawString(tx + 49 * rl_mm, ty, f"{u_r:.1f}")
        c.drawString(tx + 64 * rl_mm, ty, f"{v_f:.1f}")
        c.drawString(tx + 79 * rl_mm, ty, f"{v_t:.1f}")
        c.drawString(tx + 93 * rl_mm, ty, "MED" if el.get("provenance") == "MEASURED" else "PRESET")
        ty -= 4.2 * rl_mm


def _draw_pdf_door_page(
    c: Any,
    page_w: float,
    page_h: float,
    concept: Dict[str, Any],
    project: Dict[str, Any],
    draw_header_footer: Any,
) -> None:
    cname = concept.get("name", "Puerta de Intercomunicación")
    ds = concept.get("doorSurvey") or {}
    ev = evaluate_door_nine_readings(
        ds.get("widths", {}),
        ds.get("heights", {}),
        ds.get("thicknesses", {}),
        ceiling_height_mm=float(ds.get("ceilingHeightMm") or project.get("predominantHeightMm") or 2600.0),
        base_offset_mm=float(ds.get("baseOffsetMm") or 0.0),
    )

    mins = ev.get("referenceMinimumsMm") or {"widthMm": 900.0, "heightMm": 2100.0, "thicknessMm": 150.0}
    w_min, h_min, t_min = float(mins["widthMm"]), float(mins["heightMm"]), float(mins["thicknessMm"])
    draw_header_footer(
        f"PUERTA DE INTERCOMUNICACIÓN (VISTA FRONTAL DEL VANO) · {cname}",
        f"Mínimos de Referencia: {w_min:.1f} × {h_min:.1f} × {t_min:.1f} mm (9 lecturas originales conservadas)",
        "Esquema Técnico (Cotas en mm gobiernan)",
    )

    # Esquema frontal a la izquierda
    vx = 30 * rl_mm
    vy = 32 * rl_mm
    vw = 70 * rl_mm
    vh = 115 * rl_mm
    c.setFillColor(colors.HexColor("#fff7ed"))
    c.setStrokeColor(colors.HexColor("#ea580c"))
    c.setLineWidth(2.2)
    c.rect(vx, vy, vw, vh, fill=1, stroke=1)

    raw = ev.get("originalReadingsMm") or {}
    rw = raw.get("widths") or {}
    rh = raw.get("heights") or {}
    rt = raw.get("thicknesses") or {}

    c.setFillColor(colors.HexColor("#0f172a"))
    c.setFont("Helvetica-Bold", 8.5)
    c.drawCentredString(vx + vw * 0.5, vy + vh - 12, f"Ancho Superior: {rw.get('superior', '-')} mm")
    c.drawCentredString(vx + vw * 0.5, vy + vh * 0.5, f"Ancho Medio: {rw.get('medio', '-')} mm")
    c.drawCentredString(vx + vw * 0.5, vy + 8, f"Ancho Inferior: {rw.get('inferior', '-')} mm")

    c.drawString(vx + 6, vy + vh * 0.72, f"Alto Izq: {rh.get('izquierdo', '-')} mm")
    c.drawCentredString(vx + vw * 0.5, vy + vh * 0.28, f"Alto Centro: {rh.get('centro', '-')} mm")
    c.drawRightString(vx + vw - 6, vy + vh * 0.72, f"Alto Der: {rh.get('derecho', '-')} mm")

    # Tabla derecha con las 9 lecturas y los 3 mínimos
    tx = 120 * rl_mm
    ty = page_h - 42 * rl_mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(tx, ty, "REGISTRO DE 9 LECTURAS ORIGINALES Y MÍNIMOS DE REFERENCIA")
    ty -= 8 * rl_mm

    rows = [
        ("Grupo", "Posición 1", "Posición 2", "Posición 3", "MÍNIMO REF.", "Dispersión Δ"),
        (
            "Ancho del vano",
            f"Inf: {rw.get('inferior', '-')} mm",
            f"Med: {rw.get('medio', '-')} mm",
            f"Sup: {rw.get('superior', '-')} mm",
            f"{w_min:.1f} mm",
            f"{(ev.get('spreadsMm') or {}).get('widthMm', 0):.1f} mm",
        ),
        (
            "Alto del vano",
            f"Izq: {rh.get('izquierdo', '-')} mm",
            f"Cen: {rh.get('centro', '-')} mm",
            f"Der: {rh.get('derecho', '-')} mm",
            f"{h_min:.1f} mm",
            f"{(ev.get('spreadsMm') or {}).get('heightMm', 0):.1f} mm",
        ),
        (
            "Espesor del muro",
            f"Sup: {rt.get('superior', '-')} mm",
            f"Med: {rt.get('medio', '-')} mm",
            f"Inf: {rt.get('inferior', '-')} mm",
            f"{t_min:.1f} mm",
            f"{(ev.get('spreadsMm') or {}).get('thicknessMm', 0):.1f} mm",
        ),
    ]
    col_x = [tx, tx + 32 * rl_mm, tx + 58 * rl_mm, tx + 84 * rl_mm, tx + 110 * rl_mm, tx + 136 * rl_mm]
    for r_idx, row in enumerate(rows):
        c.setFont("Helvetica-Bold" if r_idx == 0 else "Helvetica", 8.5)
        for c_idx, cell in enumerate(row):
            c.drawString(col_x[c_idx], ty, str(cell))
        ty -= 7 * rl_mm

    ty -= 6 * rl_mm
    c.setFillColor(colors.HexColor("#b91c1c"))
    c.setFont("Helvetica-Bold", 8.5)
    c.drawString(tx, ty, ev.get("fabricationNotice", ""))
