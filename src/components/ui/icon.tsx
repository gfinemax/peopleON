import { cn } from '@/lib/utils';

interface MaterialIconProps {
    name: string;
    className?: string;
    filled?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

const sizeMap = {
    xs: 'text-[14px]',
    sm: 'text-[18px]',
    md: 'text-[20px]',
    lg: 'text-[24px]',
    xl: 'text-[28px]',
    '2xl': 'text-[32px]',
    '3xl': 'text-[36px]',
};

export function MaterialIcon({
    name,
    className,
    filled = false,
    size = 'md'
}: MaterialIconProps) {
    return (
        <span
            className={cn(
                'material-symbols-outlined select-none',
                sizeMap[size],
                filled && 'font-variation-settings-fill',
                className
            )}
            style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
            {name}
        </span>
    );
}

// Common icon name mappings for easy reference
export const Icons = {
    // Navigation
    home: 'home',
    dashboard: 'dashboard',
    menu: 'menu',
    close: 'close',
    arrowBack: 'arrow_back',
    arrowForward: 'arrow_forward',
    chevronLeft: 'chevron_left',
    chevronRight: 'chevron_right',
    chevronDown: 'expand_more',
    chevronUp: 'expand_less',

    // Actions
    add: 'add',
    edit: 'edit',
    delete: 'delete',
    save: 'save',
    search: 'search',
    filter: 'filter_list',
    sort: 'sort',
    refresh: 'refresh',
    download: 'download',
    upload: 'upload',
    print: 'print',
    share: 'share',
    copy: 'content_copy',

    // User & Auth
    person: 'person',
    people: 'people',
    group: 'group',
    lock: 'lock',
    unlock: 'lock_open',
    visibility: 'visibility',
    visibilityOff: 'visibility_off',
    login: 'login',
    logout: 'logout',

    // Communication
    phone: 'phone',
    email: 'email',
    mail: 'mail',
    message: 'message',
    chat: 'chat',
    sms: 'sms',
    call: 'call',
    contactPage: 'contact_page',
    contacts: 'contacts',

    // Business
    apartment: 'apartment',
    domain: 'domain',
    business: 'business',
    payments: 'payments',
    accountBalance: 'account_balance',
    creditCard: 'credit_card',
    receipt: 'receipt',
    invoice: 'receipt_long',

    // Status
    check: 'check',
    checkCircle: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
    help: 'help',

    // Calendar & Time
    calendar: 'calendar_today',
    calendarMonth: 'calendar_month',
    schedule: 'schedule',
    event: 'event',

    // Files & Documents
    folder: 'folder',
    file: 'description',
    attachment: 'attachment',
    pdf: 'picture_as_pdf',

    // Charts & Analytics
    chart: 'bar_chart',
    pieChart: 'pie_chart',
    trending: 'trending_up',
    trendingDown: 'trending_down',
    analytics: 'analytics',

    // Settings
    settings: 'settings',
    tune: 'tune',

    // Theme
    lightMode: 'light_mode',
    darkMode: 'dark_mode',

    // Notifications
    notifications: 'notifications',
    notificationsActive: 'notifications_active',

    // Misc
    star: 'star',
    favorite: 'favorite',
    bookmark: 'bookmark',
    label: 'label',
    tag: 'sell',
    location: 'location_on',
    history: 'history',
    timeline: 'timeline',
} as const;
