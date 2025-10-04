'use client';

import { Button } from '@/components/ui/button';

export function NotificationsSettings() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-lg font-medium">Notification Settings</h3>
        <p className="text-sm text-muted-foreground">
          Control how and when you receive notifications.
        </p>
      </div>
      <div className="grid gap-4">
        <div className="rounded-lg border p-4">
          <h4 className="font-medium mb-2">Event Reminders</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Configure default reminders for new events.
          </p>
          <Button variant="outline">Set Reminders</Button>
        </div>
        <div className="rounded-lg border p-4">
          <h4 className="font-medium mb-2">Email Notifications</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which events trigger email notifications.
          </p>
          <Button variant="outline">Configure Email</Button>
        </div>
        <div className="rounded-lg border p-4">
          <h4 className="font-medium mb-2">Browser Notifications</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Enable desktop notifications for important events.
          </p>
          <Button variant="outline">Enable Notifications</Button>
        </div>
      </div>
    </div>
  );
}
