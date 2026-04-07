// modules/theme.js

/**
 * Aplica un tema visual o un color personalizado al documento.
 * Guarda la preferencia en localStorage.
 */
export function applyTheme(themeName, customColor = null) {
    document.body.setAttribute('data-theme', themeName);
    localStorage.setItem('user-theme', themeName);

    if (themeName === 'custom' && customColor) {
        document.documentElement.style.setProperty('--primary', customColor);
        document.documentElement.style.setProperty('--border', `${customColor}22`);
        localStorage.setItem('custom-theme-color', customColor);
    } else {
        document.documentElement.style.removeProperty('--primary');
        document.documentElement.style.removeProperty('--border');
    }
}

/**
 * Inicializa los eventos de los puntos de tema y carga el tema guardado.
 */
export function initThemeSystem(themeDots, customColorInput) {
    themeDots.forEach(dot => {
        dot.addEventListener('click', () => {
            themeDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            applyTheme(dot.dataset.theme);
        });
    });

    if (customColorInput) {
        customColorInput.addEventListener('input', (e) => {
            applyTheme('custom', e.target.value);
        });
    }

    // Carga inicial
    const savedTheme = localStorage.getItem('user-theme') || 'midnight';
    const savedColor = localStorage.getItem('custom-theme-color');
    
    if (savedColor && customColorInput) {
        customColorInput.value = savedColor;
    }
    
    applyTheme(savedTheme, savedColor);

    // Marcar el dot activo si existe
    themeDots.forEach(dot => {
        if (dot.dataset.theme === savedTheme) dot.classList.add('active');
        else dot.classList.remove('active');
    });
}
