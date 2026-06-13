FROM node:20-slim

# Install system dependencies required by sharp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libvips-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy the rest of the files
COPY . .

# Create downloads folder
RUN mkdir -p downloads

# Expose port
EXPOSE 3000

# Start the bot
CMD ["npm", "start"]
