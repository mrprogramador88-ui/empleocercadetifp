"""Siembra del catálogo de demostración académico.

Idempotente y NO importado por server.py. Ejecutar:
    cd /app/backend && python seed.py

Qué siembra:
  - companies: empresas del catálogo de demostración, situadas en municipios
    reales de España (principal) y de Europa, con sus sectores = familia
    profesional FP. SIN teléfonos, correos ni webs inventados (None = no
    disponible hasta conectar una fuente real).
  - offers: ofertas asociadas a cada empresa, con contrato, jornada, requisitos
    y estado (activa/cerrada). Todas con source="catalogo_demo" y sin enlace
    externo (source_url=None): la UI lo comunica expresamente.
"""

import asyncio
from datetime import datetime, timedelta, timezone

from lib.db import client, db, ensure_indexes

# ---------------------------------------------------------------- ciudades ---
# (lat, lng, provincia, comunidad, país, cc) — coordenadas públicas de municipios.
CITIES: dict[str, tuple] = {
    # España
    "Madrid": (40.4168, -3.7038, "Madrid", "Comunidad de Madrid", "España", "es"),
    "Alcalá de Henares": (40.4820, -3.3599, "Madrid", "Comunidad de Madrid", "España", "es"),
    "Barcelona": (41.3874, 2.1686, "Barcelona", "Cataluña", "España", "es"),
    "Sabadell": (41.5433, 2.1092, "Barcelona", "Cataluña", "España", "es"),
    "Valencia": (39.4699, -0.3763, "Valencia", "Comunidad Valenciana", "España", "es"),
    "Alicante": (38.3452, -0.4810, "Alicante", "Comunidad Valenciana", "España", "es"),
    "Elche": (38.2622, -0.7011, "Alicante", "Comunidad Valenciana", "España", "es"),
    "Castellón de la Plana": (39.9864, -0.0513, "Castellón", "Comunidad Valenciana", "España", "es"),
    "Sevilla": (37.3891, -5.9845, "Sevilla", "Andalucía", "España", "es"),
    "Málaga": (36.7213, -4.4213, "Málaga", "Andalucía", "España", "es"),
    "Córdoba": (37.8882, -4.7794, "Córdoba", "Andalucía", "España", "es"),
    "Granada": (37.1773, -3.5986, "Granada", "Andalucía", "España", "es"),
    "Almería": (36.8340, -2.4637, "Almería", "Andalucía", "España", "es"),
    "Jerez de la Frontera": (36.6850, -6.1362, "Cádiz", "Andalucía", "España", "es"),
    "Huelva": (37.2614, -6.9449, "Huelva", "Andalucía", "España", "es"),
    "Jaén": (37.7796, -3.7849, "Jaén", "Andalucía", "España", "es"),
    "Zaragoza": (41.6488, -0.8891, "Zaragoza", "Aragón", "España", "es"),
    "Huesca": (42.1362, -0.4080, "Huesca", "Aragón", "España", "es"),
    "Bilbao": (43.2630, -2.9350, "Vizcaya", "País Vasco", "España", "es"),
    "Vitoria-Gasteiz": (42.8467, -2.6716, "Álava", "País Vasco", "España", "es"),
    "San Sebastián": (43.3183, -1.9812, "Guipúzcoa", "País Vasco", "España", "es"),
    "Vigo": (42.2406, -8.7207, "Pontevedra", "Galicia", "España", "es"),
    "A Coruña": (43.3623, -8.4115, "A Coruña", "Galicia", "España", "es"),
    "Lugo": (43.0096, -7.5540, "Lugo", "Galicia", "España", "es"),
    "Santiago de Compostela": (42.8782, -8.5448, "A Coruña", "Galicia", "España", "es"),
    "Gijón": (43.5322, -5.6611, "Asturias", "Asturias", "España", "es"),
    "Oviedo": (43.3619, -5.8494, "Asturias", "Asturias", "España", "es"),
    "Santander": (43.4623, -3.8099, "Cantabria", "Cantabria", "España", "es"),
    "Pamplona": (42.8125, -1.6458, "Navarra", "Comunidad Foral de Navarra", "España", "es"),
    "Logroño": (42.4627, -2.4449, "La Rioja", "La Rioja", "España", "es"),
    "Valladolid": (41.6523, -4.7245, "Valladolid", "Castilla y León", "España", "es"),
    "Salamanca": (40.9701, -5.6635, "Salamanca", "Castilla y León", "España", "es"),
    "León": (42.5987, -5.5671, "León", "Castilla y León", "España", "es"),
    "Burgos": (42.3438, -3.6999, "Burgos", "Castilla y León", "España", "es"),
    "Palencia": (42.0068, -4.5317, "Palencia", "Castilla y León", "España", "es"),
    "Segovia": (40.9480, -4.1184, "Segovia", "Castilla y León", "España", "es"),
    "Ávila": (40.6565, -4.6976, "Ávila", "Castilla y León", "España", "es"),
    "Soria": (41.7670, -2.4687, "Soria", "Castilla y León", "España", "es"),
    "Zamora": (41.5037, -5.7441, "Zamora", "Castilla y León", "España", "es"),
    "Albacete": (38.9943, -1.8585, "Albacete", "Castilla-La Mancha", "España", "es"),
    "Ciudad Real": (38.9861, -3.9292, "Ciudad Real", "Castilla-La Mancha", "España", "es"),
    "Puertollano": (38.6812, -4.1074, "Ciudad Real", "Castilla-La Mancha", "España", "es"),
    "Tomelloso": (39.1579, -3.0194, "Ciudad Real", "Castilla-La Mancha", "España", "es"),
    "Toledo": (39.8628, -4.0273, "Toledo", "Castilla-La Mancha", "España", "es"),
    "Talavera de la Reina": (39.9620, -4.8260, "Toledo", "Castilla-La Mancha", "España", "es"),
    "Guadalajara": (40.6332, -3.1627, "Guadalajara", "Castilla-La Mancha", "España", "es"),
    "Cuenca": (40.0208, -2.8950, "Cuenca", "Castilla-La Mancha", "España", "es"),
    "Mérida": (38.9161, -6.3413, "Badajoz", "Extremadura", "España", "es"),
    "Badajoz": (38.6789, -6.9700, "Badajoz", "Extremadura", "España", "es"),
    "Cáceres": (39.4765, -6.3723, "Cáceres", "Extremadura", "España", "es"),
    "Plasencia": (40.0299, -6.0876, "Cáceres", "Extremadura", "España", "es"),
    "Palma": (39.5696, 2.6502, "Illes Balears", "Illes Balears", "España", "es"),
    "Manacor": (39.5656, 3.0249, "Illes Balears", "Illes Balears", "España", "es"),
    "Las Palmas de Gran Canaria": (28.1235, -15.4363, "Las Palmas", "Canarias", "España", "es"),
    "Santa Cruz de Tenerife": (28.4636, -16.2518, "Santa Cruz de Tenerife", "Canarias", "España", "es"),
    "Lleida": (41.6176, 0.6200, "Lleida", "Cataluña", "España", "es"),
    "Girona": (41.9794, 2.8214, "Girona", "Cataluña", "España", "es"),
    "Tarragona": (41.1189, 1.2445, "Tarragona", "Cataluña", "España", "es"),
    "Murcia": (37.9922, -1.1307, "Murcia", "Región de Murcia", "España", "es"),
    "Cartagena": (37.6012, -0.9842, "Murcia", "Región de Murcia", "España", "es"),
    # Europa (ámbito permitido)
    "Lisboa": (38.7223, -9.1393, "Lisboa", "Lisboa", "Portugal", "pt"),
    "Oporto": (41.1579, -8.6291, "Porto", "Norte", "Portugal", "pt"),
    "Toulouse": (43.6047, 1.4442, "Alta Garona", "Occitania", "Francia", "fr"),
    "Berlín": (52.5200, 13.4050, "Berlín", "Berlín", "Alemania", "de"),
    "Múnich": (48.1351, 11.5820, "Alta Baviera", "Baviera", "Alemania", "de"),
    "Ámsterdam": (52.3676, 4.9041, "Holanda Septentrional", "Holanda Septentrional", "Países Bajos", "nl"),
    "Milán": (45.4642, 9.1900, "Milán", "Lombardía", "Italia", "it"),
    "Dublín": (53.3498, -6.2603, "Dublín", "Leinster", "Irlanda", "ie"),
    "Bruselas": (50.8503, 4.3517, "Bruselas", "Bruselas", "Bélgica", "be"),
    "Cracovia": (50.0647, 19.9450, "Cracovia", "Pequeña Polonia", "Polonia", "pl"),
}

