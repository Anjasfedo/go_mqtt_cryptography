// package main

// import (
// 	"bytes"
// 	"golang.org/x/crypto/chacha20"
// 	"encoding/binary"
// 	"encoding/hex"
// 	"fmt"
// 	"log"
// 	"math"
// 	"os"
// 	"os/signal"
// 	"syscall"

// 	mqtt "github.com/mochi-mqtt/server/v2"
// 	"github.com/mochi-mqtt/server/v2/hooks/auth"
// 	"github.com/mochi-mqtt/server/v2/listeners"
// 	"github.com/mochi-mqtt/server/v2/packets"
// )

// type DecryptHook struct {
// 	mqtt.HookBase
// }

// func (h *DecryptHook) ID() string {
// 	return "decrypt-hook"
// }

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

// 	tcp := listeners.NewTCP(listeners.Config{
// 		ID:      "t1",
// 		Address: ":1883",
// 	})

// 	err := server.AddListener(tcp)
// 	if err != nil {
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
// 	nonceHex := "000000000000000000000000"
	
// 	key, _ := hex.DecodeString(keyHex)
// 	nonce, _ := hex.DecodeString(nonceHex)
// 	cipherText, _ := hex.DecodeString(string(hexPayload))

// 	cipher, _ := chacha20.NewUnauthenticatedCipher(key, nonce)
// 	decrypted := make([]byte, len(cipherText))
// 	cipher.XORKeyStream(decrypted, cipherText)

// 	if len(decrypted) >= 8 {
// 		tempBits := binary.LittleEndian.Uint32(decrypted[0:4])
// 		temp := math.Float32frombits(tempBits)

// 		humBits := binary.LittleEndian.Uint32(decrypted[4:8])
// 		hum := math.Float32frombits(humBits)

// 		fmt.Printf("Temp: %.2f, Hum: %.2f\n", temp, hum)
// 	}
// }