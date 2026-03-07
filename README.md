# Hyper Conflict

## Últimas Actualizaciones (Mar 1 – Mar 7, 2026)

A continuación se resume todo lo actualizado desde el primer commit compartido (`d74d0ab`, 1 Mar 2026) hasta el día de hoy:

### Proyectiles

- **Constructor de proyectil Hadouken parabólico** (`d74d0ab`): implementación del constructor para el proyectil tipo Hadouken (id 1) con trayectoria parabólica, integrando la lógica en `projectile.js`, `attacks.js` y `specials.js`.
- **Array de configuración del proyectil Bun** (`4dcbc76`): configuración del proyectil Bun mediante un array centralizado en `projectile.js` y `specials.js`.
- **Array de configuración del proyectil Staple** (`63c6a97`): configuración del proyectil Staple mediante un array centralizado en `projectile.js` y `attacks.js`.
- **`damageQuarters` para el preset de proyectil Staple** (`248b8d0`): soporte para cuartos de daño (`damageQuarters`) en el preset del proyectil Staple.
- **Actualización del proyectil Spit de Sbluer** (`66888cd`): revisión mayor del proyectil de escupitajo de Sbluer, refactorización de `main.js` y extensión de la clase `fighter.js`.
- **Modularización del sistema de proyectiles** (`5e722e8`): `projectile.js` dividido en tres módulos independientes: `projectiles/actions.js` (lógica de actualización), `projectiles/hitboxes.js` (detección de colisión), `projectiles/types.js` (definición de tipos de proyectil).
- **Nuevo proyectil Thin Laser de Fernando** (`a31d357`, `b54a9d4`, `8fdfabb`):
  - Nuevos assets piskel para el thin laser y su proyectil (`fernando_thin_laser.piskel`, `fernando_thin_laser_proj.piskel`).
  - Estado y lógica completa del proyectil thin laser añadidos en `projectile.js`, `projectiles/actions.js`, `projectiles/hitboxes.js` y `projectiles/types.js`.
  - Corrección de la declaración de hitbox del proyectil thin laser.

### Sistema de Combate y Combos

- **Fix para modificación de combos** (`26a84f2`): corrección de bug en la lógica de `modifyCombos` en `attacks.js` e `init.js`.
- **Modularización de `attacks.js`** (`1e03230`):
  - `attacks.js` refactorizado y dividido en submódulos: `attacks/hit.js` (procesamiento de impactos) y `attacks/spawn.js` (spawning de proyectiles y efectos).
  - Nueva clase `combos.js` con la lógica de cadenas de combos extraída.
  - Nuevo módulo `registerCharData.js` para el registro de datos de personaje.
  - **Bloqueo de avance en combo**: la cadena de combo sólo avanza al siguiente golpe si el ataque anterior conecta con el oponente.
- **Cooldown por ataque en combos** (`9c4228f`):
  - Sistema de cooldown por nombre de ataque para evitar spam: 320 ms para puñetazos/patadas, 420 ms para especiales (o valor explícito en `action.cooldown`).
  - Gimmick simple añadido para la cadena de combo.

### Hitstop

- **Hitstop reducido significativamente** (`8f7f42b`): `HITSTOP_MS_PER_FRAME` bajado de 1 ms a 0.1 ms; nuevo tope máximo `HITSTOP_MS_MAX = 60 ms` para evitar pausas largas en golpes de mucho daño.

### HUD / UI

- **Fix del indicador de vida de Fernando** (`7e6bda6`): corrección del tamaño de dibujo del sprite del indicador de vida de Fernando en `hud.js`.

### README

- **README inicial** (`c8315a6`): se creó el archivo `README.md` con el resumen completo de características y sistemas del juego.

---

## Resumen de Características y Sistemas Desarrollados

Hyper Conflict es un videojuego de pelea 2D construido con P5.js y arquitectura modular. A continuación se listan todos los sistemas y requerimientos desarrollados:

