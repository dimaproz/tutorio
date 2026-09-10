import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = join(packageRoot, 'src');
const uiDirectory = join(sourceRoot, 'components', 'ui') + sep;
const primitiveNames = new Set([
  'accordion',
  'alert-dialog',
  'alert',
  'aspect-ratio',
  'avatar',
  'badge',
  'breadcrumb',
  'bubble',
  'button',
  'calendar',
  'card',
  'chart',
  'checkbox',
  'collapsible',
  'command',
  'context-menu',
  'dialog',
  'direction',
  'drawer',
  'dropdown-menu',
  'empty',
  'field',
  'hover-card',
  'input-group',
  'input-otp',
  'input',
  'item',
  'kbd',
  'label',
  'marker',
  'menubar',
  'message',
  'native-select',
  'navigation-menu',
  'pagination',
  'popover',
  'progress',
  'radio-group',
  'resizable',
  'scroll-area',
  'select',
  'separator',
  'sheet',
  'sidebar',
  'skeleton',
  'slider',
  'sonner',
  'spinner',
  'switch',
  'table',
  'tabs',
  'textarea',
  'toggle-group',
  'toggle',
  'tooltip',
]);
const duplicatePrimitiveAllowlist = new Set(['lib/pagination.ts']);

// This narrow list is reviewed in docs/frontend-plan.md. Each entry is a data or upstream exception.
const rawColorAllowlist = new Set([
  'app/globals.css',
  'app/layout.tsx',
  'components/ui/chart.tsx',
  'lib/theme/user-colors.ts',
  'lib/auth/gateway.test.ts',
]);
const removedUtilityPattern = /\b(?:bg|text|border|ring)-light(?:-|[a-z])/;

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? filesIn(path) : [path];
    }),
  );
  return nested.flat();
}

const files = (await filesIn(sourceRoot)).filter((file) => /\.(?:css|[cm]?[jt]sx?)$/.test(file));
const violations = [];

for (const file of files) {
  const relativePath = relative(sourceRoot, file).split(sep).join('/');
  const content = await readFile(file, 'utf8');

  if (!file.startsWith(uiDirectory) && /from\s+['"](?:radix-ui|@radix-ui\/)/.test(content)) {
    violations.push(`${relativePath}: direct Radix import outside components/ui`);
  }

  if (
    !file.startsWith(uiDirectory) &&
    !duplicatePrimitiveAllowlist.has(relativePath) &&
    primitiveNames.has(
      relativePath
        .replace(/\.tsx?$/, '')
        .split('/')
        .at(-1),
    )
  ) {
    violations.push(`${relativePath}: duplicate primitive filename outside components/ui`);
  }

  if (!rawColorAllowlist.has(relativePath)) {
    const rawColor =
      /#[0-9a-fA-F]{3,8}\b|\b(?:bg|text|border|ring|fill|stroke)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}\b|\b(?:oklch|oklab|hsl|hsla|rgb|rgba)\(\s*(?!from(?:\b|_))/;
    if (rawColor.test(content)) {
      violations.push(`${relativePath}: raw product color outside the approved token locations`);
    }
  }

  if (removedUtilityPattern.test(content)) {
    violations.push(`${relativePath}: utility references a removed theme token`);
  }
}

if (violations.length > 0) {
  console.error(
    'UI architecture check failed:\n' + violations.map((violation) => `- ${violation}`).join('\n'),
  );
  process.exitCode = 1;
}
