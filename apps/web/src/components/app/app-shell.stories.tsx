import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, waitFor, within } from 'storybook/test';
import type { AuthMe } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { MOBILE_MEDIA_QUERY } from '@/hooks/use-mobile';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NarrowStoryContainer } from '@/stories/story-helpers';
import { AppHeaderContent } from './app-header';
import { AppSidebarContent } from './app-sidebar';

const ownerSession = {
  user: {
    id: '83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e',
    name: 'Olena Kovalenko',
    email: 'olena@example.com',
  },
  workspace: {
    id: 'dc7b01d3-f7df-4cc6-8a6e-bb216d16e97c',
    name: 'Kyiv Language Studio',
    plan: 'PRO',
    mode: 'SCHOOL',
    defaultCurrency: 'UAH',
    cancellationDeadlineHours: 24,
  },
  role: 'OWNER',
} satisfies AuthMe;

function AppShellContract({
  pathname = '/app/students',
  session = ownerSession,
  isSolo = false,
  isLogoutPending = false,
}: {
  pathname?: string;
  session?: AuthMe;
  isSolo?: boolean;
  isLogoutPending?: boolean;
}) {
  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            '--sidebar-width': '18rem',
            '--header-height': '3.5rem',
          } as React.CSSProperties
        }
      >
        <AppSidebarContent
          pathname={pathname}
          session={session}
          isSolo={isSolo}
          isLogoutPending={isLogoutPending}
          onLogout={() => undefined}
        />
        <SidebarInset>
          <AppHeaderContent
            pathname={pathname}
            localeControl={<Button variant="ghost" size="icon" aria-label="Language">EN</Button>}
            themeControl={<Button variant="ghost" size="icon" aria-label="Theme">◐</Button>}
          />
          <div className="flex flex-1 flex-col p-4 md:p-6">
            <h1 className="text-lg font-medium">Feature content</h1>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function forceMobileMediaQuery() {
  const originalMatchMedia = window.matchMedia;

  window.matchMedia = (query) => {
    const result = originalMatchMedia(query);

    if (query !== MOBILE_MEDIA_QUERY) {
      return result;
    }

    return {
      ...result,
      matches: true,
      addEventListener: result.addEventListener.bind(result),
      removeEventListener: result.removeEventListener.bind(result),
      dispatchEvent: result.dispatchEvent.bind(result),
    };
  };

  return () => {
    window.matchMedia = originalMatchMedia;
  };
}

const meta = {
  title: 'Application/App shell',
  component: AppShellContract,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AppShellContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopExpanded: Story = {
  play: async ({ canvas }) => {
    const studentNavigation = canvas.getAllByRole('link', { name: 'Students' })[0];
    await expect(studentNavigation).toHaveAttribute(
      'data-active',
      'true',
    );
    await expect(studentNavigation).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('button', { name: 'Toggle sidebar' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: /search/i })).toBeNull();
    await expect(canvas.queryByRole('button', { name: /notification/i })).toBeNull();
  },
};

export const DesktopCollapsed: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Toggle sidebar' }));
    await expect(canvas.getAllByRole('link', { name: 'Students' })[0]).toBeVisible();
  },
};

export const ActiveDetailRoute: Story = {
  args: { pathname: '/app/students/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Details')).toBeVisible();
    await expect(canvas.queryByText('83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e')).toBeNull();
  },
};

export const SoloWorkspace: Story = {
  args: { isSolo: true },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link', { name: 'Teachers' })).toBeNull();
    await expect(canvas.getByRole('link', { name: 'Settings' })).toBeVisible();
  },
};

export const NonOwnerSchoolWorkspace: Story = {
  args: { session: { ...ownerSession, role: 'TEACHER' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Teachers' })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Settings' })).toBeNull();
  },
};

export const UserMenuAndLogoutPending: Story = {
  args: { isLogoutPending: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Account menu' }));
    const menu = within(document.body);
    await expect(menu.getByRole('menuitem', { name: 'Settings' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Sign out' })).toHaveAttribute('data-disabled');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(menu.queryByRole('menu')).not.toBeInTheDocument());
  },
};

export const LongUkrainianDark: Story = {
  args: {
    session: {
      ...ownerSession,
      user: {
        ...ownerSession.user,
        name: 'Олександра Миколаївна Височенко-Петренко',
      },
      workspace: {
        ...ownerSession.workspace,
        name: 'Навчальна майстерня української та англійської мов для дорослих',
      },
    },
  },
  globals: { locale: 'uk', theme: 'dark' },
};

export const MobileSidebar: Story = {
  render: () => <NarrowStoryContainer><AppShellContract /></NarrowStoryContainer>,
  beforeEach: forceMobileMediaQuery,
  parameters: {
    viewport: { defaultViewport: 'mobile1' },
  },
  play: async ({ canvas, userEvent }) => {
    const trigger = canvas.getByRole('button', { name: 'Toggle sidebar' });
    trigger.focus();
    await userEvent.keyboard('{Enter}');

    const sheet = within(document.body);
    const openedFromKeyboard = sheet.getByRole('dialog', { name: 'Sidebar' });
    await expect(openedFromKeyboard).toBeVisible();
    openedFromKeyboard.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() =>
      expect(sheet.queryByRole('dialog', { name: 'Sidebar' })).not.toBeVisible(),
    );

    await userEvent.click(trigger);
    const dialog = sheet.getByRole('dialog', { name: 'Sidebar' });
    await userEvent.click(within(dialog).getByRole('link', { name: 'Students' }));
    await waitFor(() => expect(sheet.queryByRole('dialog', { name: 'Sidebar' })).not.toBeVisible());
  },
};
