# Contributing to Media Compressor

Thank you for considering contributing to Media Compressor! This document provides guidelines and steps for contributing.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/media-compressor.git`
3. Install dependencies: `pnpm install`
4. Create a `.env.local` from `.env.example` and fill in your credentials
5. Start the dev server: `pnpm dev`

## Development Workflow

```bash
# Start development server
pnpm dev

# Type checking
pnpm typecheck

# Lint
pnpm lint

# Format code
pnpm format
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make your changes
3. Run `pnpm typecheck` and `pnpm lint` to ensure code quality
4. Commit with a descriptive message
5. Push to your fork and open a Pull Request

## Code Style

- TypeScript strict mode is enabled
- Use Prettier for formatting (config in `.prettierrc`)
- Follow existing patterns in the codebase
- Add types for all function parameters and return values

## Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Include expected vs actual behavior
- Include Node.js version and OS

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
