# Contributing

Thank you for your interest in contributing to this project. The goal is to keep contributions simple, transparent, and easy to review.

## How to contribute

1. Fork the repository.
2. Create a feature branch for your change: `git checkout -b feature/short-description`.
3. Make your changes in a clean, focused commit.
4. Run tests and verify formatting.
5. Open a pull request against the `main` branch.

## Reporting issues

- Use existing issue templates when creating bug reports or feature requests.
- Provide a clear description of the problem or proposed improvement.
- Include reproduction steps, expected behavior, and actual behavior.

## Pull request process

- Keep changes limited to a single issue or feature.
- Use descriptive titles and summaries.
- Reference related issues with `#issue-number`.
- Add tests for new behavior and update documentation as needed.

## Code style and quality

- Use consistent indentation and formatting.
- Follow established project conventions for Python and TypeScript.
- Keep code readable and maintainable.
- Validate changes with project tests before submitting.

## Testing

- Backend tests are managed with `pytest`.
- Run backend tests from `/fastapi_backend`:
  ```bash
  cd fastapi_backend
  pytest
  ```
- Frontend development uses Vite. Run frontend linting or build commands from `/5A_Search`.

## License

By contributing, you agree that your contributions are covered by the project license (MIT).