FAMILIA_LABELS: dict[str, str] = {
    "adi": "Administración y Gestión",
    "com": "Comercio y Marketing",
    "elec": "Electricidad y Electrónica",
    "ifc": "Informática y Comunicaciones",
    "mec": "Fabricación Mecánica",
    "ins": "Instalación y Mantenimiento",
    "veh": "Transporte y Mantenimiento de Vehículos",
    "san": "Sanidad",
    "hos": "Hostelería y Turismo",
    "edc": "Edificación y Obra Civil",
    "ene": "Energía y Agua",
    "imp": "Imagen Personal",
    "soc": "Servicios Socioculturales y a la Comunidad",
    "ind": "Industrias Alimentarias",
    "qui": "Química",
    "agr": "Agraria",
    "mad": "Madera, Mueble y Corcho",
    "vid": "Vidrio y Cerámica",
    "tex": "Textil, Confección y Piel",
    "cis": "Comunicación, Imagen y Sonido",
}

# (nombre, familia, ciudad, descripción) — catálogo de demostración, sin contacto inventado.
COMPANIES: list[tuple[str, str, str, str]] = [
    ("Instalaciones Eléctricas Manchega S.L.", "elec", "Ciudad Real", "Instalaciones eléctricas de baja y media tensión, mantenimiento eléctrico industrial y cuadros de maniobra."),
    ("Electro Puertollano S.A.", "elec", "Puertollano", "Mantenimiento eléctrico de instalaciones industriales y automatización de líneas de producción."),
    ("Talleres Eléctricos Vega Baja S.L.", "elec", "Alicante", "Instalaciones eléctricas en viviendas y naves, domótica y obras de baja tensión."),
    ("Andaluza de Instalaciones Eléctricas S.L.", "elec", "Sevilla", "Electrotecnia, cuadros eléctricos y mantenimiento de instalaciones en edificios."),
    ("Electrotecnia Vallisoletana S.L.", "elec", "Valladolid", "Instalaciones electrotécnicas industriales y automatismos de control."),
    ("Galilec Instalaciones S.L.", "elec", "Santiago de Compostela", "Instalaciones eléctricas y de telecomunicación en edificación."),
    ("Levante Cuadros Eléctricos S.L.", "elec", "Valencia", "Fabricación y montaje de cuadros eléctricos de control y potencia."),
    ("Bilbao Electrical Works S.L.", "elec", "Bilbao", "Mantenimiento eléctrico industrial y máquinas eléctricas rotativas."),
    ("Manchega Solar S.L.", "ene", "Tomelloso", "Instalaciones de energía solar fotovoltaica para autoconsumo y suelo."),
    ("Renovables del Sur S.L.", "ene", "Málaga", "Energías renovables: fotovoltaica, aerotermia y eficiencia energética."),
    ("Aerotermia Ebro S.L.", "ene", "Zaragoza", "Solar térmica, aerotermia y climatización eficiente."),
    ("Canarias Fotovoltaica S.C.", "ene", "Las Palmas de Gran Canaria", "Instalaciones fotovoltaicas aisladas y conectadas a red en Canarias."),
    ("Eólicas del Bajo Aragón S.L.", "ene", "Huesca", "Mantenimiento de parques eólicos y estaciones de transformación."),
    ("Informatiza León S.L.", "ifc", "León", "Soporte informático, redes de empresa y venta de equipos."),
    ("Sistemas Tajo Informática S.L.", "ifc", "Toledo", "Administración de sistemas, cloud y soporte técnico a pymes."),
    ("Baleares Cloud Services S.L.", "ifc", "Palma", "Servicios cloud, virtualización y mantenimiento informático."),
    ("Redes del Cid S.L.", "ifc", "Burgos", "Redes de datos, fibra óptica y comunicaciones para empresas."),
    ("Vigo Digital Solutions S.L.", "ifc", "Vigo", "Desarrollo de software a medida y aplicaciones web."),
    ("Murcia Apps Factory S.L.", "ifc", "Murcia", "Desarrollo de aplicaciones móviles y multiplataforma."),
    ("Guadalajara Software Studio S.L.", "ifc", "Guadalajara", "Estudio de desarrollo web y aplicaciones para administración local."),
    ("Pirineos Sistemas S.L.", "ifc", "Huesca", "Infraestructuras de sistemas, ciberseguridad y teletrabajo."),
    ("Gestoría Almanzor S.L.", "adi", "Cáceres", "Asesoría fiscal, laboral y contable para autónomos y pymes."),
    ("Asesores Duero S.L.P.", "adi", "Zamora", "Gestión administrativa, nóminas y asesoramiento financiero."),
    ("Administraciones Tajo S.L.", "adi", "Talavera de la Reina", "Administración de fincas y gestión documental."),
    ("Gestión Riojana S.L.", "adi", "Logroño", "Servicios administrativos, facturación y gestión de personal."),
    ("Obrador y Asociados Gestión S.L.P.", "adi", "Palencia", "Despacho profesional de administración, contabilidad y fiscalidad."),
    ("Supermercados La Huerta S.A.", "com", "Cartagena", "Cadena de supermercados de proximidad con secciones de perecederos."),
    ("Distribuciones Ebromarket S.L.", "com", "Zaragoza", "Mayorista de alimentación y Dropshipping de ferretería industrial."),
    ("Marketing Costa del Sol S.L.", "com", "Málaga", "Agencia de marketing digital, publicidad y redes sociales."),
    ("Almacenaje y Logística Guadiana S.L.", "com", "Mérida", "Logística, almacenaje y distribución de mercancías en Extremadura."),
    ("Logística Manchega Transportes S.L.", "com", "Albacete", "Transporte de mercancías por carretera y gestión de flota."),
    ("Residencia Los Olivos S.A.", "san", "Salamanca", "Residencia de mayores y centro de día con equipo sanitario propio."),
    ("Clínica Dental Sonríe S.L.", "san", "Girona", "Clínica dental con radiodiagnóstico e higiene dental."),
    ("Centro de Diagnóstico Cruz del Sur S.L.", "san", "Almería", "Centro de imagen para el diagnóstico y laboratorio clínico."),
    ("Farmacia Central", "san", "Segovia", "Oficina de farmacia con servicio de dispensación y ortopedia."),
    ("Hospital de Día Levante S.L.", "san", "Elche", "Centro sanitario de consultas y tratamientos ambulatorios."),
    ("Emergencias Duero Salud S.L.", "san", "Soria", "Transporte sanitario urgente y cobertura de eventos."),
    ("Talleres Mecánicos del Sur S.A.", "veh", "Jerez de la Frontera", "Taller de electromecánica de vehículos y diagnosis."),
    ("Carrocerías Norte S.L.", "veh", "Santander", "Chapa, pintura y reparación de carrocerías de automóviles."),
    ("Diagnosis Motor Ebro S.L.", "veh", "Logroño", "Mantenimiento de vehículos industriales y turismos."),
    ("Vehículos Industriales Manchegos S.A.", "veh", "Tomelloso", "Taller de vehículos industriales y maquinaria agrícola."),
    ("Mecanizados Astur S.L.", "mec", "Gijón", "Mecanizado CNC de precisión para sector naval y energético."),
    ("Calderería Urola S.L.", "mec", "San Sebastián", "Calderería, soldadura especial y estructuras metálicas."),
    ("Estructuras Metálicas Berrocal S.L.", "mec", "Plasencia", "Fabricación y montaje de estructuras metálicas."),
    ("Mecanizados de Precisión Tarraco S.L.", "mec", "Tarragona", "Mecanizado, diseño CAD/CAM y utillajes."),
    ("CNC Galicia Precision S.L.", "mec", "Lugo", "Mecanizado de precisión y control de calidad metrológico."),
    ("Mantenimientos Industriales Astur S.L.", "ins", "Oviedo", "Mantenimiento electromecánico de instalaciones industriales."),
    ("Mecatrónica Cidacos S.L.", "ins", "Pamplona", "Mecatrónica, automatismos y mantenimiento de maquinaria."),
    ("Servicios de Mantenimiento Balear S.L.", "ins", "Manacor", "Mantenimiento técnico de hoteles y comunidades."),
    ("Mantenimientos Férreo S.L.", "ins", "Ávila", "Mantenimiento de líneas de envasado e instalaciones."),
    ("Hotel Plaza Nueva S.L.", "hos", "Granada", "Hotel urbano de tres estrellas con restaurante propio."),
    ("Restaurante La Alameda S.L.", "hos", "Sevilla", "Restaurante de cocina andaluza de mercado."),
    ("Cocinas del Cantábrico S.L.", "hos", "Gijón", "Grupo de restauración con varias salas y catering."),
    ("Viajes Delta Tur S.L.", "hos", "A Coruña", "Agencia de viajes mayorista y organizadora de eventos."),
    ("Eventos y Catering Virgen del Prado S.L.", "hos", "Ciudad Real", "Catering para eventos y celebraciones en Castilla-La Mancha."),
    ("Construcciones Vegas del Tajo S.L.", "edc", "Toledo", "Construcción de vivienda y obra civil menor."),
    ("Obra Civil EbroInfra S.A.", "edc", "Zaragoza", "Infraestructuras viales y urbanización de polígonos."),
    ("Proyectos y Obra Balear S.L.P.", "edc", "Palma", "Redacción de proyectos y dirección de ejecución de obra."),
    ("Centro de Estética Azahar S.L.", "imp", "Córdoba", "Centro de estética y tratamientos corporales."),
    ("Peluquerías Estilo Norte S.L.", "imp", "A Coruña", "Cadena de salones de peluquería y cosmética capilar."),
    ("Clínica de Estética Vega Media S.L.", "imp", "Murcia", "Medicina estética no quirúrgica y tratamientos faciales."),
    ("Escuela Infantil Rayito de Sol S.L.", "soc", "Badajoz", "Escuela infantil de primer ciclo (0-3 años)."),
    ("Centro Deportivo La Milagrosa S.L.", "soc", "León", "Instalación deportiva con actividades dirigidas."),
    ("Residencia y Centro de Día Alba S.L.", "soc", "Plasencia", "Centro residencial para personas en situación de dependencia."),
    ("Alimentos del Guadiana S.A.", "ind", "Badajoz", "Elaboración y envasado de productos cárnicos."),
    ("Conservas Mariñanas S.L.", "ind", "Lugo", "Conservera de pescado con líneas de envasado automatizadas."),
    ("Laboratorio Químico Duero S.L.", "qui", "Valladolid", "Laboratorio de análisis químicos y control de calidad."),
    ("Análisis Ambientales Mediterráneo S.L.", "qui", "Alicante", "Laboratorio de análisis de aguas y salud ambiental."),
    ("Jardinería y Riegos del Aljarafe S.L.", "agr", "Sevilla", "Jardinería, riego agrícola y mantenimiento de zonas verdes."),
    ("Viveros y Paisajismo Tajo S.L.", "agr", "Toledo", "Vivero de plantas y paisajismo exterior."),
    ("Confecciones Manchegas S.A.", "tex", "Albacete", "Confección textil y uniformidad laboral."),
    ("Carpintería y Madera Cuenca S.L.", "mad", "Cuenca", "Carpintería de madera y mobiliario a medida."),
    ("Cerámicas de La Mancha S.L.", "vid", "Tomelloso", "Fabricación de productos cerámicos industriales."),
    # Europa (ámbito permitido por el enunciado)
    ("TechInstall Lda", "elec", "Lisboa", "Instalações elétricas e manutenção industrial (demostración europea)."),
    ("PortoRenova Energia Lda", "ene", "Oporto", "Energía solar fotovoltaica y eficiencia energética en Portugal."),
    ("ÉlecProvence SAS", "elec", "Toulouse", "Installations électriques et automatismes industriels."),
    ("ElektroBau Berlin GmbH", "ins", "Berlín", "Mantenimiento de instalaciones técnicas de edificios."),
    ("Bayern Automatisierung GmbH", "elec", "Múnich", "Automatización industrial y robótica para manufactura."),
    ("NetWerk B.V.", "ifc", "Ámsterdam", "Redes de datos, sistemas y soporte IT."),
    ("Officina Meccanica Milano S.r.l.", "mec", "Milán", "Mecanizado de precisión y soldadura."),
    ("Emerald Electrical Contractors Ltd", "elec", "Dublín", "Electrical contracting and industrial maintenance."),
    ("Brussels Facility Services BV", "ins", "Bruselas", "Servicios técnicos y mantenimiento de instalaciones."),
    ("Kraków Tech Systems Sp. z o.o.", "ifc", "Cracovia", "Desarrollo de software y sistemas de información."),
]

