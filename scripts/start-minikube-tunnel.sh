#!/bin/bash

# Start Minikube tunnel for ingress access
# This needs to run in a separate terminal with sudo

echo "Starting Minikube tunnel..."
echo "This will enable access to services via ingress"
echo "You may be prompted for your password"
echo
echo "Access will be available at:"
echo "  http://zeal.local"
echo "  http://localhost:3000 (if using port-forward)"
echo
echo "Press Ctrl+C to stop the tunnel"
echo

minikube tunnel -p zeal