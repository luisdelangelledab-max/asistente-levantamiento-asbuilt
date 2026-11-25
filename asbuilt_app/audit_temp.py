
import ezdxf, sys
try:
    doc = ezdxf.readfile(r"K:\\Mi unidad\\CODEX asistente levantamiento ARQ\\asbuilt_app\\test_export_verified.dxf")
    auditor = doc.audit()
    print(f"Auditor ezdxf: {len(auditor.errors)} errores, {len(auditor.fixes)} fixes")
    if auditor.errors:
        sys.exit(1)
    sys.exit(0)
except Exception as e:
    print(f"Excepcion ezdxf: {e}")
    sys.exit(1)