**Gestión de estado del juego** (módulo `gameState.js` con sincronización a variables globales en `window`), **bucle principal del juego** (setup del canvas 800×400, loop de actualización de frames con manejo de fases: selección de personaje → partida → pantalla de fin de partida), **sistema de personajes** (tres personajes jugables: Tyeman, Sbluer y Fernando, cada uno con estadísticas propias de velocidad máxima, aceleración y fricción), **sistema de movimiento** (caminar, correr, saltar, caer, dash, agacharse y caminar agachado), **sistema de combate con combos** (cadena de 3 golpes de puñetazo, cadena de 3 patadas, variantes agachado para puño y patada), **sistema de agarre y lanzamiento** (grab y throw con estados grabbed), **sistema de movimientos especiales** (Tyeman: Hadouken ↓↘→P, Bun ←→P, Tats ↓↙←K; Sbluer: Shoryuken →↓↘P; Super Jump ↓↑ para todos; Taunt para todos), **buffer de inputs** (historial de entradas por jugador con duración configurable de 1400ms para detección de secuencias), **sistema de hitboxes de ataque** (cajas de colisión registradas por personaje y por movimiento), **sistema de hitboxes de cuerpo** (hurtboxes defensivos por estado del personaje), **sistema de proyectiles** (seis tipos: tyeman projectile, hadouken, shuriken, tats, bun y staple; con velocidad, rango y duración configurables, física de cuerda para bun), **sistema de salud y vidas** (24 cuartos de vida divididos en 6 corazones × 4 cuartos, 2 vidas por jugador, configurable), **sistema de hitstop** (congelado de frames por impacto, configurable en ms por frame, escalable según cuartos de vida perdidos), **sistema de knockback** (valores de retroceso horizontal y vertical por ataque, escalado dinámico según HP restante como mecánica de comeback), **sistema de bloqueo y blockstun** (estados block y crouchBlock, reducción de recuperación, efecto de zoom de cámara durante blockstun), **sistema de efectos visuales de daño** (sacudida de cámara, zoom en impactos, intensidad escala con HP perdido), **sistema de entrada de teclado** (P1: WASD + I/O/U/Space/P/M/G; P2: Flechas + B/N/V/Backspace; tecla G para agarre), **soporte de gamepad** (detección del primer gamepad conectado, D-pad y stick analógico con zona muerta de 0.35, botones A/B/X/Y mapeados, exclusivo para P1), **sistema de cámara dinámica** (sigue a ambos luchadores, centra entre ellos, zoom de 1× a 2.5× según distancia, seguimiento vertical para saltos altos, sacudida y zoom de combate), **pipeline de renderizado** (gradiente de fondo con ciclo día/noche, renderizado por capas de escenario/personajes/proyectiles, HUD sobre todo, superposición de pausa y fin de partida), **indicadores fuera de pantalla** (flechas guía y retratos en miniatura mostrando jugadores fuera del viewport), **HUD en pantalla** (barras de corazones con animación de sacudida al recibir daño, retratos de vida, visualización de cola de inputs de ambos jugadores), **pantalla de selección de personaje** (grilla 3×2 con cursor animado por jugador, confirmación, anillos sincronizados al coincidir en el mismo slot, ayuda de controles al pie), **menú de pausa** (propietario exclusivo del menú, opciones: Reanudar, Selección de personaje, Moveset; modo moveset muestra combos registrados, navegación debounced 120ms), **pantalla de fin de partida** (overlay semitransparente con ganador, opciones: Revancha o Selección de personaje, restauración de vidas al remachar), **editor de escenario** (colocación/eliminación de objetos de decoración en grilla, previsualización del frame en cursor, guardado/carga por localStorage en 10 slots con nombres, compresión Base64 para compartir escenarios), **sistema de carga de assets** (carga asíncrona por Promises, formato Piskel con extracción de frames por capa, chunks PNG en Base64, detección automática de orientación del spritesheet), **framework de animación** (mapeo de animaciones por acción con frames/delay/duración, soporte de bucle y disparo único, hasta 3 capas por personaje para sprites compuestos, volteo de sprite según dirección, overlays de arma opcionales), **registro de datos de personaje** (funciones para registrar estadísticas, acciones, hitboxes de ataque, hitboxes de cuerpo, knockback y movimientos especiales por personaje), **física del juego** (gravedad, curvas de aceleración/fricción, velocidad máxima diferenciada entre caminar y correr, momentum direccional), **mecánica de comeback** (el hitstop, el knockback y los efectos visuales se intensifican al perder cuartos de HP, incentivando el juego agresivo en desventaja), **sistema de pausa/reanudación** (flag PAUSED sincronizado entre módulos, atenuación del HUD al pausar), y **gestión de escenas** (transiciones entre selección, partida y fin de partida con reinicio completo de estado).
