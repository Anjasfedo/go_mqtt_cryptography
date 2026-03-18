go install go.k6.io/xk6/cmd/xk6@latest
xk6 build --with github.com/pmalhaire/xk6-mqtt


.\k6.exe run test/main.js

aes-128
Category,Metric,Total / Value,Rate / Distribution
MQTT (Custom),MQTT Calls,"484,165","8,201.69 /s"
,Messages Sent,"483,765","8,194.92 /s"
Execution,Iterations,200,3.39 /s
,Iteration Duration,—,"avg: 29.51s, min: 29.5s, med: 29.51s, max: 29.52s, p(90): 29.51s, p(95): 29.52s"
,Active VUs,100,"min: 100, max: 100"
,Max VUs,100,"min: 100, max: 100"
Network,Data Received,0 B,0 B/s
,Data Sent,16 MB,262 kB/s