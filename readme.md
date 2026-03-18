go install go.k6.io/xk6/cmd/xk6@latest
xk6 build --with github.com/pmalhaire/xk6-mqtt


.\k6.exe run test/main.js