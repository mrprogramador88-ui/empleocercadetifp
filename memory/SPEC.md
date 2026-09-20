# Empleo Cerca de Ti — especificación viva

Buscador de empleo para estudiantes y titulados de Formación Profesional (Grado
Medio / Grado Superior) en **España y Europa**. El usuario introduce «qué he
estudiado + dónde estoy» y obtiene empresas y ofertas afines dentro de un radio,
con porcentaje de coincidencia, mapa sincronizado y generador de mensajes con IA.

## Estado

MVP completo y verificado. Sin login (perfil anónimo por navegador).

## Arquitectura

- **Backend** FastAPI (`/app/backend`), todas las rutas en `api_router` (prefijo `/api`).
- **Frontend** Vite + React 19 + TS estricto + Tailwind v4 + shadcn/ui (base-nova).
- **Mongo** vía motor. Colecciones: `profiles`, `companies`, `offers`.
- **Mapa** Leaflet + tiles CARTO/OSM por defecto; Google Maps se activa solo si
  `GOOGLE_MAPS_API_KEY` existe en `backend/.env` (`GET /api/config` decide la rama).
- **IA** Claude `claude-sonnet-4-6` vía `emergentintegrations` y `EMERGENT_LLM_KEY`
  (solo backend). Si falla → plantilla local etiquetada `generado_por="plantilla"`.

### Módulos backend clave

| Fichero | Papel |
|---|---|
| `lib/geo.py` | Lista blanca de 39 países europeos, CCAA/provincias de España (INE), `haversine_km`, bbox europea |
| `lib/fp_catalog.py` | Catálogo FP: 20 familias profesionales, ~60 títulos GM/GS con sus áreas profesionales y habilidades |
| `lib/matching.py` | Motor de coincidencia ponderado y **explicable** |
| `lib/geocode.py` | Proveedores de geocodificación (Nominatim por defecto, Google si hay clave), ambos filtran a Europa |
| `lib/llm.py` | Generación con Claude, `LlmUnavailable` como contrato de fallo |
| `lib/sources/` | Abstracción de fuentes: `base.OfferProvider`, `demo.DemoProvider`, `adzuna.AdzunaProvider` |

### Motor de coincidencia (pesos)

Título/ciclo 35 % · Familia y especialidad 25 % · Habilidades vs requisitos 20 % ·
Proximidad geográfica 15 % · Carnets/idiomas/experiencia 5 %. Bonus: prácticas
(+4), primer empleo sin experiencia (+3). Devuelve `pct`, desglose por factor
(`factores[]`) y razones en lenguaje natural (`razones[]`).

## Endpoints (todos bajo `/api`)

| Método | Ruta | Uso |
|---|---|---|
| GET | `/geo/countries` | 39 países europeos (España primero) |
| GET | `/geo/spain` | CCAA + provincias |
| GET | `/geo/geocode?q&cc` | Texto → coordenadas (rechaza fuera de Europa) |
| GET | `/geo/reverse?lat&lng` | Coordenadas → lugar; 404 fuera de Europa |
| GET | `/fp/catalog` | Familias + títulos FP |
| GET | `/profile?client_id` | Perfil (404 si no existe) |
| PUT | `/profile?client_id` | Crea/actualiza perfil |
| POST | `/profile/cv?client_id` | Sube CV (PDF, máx. 5 MB) |
| GET | `/search?client_id&lat&lng&radius_km&…` | Búsqueda con filtros y coincidencia |
| POST | `/messages/generate?client_id` | Mensaje de candidatura (IA o plantilla) |
| GET | `/config` | Proveedor de mapa, geocoder, IA activa |
| GET | `/sources` | Fuentes de datos y su estado |

Filtros de `/search`: `sector`, `contract`, `jornada`, `min_match`, `only_active`,
`no_exp_only`, `internships_only`, `sort` (`match`|`distancia`).

Con cualquier filtro de oferta activo (`contract`, `jornada`, `no_exp_only`,
`internships_only`) solo se devuelven empresas con al menos una oferta que lo
cumpla; sin esos filtros se incluyen además empresas sin oferta activa como
candidatura espontánea.

Teselas del mapa: `tile.openstreetmap.org` (las de CARTO pasaron a exigir clave).
Leaflet se aísla en `index.css` (`isolation: isolate` + paneles a `z-index: 1`)
para que sus paneles internos no se pinten sobre el asistente ni los diálogos.

## Modelo de datos

- `profiles` — un documento por `client_id` (UUID de localStorage, sin login):
  grado, familia, título, experiencia, skills, certificaciones, carnets, idiomas,
  disponibilidad, `busca[]`, `max_distance_km`, `location{lat,lng,…}`, `cv`.
- `companies` — id, name, sector (= id de familia FP), sector_label, city,
  province, comunidad, country, country_code, lat, lng, `source`. **address /
  phone / email / website son `null`** en la fuente de demostración: no se
  inventan datos de contacto y la UI lo indica expresamente.
- `offers` — company_id, title, contract_type, jornada, skills,
  min_experience_years, accepts_no_experience, is_internship,
  first_job_friendly, active, published_at, `source`, `source_url` (null en demo).

## Datos sembrados (`backend/seed.py`, idempotente)

83 empresas y 138 ofertas sobre **municipios reales** de España (73) y Europa
(10: Lisboa, Oporto, Toulouse, Berlín, Múnich, Ámsterdam, Milán, Dublín,
Bruselas, Cracovia), en 20 sectores FP. ~9 % de ofertas marcadas como cerradas
para ejercitar el filtro «solo ofertas activas». Todas con
`source="catalogo_demo"`.

## Flujos principales

1. **Primera visita** → asistente obligatorio de 3 pasos: (1) grado + familia +
   ciclo + experiencia + habilidades, (2) país/CCAA/provincia + localidad o CP +
   chincheta arrastrable en mapa + radio, (3) datos de contacto, qué busca,
   certificaciones, carnets, idiomas, CV en PDF. Guardar → búsqueda automática.
2. **Búsqueda** → panel izquierdo con filtros y tarjetas ordenadas por
   coincidencia; panel derecho con mapa, círculo de radio y marcadores de color
   por afinidad (pulso si hay oferta activa).
3. **Sincronización bidireccional** → clic en tarjeta centra el mapa (`flyTo`);
   clic en marcador selecciona la tarjeta y hace scroll hasta ella.
4. **Detalle** → «Ver detalle» despliega desglose del motor, datos de la empresa,
   todas sus ofertas con fuente y enlace original (o aviso de que no hay).
5. **Mensaje IA** → «Contactar» abre el compositor: 5 tipos de mensaje, notas
   opcionales, asunto y cuerpo editables, copiar al portapapeles y mailto.

## Extensión a fuentes reales

Añadir una fuente = crear una clase `OfferProvider` en `lib/sources/` y
registrarla en `describe_sources()`/`active_providers()`. `AdzunaProvider` queda
como ejemplo funcional: se activa solo con `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` en
`backend/.env`; sin claves no hace ninguna llamada ni inventa datos.
