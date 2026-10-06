# LavinMQ Demos

A collection of demonstration applications showcasing [LavinMQ](https://lavinmq.com) features and capabilities.

## What is LavinMQ?

LavinMQ is a high-performance message queue server implementing the AMQP protocol. It's designed to be fast, lightweight, and easy to deploy, making it perfect for everything from small projects to large-scale distributed systems.

## Demos

Demos are organized into two categories:

- **Static Demos**: Client-side applications deployed to S3/GitHub Pages
- **Backend Demos**: Server applications deployed to Heroku, fly.io, etc.

### 🗨️ [Chat App](./chat-app) _(Static)_

A real-time chat application demonstrating:
- **Zero-backend architecture** - Pure client-side app using AMQP streams
- **OAuth2 authentication** - Secure sign-in with GitHub or other providers
- **WebSocket connectivity** - Direct browser-to-LavinMQ communication
- **AMQP streams** - Message persistence and real-time delivery
- **Multi-channel support** - Public channels and direct messages

Perfect for learning how to build modern real-time applications with LavinMQ.

[View Chat App Demo →](./chat-app)

---

_More demos coming soon! Backend demos (Node.js workers, Ruby consumers, etc.) will be added with their own deployment instructions._

### [Image Processing Demo](./image_processing_demo) _(Backend)_

A background job processing demo showcasing:

- **Asynchronous task processing** using LavinMQ queues
- **FastAPI upload service** for receiving image uploads
- **Worker-based architecture** using Python consumers
- **Image transformations** such as grayscale, blur, and thumbnails
- **Decoupled processing pipelines** using AMQP messaging

The API publishes image-processing jobs to LavinMQ, while background workers consume and process the images asynchronously.

Perfect for learning how to build queue-based background processing systems with LavinMQ.

[View Image Processing Demo →](./image_processing_demo)

## Getting Started

Each demo has its own README with setup instructions. To get started:

1. **Run LavinMQ** locally or use a hosted instance
2. **Check the demo's README** for specific setup
3. **Run locally** using the demo's dev tools

### Quick Start with LavinMQ

```bash
# Docker
docker run -d --name lavinmq -p 5672:5672 -p 15672:15672 -p 15692:15692 \
  cloudamqp/lavinmq:latest

# Or install directly: https://lavinmq.com/documentation/install
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
- Building static demos
- Deployment options
- Adding new demos

## Contributing

Have an idea for a demo? Contributions are welcome! Each demo should:
- Showcase a specific LavinMQ feature or use case
- Include clear documentation and setup instructions
- Be self-contained in its own directory
- Follow best practices for the language/framework used

## Resources

- [LavinMQ Documentation](https://lavinmq.com/documentation)
- [LavinMQ GitHub](https://github.com/cloudamqp/lavinmq)
- [AMQP Protocol](https://www.amqp.org/)

## License

Each demo may have its own license. See individual demo directories for details.
