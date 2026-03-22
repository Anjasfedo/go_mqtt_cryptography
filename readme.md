go install go.k6.io/xk6/cmd/xk6@latest
xk6 build --with github.com/pmalhaire/xk6-mqtt


.\k6.exe run test/main.js

aes-128
Component,Algorithm / Specification,Description
Symmetric Encryption,AES-128,Advanced Encryption Standard with a 128-bit key.
Block Mode,ECB (Electronic Codebook),Encrypts each block independently.
Padding,PKCS7,Adds bytes to the data to match the AES 16-byte block size.
Data Encoding,Hexadecimal,The encrypted bytes are transmitted as Hex strings to ensure safe passage.
Binary Format,IEEE 754 (Float32),Standard 4-byte representation for floating-point numbers.
Byte Order,Little Endian,The least significant byte is stored first (common in x86/ARM).
Category,Metric,Total / Value,Rate / Distribution
MQTT (Custom),MQTT Calls,"484,165","8,201.69 /s"
,Messages Sent,"483,765","8,194.92 /s"
Execution,Iterations,200,3.39 /s
,Iteration Duration,—,"avg: 29.51s, min: 29.5s, med: 29.51s, max: 29.52s, p(90): 29.51s, p(95): 29.52s"
,Active VUs,100,"min: 100, max: 100"
,Max VUs,100,"min: 100, max: 100"
Network,Data Received,0 B,0 B/s
,Data Sent,16 MB,262 kB/s

aes-256
Component,Algorithm / Specification,Description
Symmetric Encryption,AES-256,Advanced Encryption Standard with a 256-bit key (upgraded from 128-bit).
Block Mode,ECB (Electronic Codebook),Encrypts each 16-byte block independently.
Padding,PKCS7,Appends bytes to the payload to reach the required 16-byte block boundary.
Data Encoding,Hexadecimal,Ciphertext is transmitted as Hex strings to ensure character compatibility.
Binary Format,IEEE 754 (Float32),Standard 4-byte representation for Temperature and Humidity values.
Byte Order,Little Endian,The least significant byte is stored first (standard for x86/ARM systems).
Category,Metric,Total / Value,Rate / Distribution
MQTT (Custom),MQTT Calls,"465,619","7,885.21 /s"
,Messages Sent,"465,219","7,878.44 /s"
Execution,Iterations,200,3.39 /s
,Iteration Duration,—,"avg: 29.52s, min: 29.5s, med: 29.52s, max: 29.54s, p(90): 29.53s, p(95): 29.53s"
,Active VUs,100,"min: 100, max: 100"
,Max VUs,100,"min: 100, max: 100"
Network,Data Received,0 B,0 B/s
,Data Sent,15 MB,252 kB/s

ChaCha20
Component, Algorithm / Specification, Description
Symmetric Encryption, ChaCha20, Stream cipher utilizing a 256-bit key for high-performance encryption.
Cipher Type, Stream Cipher, Generates a pseudo-random keystream XORed directly with the plaintext.
Padding, None, Not required as stream ciphers operate on individual bytes rather than fixed blocks.
Nonce (IV), 96-bit (12-byte), Unique initialization vector to ensure different ciphertext for identical plaintext.
Data Encoding, Hexadecimal, Ciphertext is transmitted as Hex strings to maintain compatibility across protocols.
Binary Format, IEEE 754 (Float32), Standard 4-byte representation for floating-point environmental data.
Byte Order, Little Endian, The least significant byte is processed first to match modern CPU architectures.

Category, Metric, Total / Value, Rate / Distribution
MQTT (Custom), MQTT Calls, "241,472", "7,317.04 /s"
, Messages Sent, "241,272", "7,310.98 /s"
Execution, Iterations, 100, 3.03 /s
, Iteration Duration, —, "avg: 31.67s, min: 30s, med: 31.71s, max: 33s, p(90): 32.83s, p(95): 32.91s"
, Active VUs, 100, "min: 1, max: 100"
, Max VUs, 100, "min: 100, max: 100"
Network, Data Received, 0 B, 0 B/s
, Data Sent, 3.9 MB, 117 kB/s