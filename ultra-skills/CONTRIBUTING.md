# Contributing to Ultra Skills v2

Thank you for your interest in contributing! Here's how you can help.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/coreblow.git`
3. Create a branch: `git checkout -b feature/my-feature`
4. Make your changes
5. Test thoroughly
6. Commit: `git commit -m "feat: add my feature"`
7. Push: `git push origin feature/my-feature`
8. Open a Pull Request

## Development Setup

```bash
# Python engine
cd ultra-skills/scraper
pip install -r requirements.txt
playwright install chromium

# Dashboard
cd ultra-skills/dashboard
npm install
npm run dev

# Worker API
cd ultra-skills/worker
npm install
wrangler dev
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation changes
- `chore:` — maintenance tasks
- `refactor:` — code refactoring
- `test:` — adding tests

## Code Style

- **Python:** PEP 8, docstrings on all public functions
- **JavaScript:** ES6+, JSDoc comments
- **React:** Functional components with hooks

## Reporting Bugs

Open an issue with:
1. Steps to reproduce
2. Expected behavior
3. Actual behavior
4. Environment (OS, Python/Node version)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
