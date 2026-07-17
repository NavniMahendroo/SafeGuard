FROM node:18

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install serve to run the built app
RUN npm install -g serve

# Expose port
EXPOSE 80

# Serve the built app
CMD ["serve", "-s", "dist", "-l", "80"]
