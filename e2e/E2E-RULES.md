# E2E Testing Rules

- Use getByRole, getByLabel, getByText as primary locators.
  Fall back to getByTestId only when accessibility attributes are ambiguous.
- Never use CSS selectors, XPath, or DOM structure for locating elements.
- Each test must be independently runnable — no shared state between tests.
- Never use page.waitForTimeout(). Wait for specific conditions:
  toBeVisible(), waitForURL(), waitForResponse().
- Assert the business outcome, not implementation details.
- Use unique identifiers (e.g., timestamp suffix) for test data
  to avoid collisions in parallel runs. Clean up in afterEach.
- Use storageState for authentication — never log in through UI
  in individual tests. Guest/unauthenticated flows use the `guest` Playwright project.
- Cross-user authorization tests must use separate storage-state files and verify
  the owner's data after every blocked attacker operation.
- Seed and clean cross-user fixtures through an authenticated owner client. Never
  use the service-role key for routine E2E CRUD.
