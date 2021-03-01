node-gyp - Herramienta de compilación de complementos nativa de Node.js
Estado de la construcción

node-gypes una herramienta de línea de comandos multiplataforma escrita en Node.js para compilar módulos complementarios nativos para Node.js. Contiene una copia vendida del proyecto gyp -next que fue utilizado anteriormente por el equipo de Chromium, ampliado para admitir el desarrollo de complementos nativos de Node.js.

Tenga en cuenta que node-gypse no se utiliza para construir Node.js en sí.

Versiones de múltiples objetivos de Node.js son compatibles (es decir 0.8, ..., 4, 5, 6, etc.), independientemente de qué versión de Node.js está instalada en su sistema ( node-gypdescargas de los archivos de desarrollo necesarios o cabeceras para la versión de destino) .

Características
Los mismos comandos de compilación funcionan en cualquiera de las plataformas compatibles
Admite la orientación de diferentes versiones de Node.js
Instalación
Puede instalar node-gypusando npm:

npm install -g node-gyp
Dependiendo de su sistema operativo, necesitará instalar:

En Unix
Python v3.6, v3.7, v3.8 o v3.9
make
Una cadena de herramientas del compilador C / C ++ adecuada, como GCC
En macOS
ATENCIÓN : si su Mac se ha actualizado a macOS Catalina (10.15), lea macOS_Catalina.md .

Python v3.6, v3.7, v3.8 o v3.9
Xcode
También necesita instalar XCode Command Line Toolsejecutando xcode-select --install. Alternativamente, si ya tiene instalado el Xcode completo, puede encontrarlos en el menú Xcode -> Open Developer Tool -> More Developer Tools.... Este paso se instalará clang, clang++y make.
En Windows
Instale la versión actual de Python del paquete de Microsoft Store .

Instale las herramientas y la configuración manualmente:

Instale Visual C ++ Build Environment: Visual Studio Build Tools (usando la carga de trabajo "Visual C ++ build tools") o Visual Studio 2017 Community (usando la carga de trabajo "Desktop Development with C ++")
Inicie cmd, npm config set msvs_version 2017
Si los pasos anteriores no le funcionaron, visite las Pautas de Node.js de Microsoft para Windows para obtener sugerencias adicionales.

Para apuntar ARM64 Node.js nativo en Windows 10 en ARM, agregue los componentes "Compiladores y bibliotecas de Visual C ++ para ARM64" y "Visual C ++ ATL para ARM64".

Configurar la dependencia de Python
node-gyprequiere que haya instalado una versión compatible de Python, una de las siguientes: v3.6, v3.7, v3.8 o v3.9. Si tiene varias versiones de Python instaladas, puede identificar qué versión de Python node-gypdebe usar de una de las siguientes maneras:

configurando la --pythonopción de línea de comandos, por ejemplo:
node-gyp < comando > --python / ruta / a / ejecutable / python
Si node-gypse llama a través de npm, y tiene varias versiones de Python instaladas, entonces puede establecer npmla clave de configuración 's' python 'en el valor apropiado:
npm config establece python / ruta / a / ejecutable / python
Si la PYTHONvariable de entorno se establece en la ruta de un ejecutable de Python, entonces se usará esa versión, si es una versión compatible.

Si la NODE_GYP_FORCE_PYTHONvariable de entorno se establece en la ruta de un ejecutable de Python, se utilizará en lugar de cualquiera de las otras rutas de búsqueda de Python configuradas o integradas. Si no es una versión compatible, no se realizarán más búsquedas.

Cómo utilizar
Para compilar su complemento nativo, primero vaya a su directorio raíz:

cd my_node_addon
El siguiente paso es generar los archivos de construcción del proyecto adecuados para la plataforma actual. Úselo configurepara eso:

configuración de nodo-gyp
La detección automática falla para Visual C ++ Build Tools 2015, por lo --msvs_version=2015 que debe agregarse (no es necesario cuando se ejecuta mediante npm como se configuró anteriormente):

configuración de node-gyp --msvs_version = 2015
Nota : El configurepaso busca un binding.gyparchivo en el directorio actual para procesar. Consulte a continuación las instrucciones sobre cómo crear un binding.gyparchivo.

Ahora tendrá un Makefile(en plataformas Unix) o un vcxprojarchivo (en Windows) en el build/directorio. A continuación, invoque el buildcomando:

compilación de node-gyp
¡Ahora tienes tu .nodearchivo de enlaces compilado ! Los enlaces compilados terminan en build/Debug/o build/Release/, según el modo de construcción. En este punto, puede .nodesolicitar el archivo con Node.js y ejecutar sus pruebas.

