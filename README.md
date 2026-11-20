# Asistente de Levantamiento AsBuilt (2D Mobiliario · Rhino 8 Ready)

Aplicación web y local (PC Windows / iPad / Tablet) para levantamientos arquitectónicos **AS-BUILT** orientados a proyectos de mobiliario en **milímetros (mm)**.

## 🔗 Enlace Directo de la Aplicación en GitHub Pages

👉 **[https://luisdelangelledab-max.github.io/asistente-levantamiento-asbuilt/](https://luisdelangelledab-max.github.io/asistente-levantamiento-asbuilt/)**

---

## ✨ Características Principales (v2.5.0)

1. **Boceto Rápido en Planta y Muros Extra Anclados:**
   - Trazo ortogonal o con ángulo manual, muros encadenados y mano alzada.
   - **Muros extra ramificados:** Al hacer clic sobre cualquier muro existente para agregar un muro extra, el nuevo muro nace exactamente sobre la línea del muro anfitrión y genera **dos cotas bilaterales de posicionamiento** (distancia al inicio y al fin del muro anfitrión) editables al milímetro.
   - Herramienta **Huecos / Separaciones** entre extremos de muros y **Bases de Concreto / Pollos** poligonales.
2. **Elevaciones con Puntos de Control Superiores de Altura:**
   - **3 puntos de control superiores por defecto** (`P1 Izq`, `P2 Centro`, `P3 Der`) con opción para **agregar (`+`) o quitar (`-`) puntos de control** y fijar su **altura exacta en mm**, permitiendo plasmar cuartos con diferencias de altura, techos inclinados o escalonados.
   - **Comportamiento diferenciado para Puertas y Ventanas:** Las 4 referencias de puertas y ventanas en elevación están ligadas al **inicio y fin del vano en ambos sentidos** (líneas rojas de paño a paño: `Izq + Ancho + Der = Ancho Muro` y `Piso + Alto + Arriba = Altura Local`).
   - **Contactos Eléctricos y Salidas Hidrosanitarias:** Acotados con 4 referencias visibles a su eje central.
3. **Puertas de Intercomunicación (9 Medidas):**
   - Captura de 3 anchos, 3 altos y 3 espesores con exportación automática de mínimos de referencia sin descontar holguras de fabricación.
4. **Portabilidad y Exportación CAD Certificada:**
   - Importación y exportación de archivos transferibles `.asbuilt.json` entre Computadora e iPad.
   - Exportación **DXF 2D (`AC1024` en milímetros)** compatible directamente con **Rhinoceros 8** (0 errores de auditoría) y **PDF Vectorial**.
