#!/usr/bin/env python3
"""
scraper/utils/stealth.py
Anti-detection stealth patches for Playwright
Replaces deprecated playwright-stealth package
"""


def apply_stealth(context):
    """Apply stealth patches to a Playwright browser context."""
    context.add_init_script("""
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });

        // Override navigator.plugins
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Override navigator.languages
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });

        // Override chrome detection
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {},
        };

        // Override permissions query
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
            parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification.permission })
                : originalQuery(parameters);

        // Override WebGL renderer
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return 'Intel Inc.';
            if (parameter === 37446) return 'Intel Iris OpenGL Engine';
            return getParameter.apply(this, arguments);
        };

        // Prevent iframe detection
        Object.defineProperty(HTMLIFrameElement.prototype, 'contentWindow', {
            get: function() {
                return window;
            },
        });

        // Mock connection rtt
        if (navigator.connection) {
            Object.defineProperty(navigator.connection, 'rtt', {
                get: () => 50,
            });
        }

        // Override toString detection
        const originalToString = Function.prototype.toString;
        Function.prototype.toString = function() {
            if (this === Function.prototype.toString) return 'function toString() { [native code] }';
            return originalToString.call(this);
        };
    """)
