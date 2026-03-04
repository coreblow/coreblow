# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in CoreBlow, please report it responsibly:

1. **Do NOT** open a public issue
2. Email: security@coreblow.com
3. Include a description of the vulnerability and steps to reproduce

We will respond within 48 hours and work with you to fix the issue.

## Security Measures

CoreBlow includes several built-in security features:

- **Token authentication** for API and WebSocket connections
- **Tool profiles** restrict tool access per agent
- **Approval system** for sensitive tool executions
- **Loop detection** prevents runaway tool execution
- **Audit logging** records all tool calls and auth events
- **Secret redaction** in config output and logs

## Best Practices

- Always set a gateway token: `COREBLOW_TOKEN=your-secret-token`
- Use tool profiles to restrict agent capabilities
- Enable approval mode for production: `ask: on-miss`
- Run in Docker for process isolation
- Keep your dependencies updated
