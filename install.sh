#!/bin/bash

# Exit on error
set -e

# Default values
INSTALL_DIR="/opt/dashboard"
CONFIG_DIR="/etc/dashboard"
SERVICE_USER="dashboard"
SERVICE_GROUP="dashboard"

# Create directories
sudo mkdir -p "$INSTALL_DIR"
sudo mkdir -p "$CONFIG_DIR"
sudo mkdir -p "$INSTALL_DIR/data"
sudo mkdir -p "$INSTALL_DIR/logs"
sudo mkdir -p "$INSTALL_DIR/plugins"

# Create user and group
sudo useradd -r -s /bin/false "$SERVICE_USER" || true
sudo groupadd "$SERVICE_GROUP" || true

# Copy files
sudo cp -r . "$INSTALL_DIR/"
sudo cp conf/config.ini "$CONFIG_DIR/"
sudo cp dashboard.service /etc/systemd/system/

# Build frontend
cd "$INSTALL_DIR/client"
npm install
CONFIG_PATH="$CONFIG_DIR/config.ini" npm run build

# Install backend dependencies
cd "$INSTALL_DIR"
npm install --production

# Set permissions
sudo chown -R "$SERVICE_USER:$SERVICE_GROUP" "$INSTALL_DIR"
sudo chown -R "$SERVICE_USER:$SERVICE_GROUP" "$CONFIG_DIR"
sudo chmod 755 "$INSTALL_DIR"
sudo chmod 755 "$CONFIG_DIR"

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable dashboard
sudo systemctl start dashboard

echo "Installation complete!"
echo "The dashboard service is now running."
echo "You can check its status with: sudo systemctl status dashboard" 