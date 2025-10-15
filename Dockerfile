# 使用官方的 Node.js 20 Alpine Linux 映像檔作為基礎
# Alpine 映像檔非常輕量，有助於縮小最終映像檔的大小
FROM node:20-alpine

# 在容器內建立並設定工作目錄
WORKDIR /usr/src/app

# 複製 package.json 和 package-lock.json
# 這樣可以利用 Docker 的圖層快取機制
# 只有當這兩個檔案變更時，才會重新執行 npm ci
COPY package.json ./
COPY package-lock.json ./

# 安裝正式環境的依賴
# npm ci 比 npm install 更快且更適合 CI/CD 環境
RUN npm ci --only=production

# 將應用程式的原始碼複製到工作目錄
COPY app.js ./
COPY .env ./

# 聲明容器在執行時會監聽的連接埠
EXPOSE 3000

# 定義容器啟動時要執行的指令
CMD [ "npm", "start" ]