Nota: Para crear una compilación de depuración del archivo de enlaces, pase el conmutador --debug(o -d) cuando ejecute los comandos configure, buildo rebuild.

El binding.gyparchivo
Un binding.gyparchivo describe la configuración para construir su módulo, en un formato similar a JSON. Este archivo se coloca en la raíz de su paquete, junto a package.json.

Un gyparchivo barebones apropiado para construir un complemento de Node.js podría verse así:

{
   "objetivos" : [
    {
      "target_name" : "vinculante" ,
       "fuentes" : [ "src / vinculante.cc" ]
    }
  ]
}
Otras lecturas
Algunos recursos adicionales para los complementos nativos de Node.js y la escritura de gyparchivos de configuración:

"Pasar a ser nativo", un tutorial de nodeschool.io
Ejemplo de complemento de nodo "Hello World"
documentación de usuario de gyp
referencia de formato de entrada gyp
archivos "binding.gyp" en la página wiki salvaje
Comandos
node-gyp responde a los siguientes comandos:

Mando	Descripción
help	Muestra el diálogo de ayuda.
build	Invoca make/ msbuild.exey construye el complemento nativo
clean	Elimina el builddirectorio si existe
configure	Genera archivos de construcción de proyectos para la plataforma actual.
rebuild	Corre clean, configurey buildtodo en una fila
install	Instala los archivos de encabezado de Node.js para la versión dada
list	Enumera las versiones de encabezado de Node.js actualmente instaladas
remove	Elimina los archivos de encabezado de Node.js para la versión dada
Opciones de comando
node-gyp acepta las siguientes opciones de comando:

Mando	Descripción
-j n, --jobs n	Corre makeen paralelo. El valor maxutilizará todos los núcleos de CPU disponibles.
--target=v6.2.1	Versión de Node.js para compilar (la predeterminada es process.version)
--silly, --loglevel=silly	Registra todo el progreso en la consola
--verbose, --loglevel=verbose	Registra la mayor parte del progreso en la consola
--silent, --loglevel=silent	No registre nada en la consola
debug, --debug	Hacer compilación de depuración (la predeterminada es Release)
--release, --no-debug	Hacer versión de compilación
-C $dir, --directory=$dir	Ejecutar comando en un directorio diferente
--make=$make	makeComando de anulación (p gmake. Ej. )
--thin=yes	Habilitar bibliotecas estáticas delgadas
--arch=$arch	Establecer la arquitectura de destino (p. Ej., Ia32)
--tarball=$path	Obtener encabezados de un tarball local
--devdir=$path	Directorio de descarga de SDK (el predeterminado es el directorio de caché del sistema operativo)
--ensure	No reinstale los encabezados si ya están presentes
--dist-url=$url	Descargar el tarball del encabezado desde la URL personalizada
--proxy=$url	Configure el proxy HTTP (S) para descargar el tarball del encabezado
--noproxy=$urls	Configure las URL para ignorar los proxies al descargar el tarball del encabezado
--cafile=$cafile	Anular la cadena de CA predeterminada (para descargar tarball)
--nodedir=$path	Establecer la ruta al código fuente del nodo
--python=$path	Establecer ruta al binario de Python
--msvs_version=$version	Establecer la versión de Visual Studio (solo Windows)
--solution=$solution	Establecer la versión de la solución de Visual Studio (solo Windows)
Configuración
Variables de entorno
Utilice el formulario npm_config_OPTION_NAMEpara cualquiera de las opciones de comando enumeradas anteriormente (los guiones en los nombres de las opciones deben reemplazarse por guiones bajos).

Por ejemplo, para establecer devdirun valor igual a /tmp/.gyp, haría lo siguiente:

Ejecute esto en Unix:

exportar npm_config_devdir = / tmp / .gyp
O esto en Windows:

establecer npm_config_devdir = c: \ temp \ .gyp
npm configuración
Utilice el formulario OPTION_NAMEpara cualquiera de las opciones de comando enumeradas anteriormente.

Por ejemplo, para establecer devdirigual a /tmp/.gyp, ejecutaría:

npm config set [--global] devdir /tmp/.gyp
Nota: La configuración establecida a través de npmsolo se utilizará cuando node-gyp se ejecute a través de npm, no cuando node-gypse ejecute directamente.

Licencia
node-gypestá disponible bajo la licencia MIT. Consulte el archivo de LICENCIA para obtener más detalles.
