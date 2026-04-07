/**
 * CoreBlow — Dashboard Widgets
 *
 * Widget system for building monitoring dashboards.
 * Supports counters, charts, tables, and status
 * indicators with real-time data binding.
 */

/** Widget type */
export type WidgetType = 'counter' | 'chart' | 'table' | 'status' | 'text';

/** Widget definition */
export interface Widget {
    id: string;
    type: WidgetType;
    title: string;
    data: unknown;
    position: { row: number; col: number; width: number; height: number };
    refreshIntervalMs?: number;
    updatedAt: number;
}

/** Dashboard */
export interface Dashboard {
    id: string;
    name: string;
    widgets: Widget[];
    createdAt: number;
}

/**
 * CoreBlow Dashboard Widgets
 */
export class DashboardWidgets {
    private dashboards = new Map<string, Dashboard>();
    private idCounter = 0;
    private widgetCounter = 0;

    /**
     * Create a dashboard.
     */
    createDashboard(name: string): Dashboard {
        const dashboard: Dashboard = {
            id: `dash-${++this.idCounter}`, name, widgets: [], createdAt: Date.now(),
        };
        this.dashboards.set(dashboard.id, dashboard);
        return dashboard;
    }

    /**
     * Add a widget to a dashboard.
     */
    addWidget(dashboardId: string, type: WidgetType, title: string, data: unknown, position: Widget['position']): Widget | null {
        const dash = this.dashboards.get(dashboardId);
        if (!dash) return null;
        const widget: Widget = { id: `widget-${++this.widgetCounter}`, type, title, data, position, updatedAt: Date.now() };
        dash.widgets.push(widget);
        return widget;
    }

    /**
     * Update widget data.
     */
    updateWidget(dashboardId: string, widgetId: string, data: unknown): boolean {
        const dash = this.dashboards.get(dashboardId);
        if (!dash) return false;
        const widget = dash.widgets.find((w) => w.id === widgetId);
        if (!widget) return false;
        widget.data = data;
        widget.updatedAt = Date.now();
        return true;
    }

    /**
     * Remove widget.
     */
    removeWidget(dashboardId: string, widgetId: string): boolean {
        const dash = this.dashboards.get(dashboardId);
        if (!dash) return false;
        const idx = dash.widgets.findIndex((w) => w.id === widgetId);
        if (idx === -1) return false;
        dash.widgets.splice(idx, 1);
        return true;
    }

    /**
     * Get dashboard.
     */
    getDashboard(id: string): Dashboard | null { return this.dashboards.get(id) ?? null; }

    /**
     * List dashboards.
     */
    list(): Array<{ id: string; name: string; widgetCount: number }> {
        return Array.from(this.dashboards.values()).map((d) => ({ id: d.id, name: d.name, widgetCount: d.widgets.length }));
    }

    /** Count */
    count(): number { return this.dashboards.size; }
}