# Pools de puestos por familia: (título, contrato, jornada, experiencia, skills)
OFFER_POOLS: dict[str, list[tuple]] = {
    "elec": [
        ("Técnico electricista", "indefinido", "completa", 0, ["instalaciones eléctricas", "cuadros eléctricos", "lectura de esquemas"]),
        ("Electrotécnico/a de mantenimiento", "indefinido", "turnos", 1, ["mantenimiento eléctrico", "plc", "baja y alta tensión"]),
        ("Montador/a de cuadros eléctricos", "temporal", "completa", 0, ["cuadros eléctricos", "automatismos", "baja tensión"]),
        ("Instalador/a de redes de comunicaciones", "indefinido", "completa", 0, ["fibra óptica", "redes de datos", "cctv"]),
        ("Prácticas FCT/Dual — Electricidad", "practicas", "completa", 0, ["instalaciones eléctricas", "esquemas eléctricos"]),
    ],
    "ene": [
        ("Instalador/a solar fotovoltaico", "indefinido", "completa", 0, ["solar fotovoltaica", "instalaciones fotovoltaicas", "baja tensión"]),
        ("Técnico/a de eficiencia energética", "indefinido", "completa", 1, ["eficiencia energética", "auditorías energéticas", "climatización"]),
        ("Operario/a de mantenimiento de parques eólicos", "temporal", "turnos", 1, ["eólica", "mantenimiento industrial", "carnet B"]),
        ("Prácticas — Energías renovables", "practicas", "completa", 0, ["solar fotovoltaica", "aerotermia"]),
    ],
    "ifc": [
        ("Técnico/a de soporte informático N1", "indefinido", "completa", 0, ["soporte técnico", "windows", "ofimática"]),
        ("Desarrollador/a web junior", "indefinido", "completa", 0, ["html", "css", "javascript", "mysql"]),
        ("Técnico/a de redes y comunicaciones", "temporal", "completa", 1, ["redes lan", "fibra óptica", "configuración de routers"]),
        ("Administrador/a de sistemas junior", "indefinido", "turnos", 1, ["linux", "virtualización", "windows server"]),
        ("Prácticas FCT/Dual — Informática", "practicas", "completa", 0, ["soporte técnico", "montaje de equipos"]),
    ],
    "adi": [
        ("Auxiliar administrativo/a", "temporal", "completa", 0, ["ofimática", "facturación", "atención al cliente"]),
        ("Administrativo/a de facturación y cobros", "indefinido", "completa", 1, ["facturación", "contabilidad", "excel"]),
        ("Gestor/a contable junior", "indefinido", "completa", 1, ["contabilidad", "nóminas", "sage"]),
        ("Prácticas administrativas", "practicas", "completa", 0, ["ofimática", "gestión documental"]),
    ],
    "com": [
        ("Comercial / Vendedor/a", "indefinido", "completa", 0, ["venta", "atención al cliente", "negociación"]),
        ("Dependiente/a", "temporal", "parcial", 0, ["manejo de caja", "reposición", "atención al cliente"]),
        ("Community manager junior", "indefinido", "completa", 0, ["redes sociales", "marketing digital", "seo"]),
        ("Operario/a logístico/a — almacén", "temporal", "turnos", 0, ["gestión de almacén", "carretilla elevadora", "cadena de suministro"]),
    ],
    "veh": [
        ("Mecánico/a de automóviles", "indefinido", "completa", 0, ["mecánica del automóvil", "diagnosis electrónica", "sistemas de frenos"]),
        ("Chapista/pintor/a de carrocería", "indefinido", "completa", 1, ["chapa", "pintura de vehículos", "estucado"]),
        ("Electricista de automóviles", "temporal", "completa", 0, ["electricidad del automóvil", "diagnosis electrónica"]),
    ],
    "mec": [
        ("Mecánico/a CNC", "indefinido", "turnos", 1, ["cnc", "torno", "interpretación de planos"]),
        ("Soldador/a TIG", "indefinido", "completa", 1, ["soldadura tig", "calderería", "estructuras metálicas"]),
        ("Operario/a de mecanizado", "temporal", "completa", 0, ["fresadora", "torno", "metrología"]),
        ("Delineante mecánico/a (CAD)", "indefinido", "completa", 0, ["autocad", "solidworks", "planos técnicos"]),
    ],
    "ins": [
        ("Técnico/a de mantenimiento industrial", "indefinido", "turnos", 1, ["mantenimiento preventivo", "neumática", "motores eléctricos"]),
        ("Mecatrónico/a de mantenimiento", "indefinido", "turnos", 1, ["mecatrónica", "plc", "instrumentación industrial"]),
        ("Prácticas — Mantenimiento industrial", "practicas", "completa", 0, ["mantenimiento preventivo", "lubricación industrial"]),
    ],
    "san": [
        ("Auxiliar de enfermería", "indefinido", "turnos", 0, ["cuidados básicos", "toma de constantes", "higiene hospitalaria"]),
        ("Auxiliar de enfermería — residencia", "temporal", "parcial", 0, ["cuidados básicos", "movilizaciones de pacientes"]),
        ("Técnico/a de farmacia", "indefinido", "completa", 0, ["dispensación", "dermofarmacia", "gestión de inventario"]),
        ("Técnico/a de radiología", "indefinido", "turnos", 1, ["radiología digital", "pac", "protección radiológica"]),
        ("Prácticas FCT — Sanidad", "practicas", "completa", 0, ["cuidados básicos", "atención al paciente"]),
    ],
    "hos": [
        ("Cocinero/a", "indefinido", "turnos", 1, ["elaboración de alimentos", "appcc", "alérgenos"]),
        ("Ayudante de cocina", "temporal", "turnos", 0, ["mise en place", "higiene alimentaria", "manipulación de alimentos"]),
        ("Camarero/a", "temporal", "parcial", 0, ["servicio en sala", "manejo de tpv", "atención al cliente"]),
        ("Prácticas FP — Cocina", "practicas", "completa", 0, ["elaboración de alimentos", "appcc"]),
        ("Técnico/a de agencias de viajes", "indefinido", "completa", 0, ["gestión de reservas", "inglés", "atención al cliente"]),
    ],
    "edc": [
        ("Auxiliar de obra", "temporal", "completa", 0, ["obras de construcción", "seguridad y salud", "lectura de planos"]),
        ("Asistente técnico/a de obra", "indefinido", "completa", 1, ["planificación de obra", "mediciones y presupuestos", "ofimática"]),
    ],
    "imp": [
        ("Esteticista", "indefinido", "completa", 0, ["tratamientos faciales", "manicura", "depilación"]),
        ("Peluquero/a", "temporal", "completa", 0, ["corte de pelo", "coloración", "peinados"]),
    ],
    "soc": [
        ("Técnico/a de educación infantil", "indefinido", "completa", 0, ["talleres infantiles", "atención al niño", "primeros auxilios"]),
        ("Monitor/a sociodeportivo", "temporal", "parcial", 0, ["dirigir actividades físicas", "planificación de actividades"]),
        ("Cuidador/a de personas dependientes", "indefinido", "turnos", 0, ["atención a dependientes", "autonomía personal"]),
    ],
    "ind": [
        ("Operario/a de industria alimentaria", "temporal", "turnos", 0, ["manipulación de alimentos", "envasado", "appcc"]),
        ("Técnico/a de calidad alimentaria", "indefinido", "completa", 1, ["appcc", "auditorías internas", "normativa alimentaria"]),
    ],
    "qui": [
        ("Operario/a de laboratorio", "indefinido", "turnos", 0, ["preparación de muestras", "instrumental básico", "normas de seguridad"]),
        ("Técnico/a de análisis ambientales", "indefinido", "completa", 1, ["análisis ambientales", "muestreo", "cromatografía"]),
    ],
    "agr": [
        ("Jardinero/a", "temporal", "completa", 0, ["jardinería", "instalación de riego", "floristería"]),
        ("Técnico/a de jardinería y paisajismo", "indefinido", "completa", 0, ["jardinería", "fitorreguladores", "instalación de riego"]),
    ],
    "tex": [
        ("Operario/a de confección", "temporal", "completa", 0, ["confección", "acabados", "máquinas de coser industriales"]),
    ],
    "mad": [
        ("Carpintero/a de madera", "temporal", "completa", 0, ["carpintería de madera", "mobiliario a medida", "lectura de planos"]),
    ],
    "vid": [
        ("Operario/a de cerámica industrial", "temporal", "turnos", 0, ["procesos cerámicos", "control de calidad básico"]),
    ],
}


