import { MenuItem } from './menu.model';

export const MENU: MenuItem[] = [
    {
        id: 1,
        label: 'MENUITEMS.MENU.TEXT',
        isTitle: true
    },
    {
        id: 2,
        label: 'MENUITEMS.DASHBOARDS.TEXT',
        icon: 'ri-dashboard-line',
        link: '/home/dashboard'
    },
    {
        id: 3,
        label: 'MENUITEMS.SCHEDULEDCALLS.TEXT',
        icon: 'ri-calendar-2-line',
        link: '/calls/scheduled'
    },
    {
        id: 3,
        label: 'MENUITEMS.MAP.TEXT',
        icon: 'ri-map-2-line',
        link: '/mapping/map'
    }
];
