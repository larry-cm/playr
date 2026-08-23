
<!-- BEGIN:branch-workflow-rules -->
# Flujo de ramas

- `develop` es la rama de trabajo. Toda rama nueva (`feature/*`, `fix/*`, etc.) sale de `develop` y se mergea de vuelta a `develop` al terminar.
- `master` es la rama raíz/producción. NO se actualiza automáticamente.
- Solo cuando el usuario diga explícitamente **"actualiza master"**: mergear `develop` a `master`, pushear, y volver a la rama de trabajo anterior.
- Nunca hacer merge ni push a `master` sin esa instrucción explícita.
<!-- END:branch-workflow-rules -->
