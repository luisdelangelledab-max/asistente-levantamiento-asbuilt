# -*- coding: utf-8 -*-
import json
import math
from pathlib import Path
import ezdxf

APP_DIR = Path(__file__).resolve().parent
dxf_path = APP_DIR / "data" / "exports" / "Certificacion_Proyecto_Referencia_MM.dxf"
doc = ezdxf.readfile(str(dxf_path))
aud = doc.audit()
msp = doc.modelspace()

layers = [l.dxf.name for l in doc.layers]
lwpolys = list(msp.query("LWPOLYLINE"))
circles = list(msp.query("CIRCLE"))
lines = list(msp.query("LINE"))
texts = list(msp.query("TEXT"))

vano_boxes = []
for pl in lwpolys:
    if pl.dxf.layer == "A_VANOS":
        pts = [(p[0], p[1]) for p in pl.get_points()]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        vano_boxes.append([round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3)])

pollo_boxes = []
for pl in lwpolys:
    if pl.dxf.layer == "A_BASES_CONCRETO":
        pts = [(p[0], p[1]) for p in pl.get_points()]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        pollo_boxes.append([round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3)])

axis_lengths = []
for ln in lines:
    if ln.dxf.layer == "A_MUROS_EJES":
        s, e = ln.dxf.start, ln.dxf.end
        axis_lengths.append(round(math.hypot(e.x - s.x, e.y - s.y), 3))

elec_boxes = []
for pl in lwpolys:
    if pl.dxf.layer == "I_ELECTRICA":
        pts = [(p[0], p[1]) for p in pl.get_points()]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        elec_boxes.append([round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3)])

report = {
    "dxfFile": str(dxf_path),
    "rhino8InstalledVersion": "Rhinoceros 8.2.23346.13001 (C:\\Program Files\\Rhino 8\\System\\Rhino.exe)",
    "acadver": doc.header.get("$ACADVER"),
    "insunits": doc.header.get("$INSUNITS"),
    "measurement": doc.header.get("$MEASUREMENT"),
    "auditErrors": len(aud.errors),
    "auditFixes": len(aud.fixes),
    "layers": layers,
    "entityCounts": {
        "LWPOLYLINE": len(lwpolys),
        "LINE": len(lines),
        "CIRCLE": len(circles),
        "TEXT": len(texts),
    },
    "allPolylinesClosedAndZeroWidth": all(
        pl.closed and abs(float(pl.dxf.get("const_width", 0.0))) < 1e-9 for pl in lwpolys
    ),
    "measuredWallAxesAndGapLengthsMm": sorted(axis_lengths),
    "measuredDoorVanoBoxesMm": vano_boxes,
    "measuredConcreteBaseBoxesMm": pollo_boxes,
    "measuredElectricalPlateBoxesMm": elec_boxes,
}

out_json = APP_DIR / "data" / "verificacion_dxf_rhino8.json"
out_json.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(json.dumps(report, ensure_ascii=False, indent=2))
