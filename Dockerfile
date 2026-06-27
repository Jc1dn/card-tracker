# Use a lightweight Node image
FROM node:18-alpine AS runner
WORKDIR /app

# Copy the built standalone app from your local machine (or CI/CD)
COPY .next/standalone ./
COPY .next/static ./.next/static
COPY public ./public
COPY dev.db ./  # Your SQLite database

EXPOSE 3000
CMD ["node", "server.js"]