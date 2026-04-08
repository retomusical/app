# Reto Musical - Alexa Skill

Este directorio contiene el código y la configuración para la Alexa Skill de Reto Musical.

## Flujo de Autenticación en Alexa

La skill utiliza un flujo de autenticación de dos pasos para enlazar a los usuarios con sus perfiles y listas de reproducción:

1.  **Ingreso del PIN (`PinIntent`)**: 
    Al abrir la skill (o cuando la skill lo solicita), el usuario debe decir su PIN de 4 dígitos.
    - La skill consulta la colección `pins` en Firebase para obtener el ID de usuario (`uid`).
    - Luego, consulta la colección `users` para obtener los detalles del usuario y sus listas de reproducción.
    - Se establece una "sesión pendiente" esperando el segundo paso de seguridad.
    
2.  **Palabra Clave (`SecretWordIntent`)**:
    Una vez reconocido el PIN, la skill solicita la palabra clave del usuario por seguridad.
    - El usuario puede decir expresiones como "mi clave es [palabra]" o simplemente decir la palabra suelta ("[palabra]").
    - Si la palabra coincide con la almacenada en su perfil, se concede el acceso a la lista de reproducción y comienza el juego donde se pedirá el modo de juego (adivinar canción o cantante).

## Script de Generación de Despliegues

Para subir el código a la consola de Alexa, se debe empaquetar la función Lambda en un archivo `.zip`. Para ello, se ha creado el script `generate_zip.sh`.

### Uso
Ejecuta el script desde el directorio raíz del proyecto o desde el directorio `alexa/`:

```bash
./alexa/generate_zip.sh
```

### Funcionalidades
*   **Gestión de Versiones Automática**: El script detectará si existe una versión generada anteriormente (ej. `skill_deployment_v1.zip`) e incrementará la versión automáticamente (`skill_deployment_v2.zip`).
*   **Limpieza**: Eliminará de forma automática la versión anterior del `.zip` para no ocupar espacio de disco innecesariamente.
*   **Instalación de Dependencias**: Hará una instalación limpia de las dependencias (`npm install --production`) dentro del directorio `lambda` antes de comprimir los archivos, asegurando un despliegue libre de librerías de desarrollo.

**Nota**: El archivo comprimido generado se ignorará mediante `.gitignore` para no subir los binarios al repositorio.
