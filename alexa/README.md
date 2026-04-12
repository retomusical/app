# Reto Musical - Alexa Skill

Este directorio contiene el código y la configuración para la Alexa Skill de Reto Musical.

---

## Frases que reconoce la skill

### 🔑 Paso 1 — Identificación con PIN

Al abrir la skill di tu PIN de 4 dígitos usando una de estas frases:

| Frase | Ejemplo |
|-------|---------|
| `mi pin es [pin]` | *"mi pin es 1234"* |
| `el pin es [pin]` | *"el pin es 1234"* |
| `accedo con el pin [pin]` | *"accedo con el pin 5678"* |
| `código [pin]` | *"código 1234"* |
| `usa el pin [pin]` | *"usa el pin 9012"* |
| `mi clave es [pin]` | *"mi clave es 3456"* |

---

### 🔐 Paso 2 — Palabra clave de acceso

Tras reconocer el PIN, la skill pide la palabra clave. **Debes usar un prefijo** seguido de tu palabra:

| Frase | Ejemplo |
|-------|---------|
| `la clave es [palabra]` | *"la clave es rosa"* |
| `la palabra es [palabra]` | *"la palabra es sol"* |
| `la palabra clave es [palabra]` | *"la palabra clave es luna"* |
| `mi palabra secreta es [palabra]` | *"mi palabra secreta es árbol"* |
| `clave [palabra]` | *"clave cielo"* |
| `es [palabra]` | *"es verano"* |

> ⚠️ **Importante:** No digas solo la palabra suelta (ejemplo: *"rosa"*), ya que Alexa puede confundirla con otro comando. Usa siempre el prefijo, por ejemplo: **"la clave es rosa"**.

---

### ✅ Menú principal (tras autenticarte)

Una vez identificado, puedes usar estas opciones:

#### 📋 1. Listar mis listas

| Frase |
|-------|
| *"mis listas"* |
| *"listar las listas que tengo"* |
| *"qué listas tengo"* |
| *"ver mis listas"* |
| *"cuántas listas tengo"* |
| *"leer mis listas"* |

#### 👥 2. Añadir lista de un amigo (con su PIN)

| Frase | Ejemplo |
|-------|---------|
| `añadir amigo con pin [pin]` | *"añadir amigo con pin 5678"* |
| `añadir un amigo con el pin [pin]` | *"añadir un amigo con el pin 5678"* |
| `añadir una lista de un amigo con el pin [pin]` | *"añadir una lista de un amigo con el pin 5678"* |
| `lista de amigo con pin [pin]` | *"lista de amigo con pin 9012"* |
| `amigo [pin]` | *"amigo 1234"* |
| `añadir pin [pin]` | *"añadir pin 4321"* |

#### 🎵 3. Escoger una lista

Primero lista tus listas (opción 1 o 2), luego elige por número:

| Frase | Ejemplo |
|-------|---------|
| `escoger la lista [número]` | *"escoger la lista 1"* |
| `elegir la [número]` | *"elegir la 2"* |
| `seleccionar la número [número]` | *"seleccionar la número 3"* |
| `quiero la lista [número]` | *"quiero la lista 1"* |
| `la uno` / `la dos` / `la tres` ... | *"la dos"* |

#### 🎮 4. Jugar

| Frase |
|-------|
| *"jugar"* |
| *"empezar a jugar"* |
| *"iniciar el juego"* |
| *"vamos a jugar"* |
| *"quiero jugar"* |

Alexa preguntará: **¿canciones o cantantes?** Responde con:

| Frase |
|-------|
| *"canciones"* / *"la canción"* / *"el título"* / *"el tema"* |
| *"cantantes"* / *"el artista"* / *"quién canta"* / *"el grupo"* / *"la banda"* |

Durante el juego, para responder:

| Frase | Ejemplo |
|-------|---------|
| `es [respuesta]` | *"es Alejandro Sanz"* |
| `la respuesta es [respuesta]` | *"la respuesta es Bohemian Rhapsody"* |
| `creo que es [respuesta]` | *"creo que es Madonna"* |
| `se llama [respuesta]` | *"se llama La Bamba"* |
| `el artista es [respuesta]` | *"el artista es Queen"* |
| `la canción es [respuesta]` | *"la canción es Despacito"* |

#### ❓ 5. Pedir ayuda

| Frase |
|-------|
| *"ayuda"* |
| *"menú"* |
| *"opciones"* |
| *"qué opciones tengo"* |
| *"qué tengo que hacer"* |
| *"cómo se juega"* |
| *"no entiendo"* |

#### 🚪 6. Salir

| Frase |
|-------|
| *"salir"* |
| *"cancelar"* |
| *"stop"* |
| *"detente"* |
| *"terminar"* |
| *"parar el juego"* |
| *"no quiero jugar más"* |

La skill se despedirá: **"¡Gracias por jugar a Reto Musical! Me despido, ¡hasta pronto!"**

---

## Flujo de Autenticación en Alexa

La skill utiliza un flujo de autenticación de dos pasos:

1. **PIN (`PinIntent`)**: La skill consulta `pins` en Firebase para obtener el `uid` del usuario y sus datos.
2. **Palabra Clave (`SecretWordIntent`)**: La skill verifica que la palabra coincide con la almacenada en el perfil del usuario. Si es correcta, se activa el menú principal.

> Si durante el paso de la palabra clave Alexa dice que no te ha entendido o la skill se cierra, asegúrate de usar el prefijo: **"la clave es [tu palabra]"**.

---

## Script de Generación de Despliegues

Para empaquetar y subir el código a la consola de Alexa:

```bash
./alexa/generate_zip.sh
```

- **Versiones automáticas**: genera `skill_deployment_v1.zip`, `v2.zip`, etc., borrando el anterior.
- El ZIP generado está excluido del repositorio vía `.gitignore`.

### Pasos para desplegar

1. Ejecutar `generate_zip.sh` → genera el ZIP con el código Lambda.
2. Subir el ZIP en **Alexa Developer Console → Code**.
3. Copiar el contenido de `skill-package/interactionModels/custom/es-ES.json` en **Build → Interaction Model → JSON Editor**.
4. Hacer clic en **Build Model** y esperar a que compile.
