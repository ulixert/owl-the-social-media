import { notifications } from '@mantine/notifications';
import { IconBell, IconCheck, IconX } from '@tabler/icons-react';

type NotificationProps = {
  title: string;
  message: string;
};

export function showSuccessNotification({ title, message }: NotificationProps) {
  notifications.show({ color: 'green', icon: <IconCheck />, title, message });
}

export function showErrorNotification({ title, message }: NotificationProps) {
  notifications.show({ color: 'red', icon: <IconX />, title, message });
}

export function showInfoNotification({ title, message }: NotificationProps) {
  notifications.show({ color: 'mono', icon: <IconBell />, title, message });
}
