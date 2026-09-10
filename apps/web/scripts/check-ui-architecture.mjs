import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize, relative, sep } from 'node:path';

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
const appShellFiles = new Set([
  'app-header.tsx',
  'app-navigation.test.ts',
  'app-navigation.ts',
  'app-shell-actions.test.ts',
  'app-shell-actions.ts',
  'app-shell.stories.tsx',
  'app-sidebar.tsx',
  'session-provider.tsx',
  'theme-toggle.tsx',
]);
const moduleImport = /(?:from\s+|import\()["']([^"']+)["']/g;

function importedSourcePath(relativePath, specifier) {
  if (specifier.startsWith('@/')) {
    return specifier.slice(2);
  }
  if (specifier.startsWith('.')) {
    return normalize(join(dirname(relativePath), specifier))
      .split(sep)
      .join('/');
  }
  return null;
}

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

  if (relativePath.startsWith('components/app/') && !appShellFiles.has(relativePath.slice(15))) {
    violations.push(
      `${relativePath}: components/app is reserved for authenticated shell ownership`,
    );
  }

  const imports = [...content.matchAll(moduleImport)]
    .map((match) => importedSourcePath(relativePath, match[1]))
    .filter(Boolean);
  if (imports.includes('components/shared')) {
    violations.push(`${relativePath}: import shared components from their documented leaf modules`);
  }
  if (relativePath.startsWith('components/shared/')) {
    if (/\bimport\s*\(\s*[^'"\s]/.test(content)) {
      violations.push(`${relativePath}: shared components cannot use unresolved dynamic imports`);
    }
    for (const imported of imports) {
      if (
        imported.startsWith('components/app/') ||
        imported.startsWith('features/') ||
        imported.startsWith('lib/api/')
      ) {
        violations.push(
          `${relativePath}: shared components cannot import shell or feature layers (${imported})`,
        );
      }
    }
  }

  if (relativePath.startsWith('components/ui/')) {
    for (const imported of imports) {
      if (
        imported.startsWith('components/app/') ||
        imported.startsWith('components/shared/') ||
        imported.startsWith('features/')
      ) {
        violations.push(
          `${relativePath}: ui primitives cannot import product layers (${imported})`,
        );
      }
    }
  }

  const isFeatureOrLegacyDomain =
    relativePath.startsWith('features/') ||
    (relativePath.startsWith('components/') &&
      !relativePath.startsWith('components/app/') &&
      !relativePath.startsWith('components/shared/') &&
      !relativePath.startsWith('components/ui/'));
  if (isFeatureOrLegacyDomain) {
    for (const imported of imports) {
      if (
        imported.startsWith('components/app/') &&
        imported !== 'components/app/session-provider'
      ) {
        violations.push(
          `${relativePath}: feature/domain code cannot import application-shell components (${imported})`,
        );
      }
    }
  }

  if (
    relativePath.startsWith('app/') &&
    relativePath !== 'app/app/layout.tsx' &&
    relativePath !== 'app/layout.tsx'
  ) {
    for (const imported of imports) {
      if (imported.startsWith('components/shared/') || imported.startsWith('components/ui/')) {
        violations.push(
          `${relativePath}: routes assemble feature components, not shared or ui layers (${imported})`,
        );
      }
    }
  }
}

if (violations.length > 0) {
  console.error(
    'UI architecture check failed:\n' + violations.map((violation) => `- ${violation}`).join('\n'),
  );
  process.exitCode = 1;
}
