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
import { NoBusinessAccessView } from './owner-access-gate';

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

type ShellArgs = {
  pathname: string;
  workspace: 'school' | 'solo';
  role: 'OWNER' | 'TEACHER';
  isLogoutPending: boolean;
  session?: AuthMe;
};

function AppShellContract({
  pathname = '/app/students',
  workspace = 'school',
  role = 'OWNER',
  isLogoutPending = false,
  session = ownerSession,
}: Partial<ShellArgs>) {
  const current = { ...session, role };
  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            '--sidebar-width': '316px',
            '--header-height': '3rem',
          } as React.CSSProperties
        }
      >
        <AppSidebarContent
          pathname={pathname}
          session={current}
          isSolo={workspace === 'solo'}
          isLogoutPending={isLogoutPending}
          onLogout={() => undefined}
        />
        <SidebarInset className="gap-6 p-4 md:pt-5 md:pr-6 md:pb-4 md:pl-0">
          <AppHeaderContent
            pathname={pathname}
            workspaceName={current.workspace.name}
            businessAccess={role === 'OWNER'}
            localeControl={
              <Button variant="outline" size="icon" aria-label="Language">
                EN
              </Button>
            }
            themeControl={
              <Button variant="outline" size="icon" aria-label="Theme">
                ◐
              </Button>
            }
          />
          <div className="flex flex-1 flex-col gap-6">
            {role === 'OWNER' ? (
              <h1 className="text-lg font-medium">Feature content</h1>
            ) : (
              <NoBusinessAccessView onSignOut={() => undefined} />
            )}
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
  args: { pathname: '/app/students', workspace: 'school', role: 'OWNER', isLogoutPending: false },
  argTypes: {
    pathname: {
      control: 'select',
      options: [
        '/app',
        '/app/calendar',
        '/app/students',
        '/app/students/new',
        '/app/groups',
        '/app/settings',
      ],
    },
    workspace: { control: 'inline-radio', options: ['school', 'solo'] },
    role: { control: 'inline-radio', options: ['OWNER', 'TEACHER'] },
    session: { table: { disable: true } },
  },
} satisfies Meta<typeof AppShellContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DesktopExpanded: Story = {
  play: async ({ canvas }) => {
    const studentNavigation = canvas.getAllByRole('link', { name: 'Students' })[0];
    await expect(studentNavigation).toHaveAttribute('data-active', 'true');
    await expect(studentNavigation).toHaveAttribute('aria-current', 'page');
    // Search and notifications are part of the shell now; the collapse trigger
    // is not, because the Studio sidebar is always open on desktop.
    await expect(
      canvas.getByRole('searchbox', { name: 'Search students, lessons, payments' }),
    ).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Notifications' })).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Toggle sidebar' })).toBeNull();
  },
};

/**
 * A teacher membership in the owner-operated pilot: no destinations at all,
 * and the no-access screen in place of every page.
 */
export const Teacher: Story = {
  args: { workspace: 'solo', role: 'TEACHER' },
  play: async ({ canvas, canvasElement }) => {
    const workspace = canvasElement.querySelector('[data-slot="workspace-context"]');
    await expect(workspace).not.toBeNull();
    await expect(within(workspace as HTMLElement).getByText('Individual tutor')).toBeVisible();
    for (const name of ['Today', 'Students', 'Calendar', 'Teachers', 'Settings']) {
      await expect(canvas.queryByRole('link', { name })).toBeNull();
    }
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(/Access/);
    await expect(canvas.getByRole('button', { name: 'Sign out' })).toBeEnabled();
  },
};

export const ActiveDetailRoute: Story = {
  args: { pathname: '/app/students/83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e' },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Details')).toBeVisible();
    await expect(canvas.queryByText('83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e')).toBeNull();
  },
};

export const UserMenuAndLogoutPending: Story = {
  args: { isLogoutPending: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Olena Kovalenko/ }));
    const menu = within(document.body);
    await waitFor(() => expect(menu.getByRole('menuitem', { name: 'Settings' })).toBeVisible());
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
  render: () => (
    <NarrowStoryContainer>
      <AppShellContract />
    </NarrowStoryContainer>
  ),
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
    await waitFor(() => expect(openedFromKeyboard).toBeVisible());
    openedFromKeyboard.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(sheet.queryByRole('dialog', { name: 'Sidebar' })).not.toBeVisible());

    await userEvent.click(trigger);
    const dialog = sheet.getByRole('dialog', { name: 'Sidebar' });
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(within(dialog).getByRole('link', { name: 'Students' }));
    await waitFor(() => expect(sheet.queryByRole('dialog', { name: 'Sidebar' })).not.toBeVisible());
  },
};
