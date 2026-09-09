export type FaqItem = { q: string; a: string };
export type FaqCategory = { title: string; accent: string; items: FaqItem[] };

export const FAQ: FaqCategory[] = [
  {
    title: 'Smite 2 en general',
    accent: '#16c8d4',
    items: [
      {
        q: '¿Qué es Smite 2?',
        a: 'Es la secuela de Smite, un MOBA en tercera persona de Hi-Rez Studios donde controlas a un dios de una mitología real (griega, egipcia, nórdica, china, maya...) y luchas en equipo contra otros dioses. Smite 2 corre sobre Unreal Engine 5, con gráficos, físicas y habilidades rehechas desde cero, no es solo un reskin del original.',
      },
      {
        q: '¿Es gratis (free-to-play)?',
        a: 'Sí. El juego base y una rotación semanal de dioses gratuitos son gratis. Los dioses fuera de rotación se desbloquean con Favor (moneda gratuita ganable jugando) o Gemas (moneda de pago), igual que en el Smite original.',
      },
      {
        q: '¿En qué se diferencia de Smite 1?',
        a: 'Motor gráfico nuevo (UE5) con mejores físicas de proyectiles/colisiones, rediseño visual de habilidades y numerosos dioses, cambios de balance y objetos, y un sistema de progresión/ranked reconstruido. La curva de aprendizaje y el "feel" de las habilidades cambia bastante respecto al juego original aunque el concepto central (MOBA de dioses en 3ª persona) se mantiene.',
      },
      {
        q: '¿En qué plataformas está disponible?',
        a: 'PC (Steam) es la plataforma principal durante el acceso anticipado. Hi-Rez ha confirmado soporte multiplataforma (consolas) más adelante, con crossplay entre plataformas como en el Smite original.',
      },
      {
        q: '¿Smite 2 tiene crossplay y cross-progression?',
        a: 'Sí, el objetivo declarado por Hi-Rez es crossplay entre plataformas y progresión compartida (skins, dioses comprados, rango) usando la misma cuenta Hi-Rez de siempre.',
      },
    ],
  },
  {
    title: 'Modos de juego y roles',
    accent: '#a78bfa',
    items: [
      {
        q: '¿Cuáles son los modos principales?',
        a: 'Conquest (5v5, el modo competitivo estándar con 3 carriles), Arena (equipo contra equipo en un mapa cerrado sin carriles/objetivos, muerte súbita por tickets), Joust (1v1 o 3v3 en un solo carril) y Clash. La rotación de modos disponibles varía según el estado del acceso anticipado.',
      },
      {
        q: '¿Qué roles existen?',
        a: 'Solo (carril de arriba, tanque/bruiser 1v1), Jungla (rota el mapa haciendo camps neutrales y ganking), Mid (carril central, generalmente mago con daño mágico burst), Support (protege al Carry, inicia peleas, tiene utilidad/control de masas) y Carry/ADC (carril de abajo, daño físico sostenido a base de objetos).',
      },
      {
        q: '¿Qué diferencia hay entre daño físico y mágico?',
        a: 'Cada dios tiene un tipo de daño fijo (físico o mágico) que determina qué objetos de poder le sirven y contra qué tipo de protección (física o mágica) del rival golpea. Por eso el build depende tanto del dios como de contra quién estés jugando.',
      },
      {
        q: '¿Qué es el "clear" de jungla y los camps?',
        a: 'Son los monstruos neutrales del mapa (arpías, minotauro, dragón Fire Giant, Gold Fury, etc.) que dan oro/experiencia extra y a veces buffs. El jungla los limpia en rutas optimizadas y suele apoyar al carril que gane ventaja para tomar objetivos grandes.',
      },
    ],
  },
  {
    title: 'Progresión, ranked y objetos',
    accent: '#fb923c',
    items: [
      {
        q: '¿Cómo funciona el ranked (competitivo)?',
        a: 'Se juega Conquest Ranked por temporadas (splits), con un sistema de rangos por divisiones (de Bronce a algo equivalente a Master/Grandmaster/Challenger según la temporada) y MMR interno que ajusta el matchmaking además del rango visible.',
      },
      {
        q: '¿Qué son el Favor y las Gemas?',
        a: 'Favor es la moneda que se gana jugando partidas y completando misiones; sirve para desbloquear dioses. Gemas es la moneda de pago (comprada con dinero real); sirve para dioses, skins y el pase de batalla.',
      },
      {
        q: '¿Cómo funciona el sistema de objetos (build)?',
        a: 'Cada partida empiezas sin objetos y los compras con el oro que ganas matando súbditos, jungla, torres y jugadores rivales. Los objetos dan estadísticas (poder, protecciones, velocidad de ataque, cooldown...) y muchos tienen pasivas únicas. El build ideal cambia según tu dios, tu rol y contra quién te estés enfrentando esa partida.',
      },
      {
        q: '¿Qué son las runas o talentos?',
        a: 'Sistema de progresión de cuenta por dios/rol que da bonificaciones pequeñas permanentes (fuera de la partida) a medida que subes de nivel de maestría con ese dios, sin afectar directamente el balance competitivo dentro de una partida.',
      },
    ],
  },
  {
    title: 'Sobre esta web (Smite 2 Tracker)',
    accent: '#34d399',
    items: [
      {
        q: '¿Esta web se conecta a mi cuenta de Smite 2 automáticamente?',
        a: 'No. Hi-Rez todavía no ofrece una API pública de estadísticas para Smite 2 (el SDK oficial, s2rh_pythonsdk, no tiene acceso self-serve abierto). Por eso las partidas se cargan a mano desde el formulario "Nueva partida", opcionalmente ayudado por el importador de capturas (OCR).',
      },
      {
        q: '¿Cómo funciona el importador de capturas?',
        a: 'Subes (o pegas con Ctrl+V) la pantalla de resultados de tu partida, calibras una vez dónde está cada dato (KDA, daño, etc.) dibujando recuadros sobre la imagen, y el motor OCR (Tesseract.js, corre en tu navegador, sin subir la imagen a ningún servidor externo) lee esos números por ti. Siempre puedes revisar y corregir antes de aplicar los valores al formulario.',
      },
      {
        q: '¿Mis datos son privados?',
        a: 'Sí. Es una app de uso personal: solo tú puedes ver tus partidas (protegido por autenticación y Row Level Security en la base de datos), y el procesamiento de capturas (OCR) ocurre localmente en tu navegador, no se envía la imagen a ningún servicio externo.',
      },
      {
        q: '¿De dónde salen los datos de dioses, ítems y habilidades?',
        a: 'El catálogo de dioses, objetos y habilidades se extrajo de páginas públicas de la comunidad como SmiteSource, para poder mostrarte iconos, descripciones y escalado real sin depender de una API oficial que hoy no existe.',
      },
      {
        q: '¿Qué son los "matchups"?',
        a: 'Si indicas qué dios rival tuviste enfrente en el carril al cargar una partida (campo opcional "Dios rival"), la web calcula tu winrate específico contra ese dios, tanto por cada dios tuyo como combinado entre todos, para que veas contra quién te cuesta más o menos.',
      },
    ],
  },
];