def _offer_docs(companies: list[dict]) -> list[dict]:
    now = datetime.now(timezone.utc)
    offers: list[dict] = []
    idx = 0
    for ci, company in enumerate(companies):
        pool = OFFER_POOLS[company["sector"]]
        count = 1 if ci % 3 == 0 else 2  # densidad variable de ofertas
        for k in range(count):
            title, contract, jornada, exp, skills = pool[(ci * 2 + k) % len(pool)]
            idx += 1
            active = not (idx % 11 == 0)  # ~9 % de ofertas cerradas, para estados realistas
            offers.append(
                {
                    "id": f"ofr-{ci:03d}-{k}",
                    "company_id": company["id"],
                    "title": title,
                    "description": (
                        f"Desde {company['name']} buscamos incorporar un/a {title.lower()} para nuestro equipo "
                        f"de {company['city']}. La persona seleccionada se integrará en las actividades de "
                        f"{company['sector_label'].lower()} de la empresa"
                        + (" con posibilidad de incorporación posterior a plantilla." if contract in ("practicas", "formativo") else ".")
                    ),
                    "contract_type": contract,
                    "jornada": jornada,
                    "skills": skills,
                    "min_experience_years": exp,
                    "accepts_no_experience": exp == 0,
                    "is_internship": contract == "practicas",
                    "first_job_friendly": exp == 0,
                    "active": active,
                    "published_at": now - timedelta(days=idx % 28),
                    "source": "catalogo_demo",
                    "source_url": None,  # sin enlace inventado: la UI lo indica expresamente
                    "salary": None,
                }
            )
    return offers


