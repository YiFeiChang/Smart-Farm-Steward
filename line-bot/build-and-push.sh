#!/bin/bash

# 當任何指令返回非零退出碼時，立即停止執行
set -e

# --- 請修改以下變數 ---
REGISTRY_URL="10.0.0.254:5000"
IMAGE_NAME="line-bot"
TAG="latest"
# --------------------

# 組成完整的 image 名稱
FULL_IMAGE_NAME="$REGISTRY_URL/$IMAGE_NAME:$TAG"

echo "Logging into registry: $REGISTRY_URL"
# 登入到您的私有 registry
# 這裡會提示您輸入帳號密碼
docker login "$REGISTRY_URL"

echo "Building Docker image: $FULL_IMAGE_NAME"

# 使用 Dockerfile 建置 image
docker build -t "$FULL_IMAGE_NAME" .

echo "Pushing Docker image to $REGISTRY_URL..."

# 推送 image 到您的私有 registry
docker push "$FULL_IMAGE_NAME"

echo "Build and push complete for $FULL_IMAGE_NAME"