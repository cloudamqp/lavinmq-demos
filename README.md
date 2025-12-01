# LavinMQ Demos

A collection of demonstration applications showcasing [LavinMQ](https://lavinmq.com) features and capabilities.

## What is LavinMQ?

LavinMQ is a high-performance message queue server implementing the AMQP protocol. It's designed to be fast, lightweight, and easy to deploy, making it perfect for everything from small projects to large-scale distributed systems.

## Demos

### 🗨️ [Chat App](./chat-app)

A real-time chat application demonstrating:
- **Zero-backend architecture** - Pure client-side app using AMQP streams
- **OAuth2 authentication** - Secure sign-in with GitHub or other providers
- **WebSocket connectivity** - Direct browser-to-LavinMQ communication
- **AMQP streams** - Message persistence and real-time delivery
- **Multi-channel support** - Public channels and direct messages

Perfect for learning how to build modern real-time applications with LavinMQ.

[View Chat App Demo →](./chat-app)

## Getting Started

Each demo has its own README with specific setup instructions. Generally, you'll need:

1. **LavinMQ** running locally or accessible via network
2. **Node.js** 18+ for web-based demos
3. Demo-specific dependencies (see individual READMEs)

### Quick Start with LavinMQ

```bash
# Docker (recommended for demos)
docker run -d --name lavinmq -p 5672:5672 -p 15672:15672 -p 15692:15692 \
  cloudamqp/lavinmq:latest

# Or install directly
# See https://lavinmq.com/documentation/install
```

## Contributing

Have an idea for a demo? Contributions are welcome! Each demo should:
- Showcase a specific LavinMQ feature or use case
- Include clear documentation and setup instructions
- Follow best practices for the language/framework used
- Be self-contained in its own directory

## Resources

- [LavinMQ Documentation](https://lavinmq.com/documentation)
- [LavinMQ GitHub](https://github.com/cloudamqp/lavinmq)
- [AMQP Protocol](https://www.amqp.org/)

## License

Each demo may have its own license. See individual demo directories for details.
