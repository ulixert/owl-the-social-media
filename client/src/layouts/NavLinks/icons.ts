import {
  IconHeart,
  IconHome,
  IconPlus,
  IconSearch,
  IconUser,
} from '@tabler/icons-react';

export const icons = [
  { icon: IconHome, path: '/', needLogin: false, type: 'link' },
  { icon: IconSearch, path: '/search', needLogin: false, type: 'link' },
  { icon: IconPlus, path: '/create', needLogin: true, type: 'action' },
  { icon: IconHeart, path: '/liked', needLogin: true, type: 'link' },
  { icon: IconUser, path: '/profile', needLogin: true, type: 'link' },
] as const;