async def main() -> None:
    print("Sembrando catálogo de demostración…")

    familia_of = {c[0]: c[1] for c in COMPANIES}
    companies: list[dict] = []
    for i, (name, familia, city, description) in enumerate(COMPANIES):
        lat, lng, provincia, comunidad, pais, cc = CITIES[city]
        # Desplazamiento determinista (±1 km) para separar empresas de la misma ciudad en el mapa.
        companies.append(
            {
                "id": f"emp-{i:03d}",
                "name": name,
                "sector": familia,
                "sector_label": FAMILIA_LABELS[familia],
                "description": description,
                "city": city,
                "province": provincia,
                "comunidad": comunidad,
                "country": pais,
                "country_code": cc,
                # Sin dirección/teléfono/web/correo: no se inventan. La UI lo comunica.
                "address": None,
                "website": None,
                "phone": None,
                "email": None,
                "accepts_cv_spontaneous": True,
                "lat": round(lat + (((i * 7) % 23) - 11) * 0.0016, 5),
                "lng": round(lng + (((i * 13) % 23) - 11) * 0.0016, 5),
                "source": "catalogo_demo",
            }
        )

    assert len(familia_of) == len(COMPANIES)
    offers = _offer_docs(companies)

    await db.companies.drop()
    await db.offers.drop()
    await ensure_indexes()

    await db.companies.insert_many(companies)
    await db.offers.insert_many(offers)
    print(f"OK: {len(companies)} empresas y {len(offers)} ofertas sembradas (source=catalogo_demo).")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
