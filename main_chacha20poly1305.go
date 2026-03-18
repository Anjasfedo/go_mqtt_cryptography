// package main

// import (
// 	"bytes"
// 	"encoding/binary"
// 	"encoding/hex"
// 	"fmt"
// 	"log"
// 	"math"
// 	"os"
// 	"os/signal"
// 	"sync/atomic"
// 	"syscall"

// 	"golang.org/x/crypto/chacha20poly1305"

// 	mqtt "github.com/mochi-mqtt/server/v2"
// 	"github.com/mochi-mqtt/server/v2/hooks/auth"
// 	"github.com/mochi-mqtt/server/v2/listeners"
// 	"github.com/mochi-mqtt/server/v2/packets"
// )

// var msgCount uint64

// type DecryptHook struct {
// 	mqtt.HookBase
// }

// func (h *DecryptHook) ID() string { return "decrypt-hook" }

// func (h *DecryptHook) Provides(b byte) bool {
// 	return bytes.Contains([]byte{mqtt.OnPublish}, []byte{b})
// }

// func (h *DecryptHook) OnPublish(cl *mqtt.Client, pk packets.Packet) (packets.Packet, error) {
// 	if pk.TopicName == "sensors/data" {
// 		processPayload(pk.Payload)
// 	}
// 	return pk, nil
// }

// func main() {
// 	server := mqtt.New(nil)
// 	_ = server.AddHook(new(auth.AllowHook), nil)
// 	_ = server.AddHook(new(DecryptHook), nil)

// 	tcp := listeners.NewTCP(listeners.Config{ID: "t1", Address: ":1883"})
// 	if err := server.AddListener(tcp); err != nil {
// 		log.Fatal(err)
// 	}

// 	go func() {
// 		err := server.Serve()
// 		if err != nil {
// 			log.Fatal(err)
// 		}
// 	}()

// 	sigs := make(chan os.Signal, 1)
// 	signal.Notify(sigs, syscall.SIGINT, syscall.SIGTERM)
// 	<-sigs
// }

// func processPayload(hexPayload []byte) {
// 	keyHex := "000102030405060708090A0B0C0D0E0F101112131415161718191A1B1C1D1E1F"
// 	key, _ := hex.DecodeString(keyHex)

// 	payloadBytes, err := hex.DecodeString(string(hexPayload))
// 	if err != nil || len(payloadBytes) < 36 { // 12 nonce + 8 cipher + 16 tag
// 		return
// 	}

// 	nonce := payloadBytes[:12]
// 	cipherWithTag := payloadBytes[12:]

// 	aead, _ := chacha20poly1305.New(key)
// 	decrypted, err := aead.Open(nil, nonce, cipherWithTag, nil)

// 	if err != nil {
// 		fmt.Printf("Auth Failed: %v\n", err)
// 		return
// 	}

// 	atomic.AddUint64(&msgCount, 1)

// 	if len(decrypted) >= 8 {
// 		temp := math.Float32frombits(binary.LittleEndian.Uint32(decrypted[0:4]))
// 		hum := math.Float32frombits(binary.LittleEndian.Uint32(decrypted[4:8]))
// 		fmt.Printf("Temp: %.2f, Hum: %.2f\n", temp, hum)
// 	}
// }
