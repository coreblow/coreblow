# CoreBlow Agents Guide

## Overview
CoreBlow uses a multi-agent architecture where specialized agents handle different tasks.

## Agent Types
- **Code Analysis**: Analyze code structure, complexity, and quality
- **RAG**: Retrieval-augmented generation with vector search
- **Multi-Agent**: Orchestration patterns for agent collaboration
- **Guardrails**: Safety, toxicity, PII, and bias detection
- **Domain Agents**: Healthcare, fintech, legal, education, etc.

## Writing Custom Agents
See `src/agents/` for examples.

## MCP (Model Context Protocol)
CoreBlow supports MCP for agent communication. See `src/agents/mcp/`.
