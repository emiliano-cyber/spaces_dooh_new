---
name: optimizador-de-prompts
description: Úsala cuando alguien traiga un prompt para mejorar o se queje de lo que le devuelve — "mejora este prompt", "optimiza este prompt", "por qué no me está funcionando este prompt", "no me da lo que le pido", "me contesta cualquier cosa" — o cuando pegue un prompt suyo y pida que rinda mejor.
---

# Optimizador de prompts

## Principio

**Un prompt falla por lo que no dice, no por cómo lo dice.** El trabajo es
encontrar lo ausente. Reescribir más bonito lo que ya estaba no cambia el
resultado; añadir el criterio de éxito que faltaba, sí.

## La salida tiene dos partes, en este orden

**1 · Qué le falta.** Bullets cortos, uno por dimensión ausente, cada uno con lo
que eso provoca en la respuesta. Solo las que faltan.

**2 · El prompt reescrito.** En bloque de código, listo para copiar. Sin
comentarios dentro, sin explicaciones intercaladas, sin `[rellena aquí]` salvo
que el dato sea del usuario y no lo tengas.

Nada más. Ni preámbulo, ni resumen de lo que hiciste, ni cierre ofreciendo otra
versión.

## Las seis dimensiones

| Dimensión | Señal de que falta | Qué provoca |
|---|---|---|
| Rol | No dice desde qué oficio se responde | Respuesta genérica, de nivel medio |
| Contexto | No dice para quién es ni de qué va | Te contesta a otra pregunta parecida |
| Formato de salida | No dice si es tabla, lista, correo, JSON | Cada ejecución sale con otra forma |
| Ejemplos | No hay ninguna muestra de lo que se espera | Acierta el tema y falla el tono |
| Criterios de éxito | No dice qué haría buena a la respuesta | Imposible saber si sirvió |
| Restricciones | No dice extensión, idioma, qué no hacer | Se va de largo o inventa |

Casi siempre faltan **criterios de éxito** y **formato de salida**. Son las dos
que más cambian el resultado y las que nadie escribe.

## Cuándo preguntar antes de reescribir

Pregunta **solo** si se cumple alguna de estas tres. Son observables: se
comprueban leyendo el prompt, no se intuyen.

- No se puede saber **para quién** es la salida, y el registro cambia según eso.
- El objetivo admite **dos lecturas incompatibles** que darían prompts distintos.
- Falta un dato que tendrías que **inventar**: nombres, cifras, política interna,
  nombre de producto.

Si no se cumple ninguna, reescribe directamente. Cuando preguntes: máximo tres
preguntas, todas en el mismo mensaje, y di qué harás con cada respuesta.

Inventar el contexto es el peor resultado posible: devuelve un prompt que se ve
profesional y pide cosas que la persona nunca quiso.

## Errores comunes

| Error | Por qué es un error |
|---|---|
| Reescribir el triple de largo | Largo no es mejor. Cada línea que no cambia la salida es ruido que la diluye |
| Abrir con "Eres un experto en…" por costumbre | El rol solo sirve si acota de verdad. Puesto genérico = adorno |
| Listar las seis dimensiones aunque falten dos | El diagnóstico deja de leerse. Solo lo ausente |
| Mezclar la explicación con el prompt | No se puede copiar. El bloque de código va limpio |
| Cambiar lo que la persona pedía | Optimizar es que pida lo mismo mejor, no otra cosa |

## Señales de alarma

- Estás escribiendo una restricción que la persona nunca mencionó.
- El diagnóstico tiene seis bullets.
- El bloque de código lleva comentarios explicando el bloque de código.
- Reescribiste sin entender para quién era la salida.
