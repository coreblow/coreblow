/**
 * CoreBlow — Notification System
 *
 * Manages notifications across channels and users.
 * Supports priority levels, read tracking, batching,
 * and notification preferences.
 */

/** Notification */
export interface Notification {
    id: string;
    type: 'info' | 'warning' | 'error' | 'success' | 'system';
    title: string;
    message: string;
    userId?: string;
    channel?: string;
    read: boolean;
    createdAt: number;
    expiresAt?: number;
    metadata?: Record<string, unknown>;
}

/** Notification preferences */
export interface NotificationPreferences {
    enabled: boolean;
    channels: string[];
    muteUntil?: number;
    types: Array<Notification['type']>;
}

/**
 * CoreBlow Notification System
 */
export class NotificationSystem {
    private notifications: Notification[] = [];
    private preferences = new Map<string, NotificationPreferences>();
    private idCounter = 0;
    private maxNotifications = 1000;

    /**
     * Send a notification.
     */
    send(type: Notification['type'], title: string, message: string, userId?: string, channel?: string): Notification {
        const notification: Notification = {
            id: `notif-${++this.idCounter}`,
            type, title, message, userId, channel,
            read: false, createdAt: Date.now(),
        };

        // Check preferences
        if (userId) {
            const prefs = this.preferences.get(userId);
            if (prefs) {
                if (!prefs.enabled) return notification;
                if (prefs.muteUntil && Date.now() < prefs.muteUntil) return notification;
                if (!prefs.types.includes(type)) return notification;
            }
        }

        this.notifications.push(notification);
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(-this.maxNotifications);
        }

        return notification;
    }

    /**
     * Get notifications for a user.
     */
    getForUser(userId: string, unreadOnly?: boolean): Notification[] {
        return this.notifications
            .filter((n) => n.userId === userId && (!unreadOnly || !n.read));
    }

    /**
     * Mark as read.
     */
    markRead(notifId: string): boolean {
        const notif = this.notifications.find((n) => n.id === notifId);
        if (!notif) return false;
        notif.read = true;
        return true;
    }

    /**
     * Mark all as read for a user.
     */
    markAllRead(userId: string): number {
        let count = 0;
        for (const n of this.notifications) {
            if (n.userId === userId && !n.read) { n.read = true; count++; }
        }
        return count;
    }

    /**
     * Set user preferences.
     */
    setPreferences(userId: string, prefs: NotificationPreferences): void {
        this.preferences.set(userId, prefs);
    }

    /**
     * Get unread count.
     */
    getUnreadCount(userId: string): number {
        return this.notifications.filter((n) => n.userId === userId && !n.read).length;
    }

    /**
     * Get recent notifications.
     */
    getRecent(limit?: number): Notification[] {
        return this.notifications.slice(-(limit ?? 20));
    }

    /**
     * Clear old notifications.
     */
    clearExpired(): number {
        const now = Date.now();
        const before = this.notifications.length;
        this.notifications = this.notifications.filter((n) => !n.expiresAt || n.expiresAt > now);
        return before - this.notifications.length;
    }

    /** Count */
    count(): number { return this.notifications.length; }
}
