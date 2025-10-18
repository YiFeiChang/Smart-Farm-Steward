# 使用官方的 Node.js 20 LTS Alpine Linux image 作為基礎
FROM node:20-alpine

# 在容器中建立一個工作目錄
WORKDIR /usr/src/app

# 複製 package.json 和 package-lock.json
# 使用 'ci' 而不是 'install' 可以確保依賴版本與 lock 檔案一致，且安裝速度更快
COPY package.json package-lock.json ./
RUN npm ci --only=production

# 複製應用程式原始碼到工作目錄
COPY . .

# 您的應用程式監聽的端口
# 如果您的應用程式使用不同的端口，請修改這裡
EXPOSE 3000

# 定義容器啟動時要執行的指令
CMD [ "npm", "start" ]
