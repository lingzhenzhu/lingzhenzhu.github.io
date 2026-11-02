import type { Locator } from '@playwright/test';

/** Exercise the visible shared picker rather than mutating its hidden form select. */
export async function selectOption(control: Locator, value: string | { label: string }) {
  const label =
    typeof value === 'string'
      ? await control
          .locator('..')
          .locator('select')
          .evaluate(
            (select, value) =>
              [...select.querySelectorAll('option')].find((option) => option.value === value)?.label || value,
            value,
          )
      : value.label;
  await control.click();
  await control
    .locator('..')
    .locator('[data-filter-options]')
    .getByRole('option', { name: label, exact: true })
    .click();
}
