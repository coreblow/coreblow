# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public issue
2. Email: security@coreblow.com
3. Include steps to reproduce and potential impact

We will respond within 48 hours and provide a fix timeline.

## Security Best Practices

- Never commit `.env` files or API keys
- Use `MASTER_API_KEY` only for initial setup, then generate regular API keys
- API keys are stored as SHA-256 hashes in the database
- Enable proxy rotation when scraping sensitive targets
- Use Docker sandbox mode for untrusted environments

## Supported Versions

| Version | Supported |
|:---|:---|
| 2.x | ✅ Active |
| 1.x | ❌ End of life |
