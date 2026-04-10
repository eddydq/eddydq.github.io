(function(root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    root.FlowPanelDocks = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function() {
    const COLLAPSED_CLASS = 'is-collapsed';

    function getButtonLabel(button, fallbackLabel) {
        const labelNode = button && typeof button.querySelector === 'function'
            ? button.querySelector('.panel-dock-text')
            : null;
        const label = labelNode && typeof labelNode.textContent === 'string'
            ? labelNode.textContent.trim()
            : '';

        return label || fallbackLabel;
    }

    function syncDockButton(button, collapsed, options) {
        if (!button) {
            return;
        }

        button.dataset.state = collapsed ? 'collapsed' : 'expanded';
        button.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        button.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} ${getButtonLabel(button, options.fallbackLabel)}`);

        const iconNode = typeof button.querySelector === 'function'
            ? button.querySelector('.panel-dock-icon')
            : null;

        if (iconNode) {
            iconNode.textContent = collapsed ? '+' : '-';
        }
    }

    function bindDockToggle(panel, button, options, updateWires) {
        if (!panel || !button) {
            return function noop() {
                return false;
            };
        }

        function sync() {
            syncDockButton(button, panel.classList.contains(COLLAPSED_CLASS), options);
        }

        function toggle() {
            panel.classList.toggle(COLLAPSED_CLASS);
            sync();

            if (typeof updateWires === 'function') {
                updateWires();
            }

            return panel.classList.contains(COLLAPSED_CLASS);
        }

        if (typeof button.addEventListener === 'function') {
            button.addEventListener('click', toggle);
        }

        sync();
        return toggle;
    }

    function bindPanelDocks({
        sidebar,
        consolePane,
        sidebarDock,
        consoleDock,
        updateWires
    }) {
        const toggleSidebar = bindDockToggle(sidebar, sidebarDock, {
            fallbackLabel: 'sidebar'
        }, updateWires);

        const toggleConsole = bindDockToggle(consolePane, consoleDock, {
            fallbackLabel: 'execution outputs'
        }, updateWires);

        return {
            toggleSidebar,
            toggleConsole
        };
    }

    return {
        bindPanelDocks
    };
}));
